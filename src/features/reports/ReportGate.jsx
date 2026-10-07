import { Card, Button } from '../../components/ui';

/**
 * ReportGate — tampilan gagal-muat / sedang-memuat yang sama untuk semua tab
 * Laporan. Isi tab (children) baru tampil kalau data sudah siap.
 */
export default function ReportGate({ loading, error, reload, children }) {
  if (error) {
    return (
      <Card className="text-center space-y-2">
        <p className="text-sm font-semibold text-red-500">Gagal memuat laporan</p>
        <p className="text-xs text-slate-400">{error}</p>
        <Button onClick={reload}>Coba Lagi</Button>
      </Card>
    );
  }
  if (loading) return <div className="text-center text-sm text-slate-400 dark:text-slate-500 py-8">Memuat laporan...</div>;
  return children;
}
