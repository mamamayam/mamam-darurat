import { useState, useMemo } from 'react';
import { PillTabs } from '../../components/ui';
import { useAuth } from '../../auth/AuthContext';
import { periodRange } from './reportsMath';
import PeriodFilter from './PeriodFilter';
import LabaRugiTab from './LabaRugiTab';
import RincianPengeluaranTab from './RincianPengeluaranTab';

/**
 * ReportsView — Laporan. Dua tab dengan filter periode yang SAMA (Riwayat
 * transaksi punya layar sendiri: features/history/RiwayatView):
 *  - Laba Rugi: penjualan, laba kotor (penjualan − semua pengeluaran), pengeluaran,
 *    per metode bayar / tipe pesanan, menu terlaris.
 *  - Rincian Pengeluaran: total, per kategori, dan daftar semua pengeluaran.
 *    Hanya untuk yang berizin `laporan.rincianPengeluaran`.
 * Grafik tren dihilangkan (sama seperti di Beranda).
 */
export default function ReportsView() {
  const { can } = useAuth();
  const canRincian = can('laporan.rincianPengeluaran');
  const [tab, setTab] = useState('labarugi');
  const effectiveTab = tab === 'pengeluaran' && !canRincian ? 'labarugi' : tab;

  const [mode, setMode] = useState('hari-ini');
  const [custom, setCustom] = useState({ start: '', end: '' });
  const range = useMemo(() => periodRange(mode, custom), [mode, custom]);

  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 flex-1 flex flex-col h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
      <div className="max-w-3xl w-full space-y-4 pb-10">
        <PillTabs value={effectiveTab} onChange={setTab} options={[{ value: 'labarugi', label: 'Laba Rugi' }, ...(canRincian ? [{ value: 'pengeluaran', label: 'Rincian Pengeluaran' }] : [])]} />
        <PeriodFilter mode={mode} custom={custom} onModeChange={setMode} onCustomChange={setCustom} />
        {effectiveTab === 'pengeluaran' ? <RincianPengeluaranTab range={range} /> : <LabaRugiTab range={range} />}
      </div>
    </div>
  );
}
