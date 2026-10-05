import { OVERTIME_RATE_PER_30MIN } from './employeeOptions';

/**
 * backupImport — membaca file backup JSON dari mamam-global (menu Backup →
 * Export JSON) dan mengubah daftar `employees`-nya jadi baris siap simpan
 * ke tabel `employees` C. FUNGSI MURNI: tanpa Supabase, tanpa efek samping.
 *
 * Bentuk karyawan di A: { id:'EMP-…', name, phone, address, hourlyRate,
 * fullTimeBonus, overtimeRate30, startDate, status, resignDate, role,
 * deletedAt? }. Id lama disimpan di kolom external_id supaya log absensi
 * dari sistem absensi (yang merujuk ke id lama itu) tetap bisa dicocokkan.
 */

const STATUSES = ['aktif', 'freelance', 'cuti', 'resign'];
const ROLES = ['kasir', 'kurir'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.round(n) : 0; };
const dateOrNull = (v) => { const s = String(v ?? '').slice(0, 10); return DATE_RE.test(s) ? s : null; };
const textOrNull = (v) => { const s = String(v ?? '').trim(); return s ? s : null; };

export function parseBackupEmployees(json) {
  const list = Array.isArray(json) ? json : json?.employees;
  if (!Array.isArray(list)) {
    throw new Error('File ini tidak berisi data karyawan. Pakai file backup JSON dari mamam-global (menu Backup → Export JSON).');
  }

  const skipped = [];
  const byExternalId = new Map();
  const noExternalId = [];

  for (const item of list) {
    if (!item || typeof item !== 'object') { skipped.push({ name: '(baris rusak)', reason: 'bukan data karyawan' }); continue; }
    const name = String(item.name ?? '').trim();
    if (!name) { skipped.push({ name: '(tanpa nama)', reason: 'nama kosong' }); continue; }
    if (item.deletedAt) { skipped.push({ name, reason: 'sudah dihapus di mamam-global' }); continue; }

    const status = STATUSES.includes(item.status) ? item.status : 'aktif';
    const role = ROLES.includes(String(item.role ?? '').toLowerCase()) ? String(item.role).toLowerCase() : 'kasir';
    const row = {
      external_id: textOrNull(item.id),
      name,
      phone: textOrNull(item.phone),
      address: textOrNull(item.address),
      status,
      role,
      wage_per_hour: num(item.hourlyRate),
      bonus_full_time: num(item.fullTimeBonus),
      overtime_rate_per_30_min: num(item.overtimeRate30) || OVERTIME_RATE_PER_30MIN,
      start_date: dateOrNull(item.startDate),
      resign_date: status === 'resign' ? dateOrNull(item.resignDate) : null,
    };
    // id lama ganda di dalam file yang sama: yang terakhir menang
    if (row.external_id) byExternalId.set(row.external_id, row); else noExternalId.push(row);
  }
  return { rows: [...byExternalId.values(), ...noExternalId], skipped };
}
