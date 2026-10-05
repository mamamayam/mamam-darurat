import { CheckCircle2, X } from 'lucide-react';
import useBackLayer from '../../hook/useBackLayer';

/**
 * ReceiptModal — versi ringkas untuk gelombang 1. Menampilkan ringkasan
 * transaksi yang baru selesai (hasil dari checkout()). Tidak ada
 * cetak/share PDF di sini (belum diminta); kasir cukup melihat konfirmasi
 * lalu lanjut transaksi berikutnya.
 */
export default function ReceiptModal({ result, onClose, formatRupiah }) {
  useBackLayer(Boolean(result), onClose);

  if (!result) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl p-6 text-center animate-in zoom-in-95 duration-300">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="w-5 h-5" /></button>
        <CheckCircle2 className="w-14 h-14 text-emerald-500 dark:text-emerald-400 mx-auto mb-3" />
        <h2 className="font-heading text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Transaksi Berhasil</h2>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">#{result.display_number}</p>
        <div className="text-left space-y-1.5 text-sm bg-slate-50 dark:bg-slate-950 rounded-2xl p-4 mb-4">
          <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>Metode</span><span className="font-semibold text-slate-800 dark:text-slate-100">{result.paymentMethod}</span></div>
          <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>Total</span><span className="font-semibold text-slate-800 dark:text-slate-100">{formatRupiah(result.total)}</span></div>
          {result.amount_paid != null && (
            <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>Dibayar</span><span className="font-semibold text-slate-800 dark:text-slate-100">{formatRupiah(result.amount_paid)}</span></div>
          )}
          {result.change_amount > 0 && (
            <div className="flex justify-between font-bold text-emerald-600 dark:text-emerald-400"><span>Kembalian</span><span>{formatRupiah(result.change_amount)}</span></div>
          )}
        </div>
        <button onClick={onClose} className="w-full py-3 rounded-xl bg-accent-600 dark:bg-accent-500 text-white font-bold hover:bg-accent-700 dark:hover:bg-accent-600 transition-colors">Transaksi Baru</button>
      </div>
    </div>
  );
}
