import { Card, Input, Select } from '../../components/ui';

/**
 * PeriodFilter — filter periode Laporan (dipakai SEMUA tab supaya formatnya sama).
 * Nilai `mode` diterjemahkan jadi rentang tanggal oleh periodRange (reportsMath).
 */
export default function PeriodFilter({ mode, custom, onModeChange, onCustomChange }) {
  return (
    <Card className="space-y-2">
      <Select value={mode} onChange={e => onModeChange(e.target.value)}>
        <option value="hari-ini">Hari Ini</option><option value="kemarin">Kemarin</option><option value="bulan-ini">Bulan Ini</option>
        <option value="semua">Semua</option><option value="tanggal-terpilih">Tanggal Terpilih</option>
      </Select>
      {mode === 'tanggal-terpilih' && (
        <div className="flex items-center gap-2">
          <Input type="date" value={custom.start} max={custom.end || undefined} onChange={e => onCustomChange({ ...custom, start: e.target.value })} />
          <span className="text-slate-400">–</span>
          <Input type="date" value={custom.end} min={custom.start || undefined} onChange={e => onCustomChange({ ...custom, end: e.target.value })} />
        </div>
      )}
    </Card>
  );
}
