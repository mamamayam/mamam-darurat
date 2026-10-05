import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, AlertTriangle, Plus, Trash2, Wallet, RefreshCw, Info, Lock } from 'lucide-react';
import { Card, Button, Input, Select, Badge, Modal, EmptyState, SegmentedControl } from '../../components/ui';
import { useAppContext } from '../../context/AppContext';
import { usePayrollData } from '../../hook/usePayrollData';
import { weekPeriodForDate, shiftWeek, monthPeriod, parseIsoDate, formatIsoDate } from './payrollEngine';
import { toLocalDateString } from '../../utils/formatters';
import AbsensiSetupCard from './AbsensiSetupCard';

/**
 * PayrollView — Penggajian. Semua angka dihitung payrollEngine (aturan sama
 * dengan mamam-kasir) dari absensi yang DIBACA dari sistem absensi. Layar ini
 * hanya menampilkan dan mencatat tambahan/potongan/saldo awal.
 */

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MON_FULL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const fmtDay = (iso) => `${Number(iso.slice(8, 10))} ${MON[Number(iso.slice(5, 7)) - 1]}`;
const fmtDayYear = (iso) => `${fmtDay(iso)} ${iso.slice(0, 4)}`;
const fmtHM = (min) => `${Math.floor(min / 60)}j ${String(min % 60).padStart(2, '0')}m`;
const clamp = (iso, a, b) => (iso < a ? a : iso > b ? b : iso);

const STATUS_LABEL = { hadir: 'Hadir', libur: 'Libur', belumAbsen: 'Belum absen', belumPulang: 'Belum pulang', perluKlarifikasi: 'Perlu klarifikasi' };
const STATUS_VARIANT = { hadir: 'success', libur: 'neutral', belumAbsen: 'neutral', belumPulang: 'warning', perluKlarifikasi: 'danger' };

const ADD_CATEGORIES = ['Bonus', 'THR', 'Tambahan'];
const DED_CATEGORIES = ['Kasbon', 'Denda', 'Potongan'];

const shiftMonth = (key, delta) => {
  const d = new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1 + delta, 1));
  return formatIsoDate(d).slice(0, 7);
};

export default function PayrollView() {
  const { formatRupiah, triggerAlert, triggerConfirm } = useAppContext();

  const today = toLocalDateString();
  const [mode, setMode] = useState('minggu');
  const [anchor, setAnchor] = useState(today);          // tanggal di dalam minggu yang dilihat
  const [month, setMonth] = useState(today.slice(0, 7));
  const period = useMemo(() => (mode === 'minggu' ? weekPeriodForDate(anchor) : monthPeriod(month)), [mode, anchor, month]);

  const data = usePayrollData({ period });
  const { loading, error, attendance, status, isLocked, closing, closeBlockers, results, totals } = data;

  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ type: 'potongan', label: '', amount: '', date: '', category: 'Kasbon' });
  const [openingInput, setOpeningInput] = useState('');

  const run = async (fn) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } catch (e) { triggerAlert(e.message || 'Terjadi kesalahan.'); }
    finally { setBusy(false); }
  };

  const goPrev = () => (mode === 'minggu' ? setAnchor(shiftWeek(period, -7).start) : setMonth(shiftMonth(month, -1)));
  const goNext = () => (mode === 'minggu' ? setAnchor(shiftWeek(period, 7).start) : setMonth(shiftMonth(month, 1)));
  const goToday = () => { setAnchor(today); setMonth(today.slice(0, 7)); };
  const label = mode === 'minggu'
    ? `${fmtDay(period.start)} – ${fmtDayYear(period.end)}`
    : `${MON_FULL[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

  const selected = results.find(r => r.employee.id === selectedId) || null;
  const openDetail = (r) => {
    setSelectedId(r.employee.id);
    setForm({ type: 'potongan', label: '', amount: '', date: clamp(today, period.start, period.end), category: 'Kasbon' });
    setOpeningInput(String(r.payroll.openingBalance || ''));
  };

  const handleAdd = () => run(async () => {
    const f = { employeeId: selected.employee.id, label: form.label, amount: form.amount, date: form.date, category: form.category };
    if (form.type === 'tambahan') await data.addAddition(f); else await data.addDeduction(f);
    setForm(prev => ({ ...prev, label: '', amount: '' }));
  });

  const handleDeleteItem = (kind, item) => {
    triggerConfirm(`Hapus "${item.label}" (${formatRupiah(item.amount)})?`, () =>
      run(() => (kind === 'tambahan' ? data.deleteAddition(item.id) : data.deleteDeduction(item.id))));
  };

  const handleSaveOpening = () => run(async () => {
    await data.setOpeningBalance(selected.employee.id, openingInput === '' ? 0 : Number(openingInput));
    triggerAlert('Saldo awal disimpan.');
  });

  const handleClose = () => {
    const note = warnings.length ? `\n\nPerhatian: masih ada ${warnings.length} peringatan data (lihat kotak kuning di atas).` : '';
    triggerConfirm(`Tutup periode ${label}? Angka gaji ${results.length} karyawan (total ${formatRupiah(totals.net)}) dibekukan: perubahan upah atau absensi setelah ini tidak mengubahnya, dan tambahan/potongan di periode ini jadi terkunci. Bisa dibuka kembali kalau perlu koreksi.${note}`,
      () => run(async () => { await data.closePeriod(); triggerAlert('Periode ditutup. Angka gaji sudah dibekukan.'); }));
  };
  const handleReopen = () => {
    triggerConfirm(`Buka kembali periode ${label}? Angka beku dihapus dan gaji dihitung ulang dari data terbaru (tarif karyawan sekarang). Pakai ini hanya untuk koreksi.`,
      () => run(async () => { setSelectedId(null); await data.reopenPeriod(); }));
  };

  const info = attendance.data;
  const warnings = [];
  if (info) {
    if (info.unknownEmployees.length) warnings.push(`Absensi dari ${info.unknownEmployees.length} orang belum ada di daftar Karyawan (${info.unknownEmployees.slice(0, 4).map(u => u.name).join(', ')}${info.unknownEmployees.length > 4 ? ', dst' : ''}). Impor dari mamam-global atau tambahkan ID Absensi-nya, kalau tidak gaji mereka tidak terhitung.`);
    if (info.withoutExternalId.length) warnings.push(`Belum punya ID Absensi, jadi absensinya tidak bisa dicocokkan: ${info.withoutExternalId.join(', ')}.`);
    if (info.staleLiburIgnored) warnings.push(`${info.staleLiburIgnored} catatan "libur" otomatis diabaikan karena karyawannya ternyata masuk hari itu.`);
    if (info.duplicatePulangIgnored) warnings.push(`${info.duplicatePulangIgnored} catatan pulang ganda diabaikan (dipakai yang terakhir).`);
    if (info.skippedInvalid) warnings.push(`${info.skippedInvalid} baris absensi rusak dilewati.`);
  }
  const clarifyCount = results.reduce((s, r) => s + r.needsClarification.length, 0);

  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 flex-1 flex flex-col h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
      <div className="max-w-3xl w-full space-y-4 pb-10">

        <Card className="space-y-3">
          <SegmentedControl value={mode} onChange={setMode} options={[{ value: 'minggu', label: 'Mingguan (Jum–Kam)' }, { value: 'bulan', label: 'Bulanan' }]} />
          <div className="flex items-center justify-between gap-2">
            <button onClick={goPrev} aria-label="Sebelumnya" className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 active:scale-95 transition-all"><ChevronLeft className="w-4 h-4" /></button>
            <div className="text-center min-w-0">
              <p className="font-heading font-black text-slate-800 dark:text-slate-100 text-sm truncate" data-testid="period-label">{label}</p>
              <button onClick={goToday} className="text-[11px] font-bold text-accent-600 dark:text-accent-400">Ke hari ini</button>
            </div>
            <button onClick={goNext} aria-label="Berikutnya" className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 active:scale-95 transition-all"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </Card>

        {status === 'not-configured' && <AbsensiSetupCard />}

        {loading && status !== 'not-configured' && <div className="text-center text-sm text-slate-400 dark:text-slate-500 py-10">Memuat gaji...</div>}
        {error && (
          <Card className="text-center space-y-2">
            <p className="text-sm font-semibold text-red-500">Gagal memuat data</p><p className="text-xs text-slate-400 max-w-xs mx-auto">{error}</p>
            <Button onClick={data.reload} icon={<RefreshCw className="w-4 h-4" />}>Coba Lagi</Button>
          </Card>
        )}
        {status === 'error' && (
          <Card className="text-center space-y-2 border-2 border-red-200 dark:border-red-500/30">
            <p className="text-sm font-semibold text-red-500">Absensi gagal dibaca</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">{attendance.error}</p>
            <p className="text-[11px] text-slate-400">Gaji tidak ditampilkan supaya tidak ada angka Rp 0 yang menyesatkan.</p>
            <Button onClick={data.reload} icon={<RefreshCw className="w-4 h-4" />}>Coba Lagi</Button>
          </Card>
        )}
        {status === 'loading' && !loading && <div className="text-center text-sm text-slate-400 dark:text-slate-500 py-6">Membaca absensi...</div>}

        {(status === 'ready' || status === 'closed') && (
          <>
            {isLocked && (
              <Card className="space-y-2 border-2 border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-500/5">
                <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5"><Lock className="w-4 h-4" /> Periode ini sudah ditutup</p>
                <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80" data-testid="closed-info">Ditutup {new Date(closing.closed_at).toLocaleString('id-ID')}. Angka di bawah dibekukan: mengubah upah karyawan atau data absensi tidak mengubahnya, dan tambahan/potongan di periode ini terkunci.</p>
                <Button variant="secondary" size="sm" onClick={handleReopen} disabled={busy}>Buka Kembali</Button>
              </Card>
            )}
            {(warnings.length > 0 || clarifyCount > 0) && (
              <Card className="space-y-2 border border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5">
                {clarifyCount > 0 && (
                  <p className="text-xs font-bold text-red-600 dark:text-red-400 flex items-start gap-1.5"><AlertTriangle className="w-4 h-4 shrink-0" />{clarifyCount} hari perlu klarifikasi (bolong belum selesai) dan BELUM dibayar. Buka karyawan yang bertanda merah.</p>
                )}
                {warnings.map((w, i) => <p key={i} className="text-xs text-amber-800 dark:text-amber-300 flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{w}</p>)}
              </Card>
            )}

            <Card variant="dark" padding="lg" className="space-y-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Gaji Bersih Periode Ini</p>
                <p className="font-heading text-3xl font-black text-white" data-testid="total-net">{formatRupiah(totals.net)}</p>
              </div>
              <div className="grid grid-cols-1 gap-y-1.5 text-xs">
                {[['Upah', totals.wage], ['Lembur', totals.overtime], ['Bonus Full Time', totals.fullTime], ['Tambahan', totals.additions], ['Potongan', -totals.deductions], ...(period.monthKey ? [['Saldo Awal', -totals.openingBalance]] : [])].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-slate-300"><span>{k}</span><span className="font-bold text-white">{formatRupiah(v)}</span></div>
                ))}
              </div>
            </Card>

            {results.length === 0 ? (
              <EmptyState icon={<Wallet className="w-12 h-12" />} title="Belum ada karyawan. Tambah atau impor di menu Karyawan." />
            ) : results.map(r => {
              const a = r.payroll.attendance;
              return (
                <button key={r.employee.id} onClick={() => openDetail(r)} data-testid={`emp-${r.employee.name}`}
                  className={`w-full text-left bg-white dark:bg-slate-900 rounded-2xl border p-4 active:scale-[0.99] transition-all ${r.needsClarification.length ? 'border-red-300 dark:border-red-500/40' : 'border-slate-100 dark:border-slate-800'}`}>
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <p className="font-heading font-bold text-slate-800 dark:text-slate-100 truncate">{r.employee.name}</p>
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        <Badge size="sm" variant="neutral">{a.hadirDays} hari hadir</Badge>
                        <Badge size="sm" variant="info">{fmtHM(a.totalWorkedMinutes)}</Badge>
                        {a.totalOvertimeMinutes > 0 && <Badge size="sm" variant="warning">lembur {a.totalOvertimeMinutes} mnt</Badge>}
                        {r.needsClarification.length > 0 && <Badge size="sm" variant="danger">perlu klarifikasi</Badge>}
                      </div>
                    </div>
                    <p className={`font-heading font-black text-base shrink-0 ${r.payroll.netPay < 0 ? 'text-red-500' : 'text-accent-600 dark:text-accent-400'}`}>{formatRupiah(r.payroll.netPay)}</p>
                  </div>
                </button>
              );
            })}

            {status === 'ready' && (closeBlockers.length > 0 ? (
              <Card className="space-y-1.5" data-testid="close-blockers">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Belum bisa ditutup</p>
                {closeBlockers.map((b, i) => <p key={i} className="text-xs text-slate-500 dark:text-slate-400">• {b}</p>)}
              </Card>
            ) : (
              <Button size="full" variant="dark" icon={<Lock className="w-4 h-4" />} onClick={handleClose} disabled={busy}>Tutup Periode &amp; Bekukan Angka</Button>
            ))}
          </>
        )}
      </div>

      <Modal isOpen={!!selected} onClose={() => setSelectedId(null)} sheet size="lg" maxHeight title={selected ? selected.employee.name : ''}>
        {selected && (() => {
          const p = selected.payroll, a = p.attendance;
          return (
            <div className="p-5 space-y-5 text-sm">
              <div className="space-y-1.5">
                <Row k={`Upah (${fmtHM(a.totalWorkedMinutes)})`} v={a.wagePay} f={formatRupiah} />
                <Row k={`Lembur (${a.totalOvertimeMinutes} mnt → ${a.overtimeBlocks30Min} blok × ${formatRupiah(a.overtimeRate)})`} v={a.overtimePay} f={formatRupiah} />
                <Row k={`Bonus Full Time (${a.fullTimeDays} hari)`} v={a.fullTimeBonusPay} f={formatRupiah} />
                <Row k="Tambahan" v={p.additionsTotal} f={formatRupiah} />
                <Row k="Potongan" v={-p.deductionsTotal} f={formatRupiah} />
                {period.monthKey && <Row k="Saldo awal" v={-p.openingBalance} f={formatRupiah} />}
                <div className="flex justify-between font-black text-base pt-2 border-t border-slate-200 dark:border-slate-700"><span>Gaji Bersih</span><span className={p.netPay < 0 ? 'text-red-500' : 'text-accent-600 dark:text-accent-400'}>{formatRupiah(p.netPay)}</span></div>
              </div>

              {selected.needsClarification.length > 0 && (
                <p className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-xl p-3">Ada {selected.needsClarification.length} hari dengan bolong yang belum selesai ({selected.needsClarification.map(d => `${fmtDay(d.date)} jam ${d.stuckBolongTime}`).join(', ')}). Hari itu belum dibayar sampai ada masuk-lagi atau harinya lewat.</p>
              )}

              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Rincian Harian</p>
                {a.dayRows.length === 0 ? <p className="text-xs text-slate-400">Tidak ada absensi pada periode ini.</p> : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {a.dayRows.map(d => (
                      <div key={d.date} className="py-2 flex justify-between items-center gap-2 text-xs" data-testid="day-row">
                        <div className="min-w-0"><span className="font-bold text-slate-700 dark:text-slate-200">{fmtDay(d.date)}</span> <Badge size="sm" variant={STATUS_VARIANT[d.status]}>{STATUS_LABEL[d.status]}</Badge>
                          {d.effectiveFromBolong && <span className="text-[10px] text-amber-600 ml-1">bolong dianggap pulang</span>}</div>
                        {d.status === 'hadir' && <div className="text-right text-slate-500 dark:text-slate-400 shrink-0">{fmtHM(d.workedMinutes)}{d.overtimeMinutes > 0 && ` · lembur ${d.overtimeMinutes}m`}{d.bolongMinutes > 0 && ` · bolong ${d.bolongMinutes}m`}{d.fullTimeBonus && ' · FT'}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Tambahan & Potongan</p>
                {[...p.additions.map(x => ['tambahan', x]), ...p.deductions.map(x => ['potongan', x])].map(([kind, it]) => (
                  <div key={kind + it.id} className="flex justify-between items-center gap-2 bg-slate-50 dark:bg-slate-950 rounded-xl p-2.5 text-xs" data-testid="adj-row">
                    <div className="min-w-0"><Badge size="sm" variant={kind === 'tambahan' ? 'success' : 'danger'}>{it.category}</Badge> <span className="font-semibold">{it.label}</span> <span className="text-slate-400">{fmtDay(it.date)}</span></div>
                    <div className="flex items-center gap-1.5 shrink-0"><span className={`font-bold ${kind === 'tambahan' ? 'text-emerald-600' : 'text-red-500'}`}>{kind === 'tambahan' ? '+' : '-'}{formatRupiah(it.amount)}</span>
                      {!isLocked && <button aria-label="Hapus" onClick={() => handleDeleteItem(kind, it)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>}</div>
                  </div>
                ))}
                {isLocked ? (
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-3 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 shrink-0" /> Periode ditutup, jadi tambahan dan potongan tidak bisa diubah.</p>
                ) : (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                  <SegmentedControl value={form.type} onChange={(v) => setForm({ ...form, type: v, category: v === 'tambahan' ? ADD_CATEGORIES[0] : DED_CATEGORIES[0] })}
                    options={[{ value: 'potongan', label: 'Potongan' }, { value: 'tambahan', label: 'Tambahan' }]} />
                  <Select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                    {(form.type === 'tambahan' ? ADD_CATEGORIES : DED_CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
                  </Select>
                  <Input placeholder="Keterangan" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} />
                  <Input type="number" placeholder="Nominal" icon={<span className="font-bold">Rp</span>} value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
                  <Input type="date" value={form.date} min={period.start} max={period.end} onChange={e => setForm({ ...form, date: e.target.value })} />
                  <Button size="full" onClick={handleAdd} disabled={busy} icon={<Plus className="w-4 h-4" />}>{busy ? 'Menyimpan...' : `Tambah ${form.type === 'tambahan' ? 'Tambahan' : 'Potongan'}`}</Button>
                  <p className="text-[10px] text-slate-400">Kasbon otomatis dari fitur Karyawan menyusul. Sementara, catat sebagai Potongan kategori Kasbon.</p>
                </div>
                )}
              </div>

              {period.monthKey && !isLocked && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Saldo Awal Bulan</p>
                  <p className="text-[11px] text-slate-400">Positif = karyawan berutang ke toko (mengurangi gaji). Negatif = toko berutang (menambah gaji). Kosong/0 = tidak ada.</p>
                  <div className="flex gap-2">
                    <div className="flex-1"><Input type="number" placeholder="0" icon={<span className="font-bold">Rp</span>} value={openingInput} onChange={e => setOpeningInput(e.target.value)} /></div>
                    <Button variant="secondary" onClick={handleSaveOpening} disabled={busy}>Simpan</Button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

function Row({ k, v, f }) {
  return <div className="flex justify-between gap-3"><span className="text-slate-500 dark:text-slate-400">{k}</span><span className="font-bold text-slate-800 dark:text-slate-100 shrink-0">{f(v)}</span></div>;
}
