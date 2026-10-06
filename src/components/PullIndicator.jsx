import { RefreshCw } from 'lucide-react';
import { PTR_THRESHOLD } from '../hook/usePullToRefresh';

/** Lingkaran kecil yang turun saat layar ditarik; berputar saat memuat ulang. */
export default function PullIndicator({ pull, dragging, refreshing }) {
  if (pull <= 0 && !refreshing) return null;
  const ready = pull >= PTR_THRESHOLD;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-0 right-0 top-0 z-30 flex justify-center"
      style={{
        transform: `translateY(${pull - 44}px)`,
        opacity: Math.min(1, pull / (PTR_THRESHOLD * 0.7)),
        transition: dragging ? 'none' : 'transform 0.2s ease-out, opacity 0.2s ease-out',
      }}
    >
      <div className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md flex items-center justify-center">
        <RefreshCw
          className={`w-4 h-4 ${ready || refreshing ? 'text-accent-600 dark:text-accent-400' : 'text-slate-400'} ${refreshing ? 'animate-spin' : ''}`}
          style={refreshing ? undefined : { transform: `rotate(${pull * 3}deg)` }}
        />
      </div>
    </div>
  );
}
