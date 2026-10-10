import { useState, useEffect } from 'react';
import { Share2 } from 'lucide-react';
import { Modal, Button } from '../../components/ui';

/**
 * PayslipShareSheet — pilihan sebelum slip gaji PDF dibagikan: ringkas (default) atau
 * dengan rincian harian. PDF dibuat di perangkat (payslipPdf.js), lalu dibagikan lewat
 * menu share HP (shareFile.js); di perangkat tanpa menu share, PDF diunduh.
 */
export default function PayslipShareSheet({ isOpen, onClose, onShare, employeeName, periodLabel }) {
  const [withDays, setWithDays] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (isOpen) { setWithDays(false); setBusy(false); } }, [isOpen]);

  const handleShare = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await onShare({ withDays });
      if (result === 'shared' || result === 'downloaded') onClose();   // dibatalkan / gagal: tetap terbuka
    } finally { setBusy(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} sheet size="md" title="Bagikan Slip Gaji">
      <div className="p-5 pt-2 space-y-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <p className="text-sm text-slate-500 dark:text-slate-400">Slip gaji <b className="text-slate-700 dark:text-slate-200">{employeeName}</b> · {periodLabel} dibuat sebagai PDF, lalu dibagikan lewat menu share HP.</p>
        <label className="flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
          <input type="checkbox" checked={withDays} onChange={(e) => setWithDays(e.target.checked)} className="w-5 h-5 accent-orange-500" data-testid="share-with-days" />
          Sertakan rincian harian
        </label>
        <Button size="full" icon={<Share2 className="w-4 h-4" />} loading={busy} onClick={handleShare} data-testid="share-go">Bagikan PDF</Button>
      </div>
    </Modal>
  );
}
