import { AlertTriangle } from 'lucide-react';
import { Card } from '../../components/ui';
import { useAppSettings } from '../../hook/useAppSettings';
import LoginSettings from './LoginSettings';
import EmployeePinSettings from './EmployeePinSettings';

/** Pengaturan (khusus owner): login, PIN, dan akses gaji karyawan lewat PIN. */
export default function SettingsView() {
  const { settings, loading, error, save } = useAppSettings();

  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-950 flex-1 flex flex-col h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
      <div className="max-w-3xl w-full space-y-4 pb-10">
        {error && (
          <Card className="border border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5" data-testid="settings-error">
            <p className="text-xs text-amber-800 dark:text-amber-300 flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Pengaturan belum bisa dibaca/disimpan ({error}). Jalankan migrasi 008 di Supabase (supabase/migrations/008_auth_settings.sql), lalu muat ulang.</p>
          </Card>
        )}
        <LoginSettings settings={settings} loading={loading} saveSetting={save} />
        <EmployeePinSettings settings={settings} saveSetting={save} />
      </div>
    </div>
  );
}
