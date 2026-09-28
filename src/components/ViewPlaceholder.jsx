import React from 'react';
import { Construction } from 'lucide-react';

/**
 * Placeholder generik dipakai semua View gelombang 1 sebelum data layer
 * Supabase-nya ditulis. Sengaja polos — dihapus/diganti begitu tiap View
 * mulai diisi logic sungguhan.
 */
export default function ViewPlaceholder({ title, note }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-accent-50 dark:bg-accent-500/10 flex items-center justify-center">
        <Construction className="w-7 h-7 text-accent-500 dark:text-accent-400" />
      </div>
      <h2 className="font-heading font-bold text-lg text-slate-800 dark:text-slate-100">{title}</h2>
      {note && <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">{note}</p>}
    </div>
  );
}
