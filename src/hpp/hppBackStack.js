import { useEffect, useRef } from 'react'
import { createBackStack } from '../lib/backStack'

/**
 * Stack navigasi HPP: tombol Back browser/HP (dan geser-mundur) menutup "lapisan" teratas, bukan langsung keluar.
 * Lapisan = popup (Sheet) dan tab selain Menu. Urutan tutup: yang terakhir dibuka ditutup duluan.
 *
 * Memakai mesin yang sama dengan POS (`createBackStack`, tanpa React dan tanpa kode POS), tetapi dengan
 * instance SENDIRI dan `exitAnchor: false`: tidak ada jangkar dan tidak ada notif "ketuk lagi untuk keluar".
 * Back dari Menu (tanpa lapisan terbuka) langsung meninggalkan HPP. HPP dibuka dari POS di tab yang sama
 * (`leaveForHref`), jadi Back kembali ke POS.
 *
 * JANGAN mengimpor singleton `backStack` dari lib/backStack: itu milik POS (dengan jangkar dan notif keluar).
 */
export const buatBackStackHpp = (win) => createBackStack(win, { exitAnchor: false })

export const hppBackStack = buatBackStackHpp(typeof window !== 'undefined' ? window : null)

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
