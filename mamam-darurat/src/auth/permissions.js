/**
 * Izin per peran. SATU-SATUNYA tempat yang menentukan siapa boleh apa — ubah
 * di sini untuk menyesuaikan. Izin yang tidak terdaftar DITOLAK untuk semua
 * peran (aman secara bawaan).
 *
 * Prinsip: semua orang bisa membuka aplikasi dan bekerja (kasir, dompet,
 * pelanggan, absensi, catat pengeluaran). Owner-only hanya hal yang
 * menyangkut laba, gaji, upah, HPP, dan aksi yang menghapus/mengubah uang.
 */
export const ROLES = ['owner', 'staff'];

export const PERMISSIONS = {
  'screen.penggajian': ['owner'],        // layar Penggajian (gaji semua karyawan)
  'screen.menu': ['owner'],              // layar Manajemen Menu (ubah harga & HPP)
  'screen.riwayat': ['owner'],           // layar Riwayat (daftar semua transaksi)
  'screen.laporan': ['owner'],           // layar Laporan (Laba Rugi, Rincian Pengeluaran)
  'laporan.rincianPengeluaran': ['owner'], // tab Rincian Pengeluaran di Laporan
  'laporan.labaKotor': ['owner'],        // kartu Laba Kotor di tab Laba Rugi
  'laporan.hapusTransaksi': ['owner'],   // tombol hapus transaksi di Riwayat
  'beranda.laba': ['owner'],             // kartu Laba Kotor di Beranda
  'pengeluaran.ubah': ['owner'],         // edit & hapus pengeluaran (mencatat baru boleh semua)
  'karyawan.kelola': ['owner'],          // tambah/edit/hapus/impor karyawan
  'karyawan.upah': ['owner'],            // melihat upah, bonus, tarif lembur
  'absensi.edit': ['owner'],             // mengoreksi jam absen (disimpan di C, bukan di sistem absensi)
};

/** Layar yang butuh izin tertentu untuk dibuka (id layar -> izin). */
export const VIEW_PERMISSION = {
  penggajian: 'screen.penggajian',
  menu: 'screen.menu',
  riwayat: 'screen.riwayat',
  laporan: 'screen.laporan',
};

export const can = (role, permission) =>
  ROLES.includes(role) && (PERMISSIONS[permission] || []).includes(role);

export const canOpenView = (role, viewId) => !VIEW_PERMISSION[viewId] || can(role, VIEW_PERMISSION[viewId]);

export const roleLabel = (role) => (role === 'owner' ? 'Owner' : role === 'staff' ? 'Staf' : '');
