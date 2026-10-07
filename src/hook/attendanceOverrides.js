import { supabase } from '../lib/supabase';

/**
 * Koreksi absensi oleh owner (tabel attendance_overrides di project C).
 * Satu baris = satu karyawan + satu tanggal; MENGGANTIKAN log absensi hari itu.
 * Tidak pernah menulis ke sistem absensi (itu baca-saja).
 */
const day = (v) => String(v).slice(0, 10);
const fail = (error, aksi) => { throw new Error(`${aksi}: ${error.message}`); };

export const toOverride = (r) => ({
  employeeId: r.employee_id, date: day(r.date), libur: !!r.libur,
  masuk: r.masuk || '', pulang: r.pulang || '',
  bolongs: Array.isArray(r.bolongs) ? r.bolongs : [], note: r.note || '',
});

export async function fetchOverrides(start, end) {
  const { data, error } = await supabase.from('attendance_overrides').select('*').gte('date', start).lte('date', end);
  if (error) fail(error, 'Gagal membaca koreksi absensi');
  return (data || []).map(toOverride);
}

export async function saveOverride({ employeeId, date, libur, masuk, pulang, bolongs, note }) {
  const row = {
    employee_id: employeeId, date, libur: !!libur,
    masuk: libur ? null : (masuk || null), pulang: libur ? null : (pulang || null),
    bolongs: libur ? [] : (bolongs || []).filter(b => b.from).map(b => ({ from: b.from, to: b.to || '' })),
    note: String(note || '').trim() || null, updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('attendance_overrides').upsert(row, { onConflict: 'employee_id,date' });
  if (error) fail(error, 'Gagal menyimpan koreksi');
}

export async function deleteOverride(employeeId, date) {
  const { error } = await supabase.from('attendance_overrides').delete().eq('employee_id', employeeId).eq('date', date);
  if (error) fail(error, 'Gagal mengembalikan data absensi');
}
