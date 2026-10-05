import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * useVouchers — daftar voucher aktif untuk dipasang di POS.
 * Manajemen voucher (tambah/edit/hapus) BELUM ada UI-nya (gelombang
 * berikutnya, sesuai keputusan) — hook ini hanya membaca, dipakai POS
 * untuk validasi kode yang diketik kasir.
 */
export function useVouchers() {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const { data } = await supabase.from('vouchers').select('*').eq('is_active', true);
    setVouchers(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);
  return { vouchers, loading, reload };
}
