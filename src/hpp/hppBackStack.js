import { useEffect, useRef, useSyncExternalStore } from 'react'
import { createBackStack } from '../lib/backStack'

/**
 * Stack navigasi HPP: tombol Back browser/HP (dan geser-mundur) menutup "lapisan" teratas, bukan langsung keluar.
 * Lapisan = popup (Sheet) dan tab selain Menu. Urutan tutup: yang terakhir dibuka ditutup duluan.
 *
 * Memakai mesin yang sama dengan POS (`createBackStack`, tanpa React dan tanpa kode POS), tetapi dengan
 * instance SENDIRI. Seperti di Beranda POS, Back dari Menu (tanpa lapisan terbuka) TIDAK langsung keluar:
 * pertama muncul notif "Tekan Back lagi untuk kembali ke POS" (`useExitHint` + `NotifKeluar` di ui.jsx),
 * Back kedua dalam 2 detik meninggalkan HPP. HPP dibuka dari POS di tab yang sama (`leaveForHref`), jadi
 * keluar dari HPP = kembali ke POS.
 *
 * JANGAN mengimpor singleton `backStack` dari lib/backStack: itu milik POS.
 */
export const buatBackStackHpp = (win, opsi) => createBackStack(win, opsi)

export const hppBackStack = buatBackStackHpp(typeof window !== 'undefined' ? window : null)

/** true selama notif "Tekan Back lagi untuk kembali ke POS" harus tampil (padam sendiri kalau tidak ada Back kedua). */
export function useExitHint(stack = hppBackStack) {
  return useSyncExternalStore(stack.subscribeExitHint, stack.getExitHint, () => false)
}

/**
 * useBackLayer(aktif, onBack): selama `aktif`, Back memanggil `onBack` (menutup lapisan ini).
 * `onBack` tidak perlu di-memoize; versi terbaru selalu dipakai. Pasang di komponen popup / tab.
 */
export function useBackLayer(aktif, onBack, stack = hppBackStack) {
  const terbaru = useRef(onBack)
  useEffect(() => { terbaru.current = onBack })

  useEffect(() => {
    if (!aktif) return undefined
    const id = stack.register(() => terbaru.current?.())
    return () => stack.unregister(id)
  }, [aktif, stack])
}

/**
 * Jalankan `fn` (mis. mengganti alamat dengan replaceState) SETELAH stack selesai menyamakan entri riwayat dengan
 * lapisan. Kalau dijalankan lebih awal, yang diganti adalah entri di BAWAH lapisan baru (entri lapisan baru didorong
 * sesudahnya), sehingga alamat entri itu tertinggal salah setelah Back. Menunggu paling lama ~0,5 detik.
 */
export function setelahSinkron(fn, stack = hppBackStack, coba = 20) {
  const jalan = () => {
    const s = stack.snapshot()
    if (!s.traversing && s.depth === s.layers) { fn(); return }
    if (coba > 0) { coba -= 1; setTimeout(jalan, 25) }
  }
  queueMicrotask(jalan)
}
