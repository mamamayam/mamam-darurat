import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { sortDevices, validateDeviceName, isMissingTable } from './deviceLogic';

/** useDevices — daftar HP untuk Pengaturan > Perangkat (khusus owner): beri nama, ubah nama, cabut, hapus. */
export function useDevices() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [missing, setMissing] = useState(false);

  const reload = useCallback(async () => {
    const { data, error: e } = await supabase.from('devices').select('*');
    if (e) { setMissing(isMissingTable(e)); setError(e.message); setLoading(false); return; }
    setDevices(sortDevices(data || []));
    setError(null); setMissing(false); setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const fail = (e, msg) => { throw new Error(`${msg}: ${e.message}`); };

  /** Beri nama = daftarkan. Dipakai juga untuk ubah nama dan mendaftarkan ulang HP yang dicabut. */
  const saveName = async (id, name) => {
    const v = validateDeviceName(name, devices, id);
    if (!v.ok) throw new Error(v.message);
    const cur = devices.find((d) => d.id === id);
    const patch = { name: v.name, status: 'terdaftar' };
    if (!cur?.registered_at || cur.status !== 'terdaftar') patch.registered_at = new Date().toISOString();
    const { error: e } = await supabase.from('devices').update(patch).eq('id', id);
    if (e) fail(e, 'Gagal menyimpan nama perangkat');
    await reload();
  };

  const revoke = async (id) => {
    const { error: e } = await supabase.from('devices').update({ status: 'dicabut' }).eq('id', id);
    if (e) fail(e, 'Gagal mencabut akses');
    await reload();
  };

  const remove = async (id) => {
    const { error: e } = await supabase.from('devices').delete().eq('id', id);
    if (e) fail(e, 'Gagal menghapus perangkat');
    await reload();
  };

  return { devices, loading, error, missing, reload, saveName, revoke, remove };
}
