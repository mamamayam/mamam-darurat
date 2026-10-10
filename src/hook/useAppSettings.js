import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * useAppSettings — pengaturan aplikasi (tabel app_settings, satu baris per kunci).
 * Kalau tabel belum dibuat (migrasi 008 belum dijalankan) atau gagal dibaca,
 * nilai bawaan dipakai dan `error` terisi supaya UI bisa memberi tahu.
 */
export const SETTING_DEFAULTS = {
  session_hours: 12,               // lama sesi login (jam)
  employee_pin_enabled: true,      // staf boleh melihat gaji karyawan lewat PIN karyawan
  employee_pin_view_minutes: 3,    // tutup otomatis setelah tidak ada aktivitas
  device_enforce: false,           // database menolak catatan dari HP yang belum terdaftar (migrasi 011)
};

export const SESSION_HOURS_CHOICES = [
  { value: 1, label: '1 jam' }, { value: 12, label: '12 jam' }, { value: 24, label: '1 hari' }, { value: 168, label: '7 hari' },
];
export const VIEW_MINUTES_CHOICES = [1, 3, 5, 10];

export function useAppSettings() {
  const [settings, setSettings] = useState(SETTING_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    const { data, error: e } = await supabase.from('app_settings').select('key, value');
    if (e) { setError(e.message); setLoading(false); return; }
    const next = { ...SETTING_DEFAULTS };
    for (const row of data || []) if (row.key in SETTING_DEFAULTS) next[row.key] = row.value;
    setSettings(next);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const save = useCallback(async (key, value) => {
    if (!(key in SETTING_DEFAULTS)) throw new Error(`Pengaturan tidak dikenal: ${key}`);
    const prev = settings[key];
    setSettings((s) => ({ ...s, [key]: value }));            // tampil dulu, balik lagi kalau gagal
    const { error: e } = await supabase.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (e) { setSettings((s) => ({ ...s, [key]: prev })); throw new Error(`Gagal menyimpan pengaturan: ${e.message}`); }
  }, [settings]);

  return { settings, loading, error, save, reload };
}
