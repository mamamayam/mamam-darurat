/**
 * Opsi karyawan — nilainya SAMA dengan mamam-global (payrollLogic.js) dan
 * cocok dengan model HRD mamam-kasir:
 *  - status: aktif | freelance | cuti | resign (sama persis di A dan B)
 *  - role  : disimpan huruf kecil seperti A ('kasir' | 'kurir').
 *            B memakai NAMA role ('Kasir'/'Kurir'/'Manajer'); saat migrasi
 *            cukup di-map (huruf pertama kapital). 'Manajer' baru ada di B
 *            dan terkait level izin, jadi belum dipakai di C (belum ada login).
 *  - tarif lembur bawaan 5.000 per 30 menit (sama dengan B: defaultOvertimeRatePer30Min)
 */
export const EMPLOYEE_STATUS_OPTIONS = [
  { value: 'aktif', label: 'Aktif', badgeVariant: 'success' },
  { value: 'freelance', label: 'Freelance', badgeVariant: 'info' },
  { value: 'cuti', label: 'Cuti', badgeVariant: 'warning' },
  { value: 'resign', label: 'Resign', badgeVariant: 'neutral' },
];

export const EMPLOYEE_ROLE_OPTIONS = [
  { value: 'kasir', label: 'Kasir', badgeVariant: 'info' },
  { value: 'kurir', label: 'Kurir', badgeVariant: 'warning' },
];

export const OVERTIME_RATE_PER_30MIN = 5000;

export const statusInfo = (v) => EMPLOYEE_STATUS_OPTIONS.find(s => s.value === v) || EMPLOYEE_STATUS_OPTIONS[0];
export const roleInfo = (v) => EMPLOYEE_ROLE_OPTIONS.find(r => r.value === v) || EMPLOYEE_ROLE_OPTIONS[0];
