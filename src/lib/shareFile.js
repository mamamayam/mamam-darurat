/**
 * shareFile — bagikan berkas lewat menu share bawaan HP (WhatsApp, Drive, dst).
 * Kalau perangkat tidak mendukung share berkas (mis. desktop), berkas diunduh biasa.
 *
 * Mengembalikan 'shared' | 'cancelled' | 'downloaded'. Pembatalan oleh pengguna BUKAN error.
 */
export async function shareOrDownloadFile(bytes, filename, { mime = 'application/pdf', title = filename } = {}) {
  const file = new File([bytes], filename, { type: mime });
  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
      // gagal selain dibatalkan: lanjut unduh biasa
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'downloaded';
}
