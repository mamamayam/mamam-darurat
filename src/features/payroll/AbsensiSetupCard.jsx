import { Info } from 'lucide-react';
import { Card } from '../../components/ui';

/** Petunjuk menyambungkan sumber absensi (dipakai Penggajian dan Absensi). */
export default function AbsensiSetupCard() {
  return (
    <Card className="space-y-3 border-2 border-amber-200 dark:border-amber-500/30">
      <div className="flex items-start gap-2">
        <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-sm text-slate-800 dark:text-slate-100">Sumber absensi belum tersambung</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Data absensi dibaca dari sistem absensi (project Supabase lama). Isi dua baris ini di file <span className="font-mono font-bold">.env.local</span> (jangan ditempel di chat), lalu jalankan ulang <span className="font-mono font-bold">npm run dev</span>. Di Vercel, isi di Environment Variables lalu redeploy.</p>
        </div>
      </div>
      <pre className="text-xs leading-relaxed bg-slate-100 dark:bg-slate-900 rounded-xl p-3 overflow-x-auto text-slate-700 dark:text-slate-300">{`VITE_ABSENSI_SUPABASE_URL=https://xxxx.supabase.co\nVITE_ABSENSI_SUPABASE_ANON_KEY=eyJ...`}</pre>
      <p className="text-xs text-slate-400 dark:text-slate-500">Nilainya dari Project Settings → Data API di project Supabase yang dipakai web absensi. URL tanpa /rest/v1/. Aplikasi ini hanya MEMBACA dari sana.</p>
    </Card>
  );
}
