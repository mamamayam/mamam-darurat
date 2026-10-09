/**
 * Button — komponen tombol global. Cara BAKU membuat tombol aksi di seluruh app
 * (jangan menulis <button> dengan warna/gradient sendiri). Pilihan (chip/toggle),
 * stepper, dan ikon tutup yang bukan tombol aksi boleh tetap <button> biasa.
 *
 * SKALA PRIORITAS — semua layar mengikuti ini, tidak ada warna lain:
 *   primary    → aksi UTAMA di area itu: Simpan, Tambah X, Bayar, Setujui, Selesaikan.
 *                Oranye gradient (warna tema). Satu area, satu primary.
 *   secondary  → aksi PENDUKUNG: Batal, Tutup, Detail, Tolak, Pasang, tombol kecil di
 *                samping input. Netral (abu).
 *   danger     → HANYA aksi merusak: Hapus, Kirim Penolakan. Merah gradient.
 *                Jangan dipakai untuk "Tambah" atau "Selesaikan" cuma karena ingin menarik mata.
 *
 * Varian lain (success, dark, ghost, ghost-danger, ghost-success) sudah dihapus. Tes penjaga:
 * buttonStandard.test.js (gagal kalau ada komponen Button dengan prop variant di luar tiga di atas).
 *
 * Props:
 *   variant   'primary' | 'secondary' | 'danger'      default: 'primary'
 *   size      'xs' | 'sm' | 'md' | 'lg' | 'full'      default: 'md'
 *   disabled  boolean
 *   loading   boolean  — tampilkan spinner, disable klik
 *   icon      ReactNode — icon di kiri label
 *   iconRight ReactNode — icon di kanan label
 *   onClick, type, className, children, ...rest
 *
 * Size (bentuk sama semua: rounded-2xl):
 *   xs   → px-3 py-1.5 text-xs  — aksi kecil di dalam baris
 *   sm   → px-3 py-2   text-xs  — aksi inline / di samping input
 *   md   → px-4 py-2.5 text-sm  — default
 *   lg   → px-8 py-3.5 text-sm  — CTA modal
 *   full → w-full py-3.5 text-sm — lebar penuh (modal / form submit / tile)
 *
 * Contoh:
 *   <Button>Simpan</Button>
 *   <Button variant="secondary" onClick={onClose}>Batal</Button>
 *   <Button variant="danger" size="sm" icon={<Trash2 className="w-3.5 h-3.5" />}>Hapus</Button>
 *   <Button icon={<Plus className="w-4 h-4" />}>Tambah Karyawan</Button>
 *   <Button size="full" loading={isSaving}>Simpan Perubahan</Button>
 */

const VARIANTS = {
  // Gradient accent — senada tombol aktif Sidebar/BottomNav/FAB/PillTabs
  primary: `
    bg-gradient-to-r from-accent-600 to-accent-500 dark:from-accent-500 dark:to-accent-600 text-white
    hover:shadow-[0_6px_20px_rgba(var(--color-accent-500),0.35)] hover:-translate-y-0.5
    shadow-[0_4px_14px_rgba(var(--color-accent-500),0.25)]
  `,
  secondary: `
    bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200
    hover:bg-slate-200 dark:hover:bg-slate-700
  `,
  danger: `
    bg-gradient-to-r from-red-600 to-red-500 dark:from-red-500 dark:to-red-600 text-white
    hover:shadow-[0_6px_20px_rgba(239,68,68,0.35)] hover:-translate-y-0.5
    shadow-[0_4px_14px_rgba(239,68,68,0.25)]
  `,
};

const SIZES = {
  xs:   'px-3 py-1.5 text-xs',
  sm:   'px-3 py-2 text-xs',
  md:   'px-4 py-2.5 text-sm',
  lg:   'px-8 py-3.5 text-sm',
  full: 'w-full py-3.5 text-sm',
};

export default function Button({
  variant  = 'primary',
  size     = 'md',
  disabled = false,
  loading  = false,
  icon,
  iconRight,
  onClick,
  type     = 'button',
  className = '',
  children,
  ...rest
}) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={`
        inline-flex items-center justify-center gap-2
        font-bold rounded-2xl transition-all duration-300
        active:scale-[0.98]
        disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none disabled:active:scale-100
        ${VARIANTS[variant] ?? VARIANTS.primary}
        ${SIZES[size]       ?? SIZES.md}
        ${className}
      `}
      {...rest}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : icon}
      {children}
      {!loading && iconRight}
    </button>
  );
}
