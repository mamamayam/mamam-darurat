// Format jam & tanggal untuk Header. Murni (tanpa React) supaya bisa dites.
// Sumber waktu = jam perangkat (zona waktu perangkat), lihat useNow di Header.jsx.

const dua = (n) => String(n).padStart(2, '0');

// "14:38:05" — dirakit manual dari getHours/getMinutes/getSeconds, bukan toLocaleTimeString,
// karena locale id-ID memakai titik ("14.38.05") dan sebagian mesin menulis tengah malam "24.00.00".
export function formatJam(date) {
    return `${dua(date.getHours())}:${dua(date.getMinutes())}:${dua(date.getSeconds())}`;
}

// "Jum, 9 Okt"
export function formatTanggal(date) {
    return date.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
}

// Berapa ms lagi menuju pergantian detik berikutnya (1..1000), supaya angka detik
// berganti tepat waktu dan tidak melenceng seiring berjalannya waktu.
export function msKeDetikBerikutnya(date) {
    return 1000 - date.getMilliseconds();
}
