import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * useCustomerData — layer data Pelanggan, ONLINE-FIRST.
 *
 * BEDA dari mamam-global (sengaja, sesuai keputusan gelombang 1):
 *  - TANPA poin. Kolom `points` tidak ada di tabel `customers` C —
 *    integrasi poin nempel ke project Supabase mamam-global lewat Edge
 *    Function `customer-lookup`, itu pekerjaan gelombang berikutnya.
 *    Field `points` yang dipakai UI hanya angka statis 0 (lihat catatan
 *    di CustomerView) supaya kartu pelanggan tidak perlu diubah bentuk
 *    saat poin diaktifkan nanti.
 *  - HARD DELETE. Tidak ada RecycleBin/useRecycleBin — hapus = hilang
 *    dari `customers` langsung. Ini konsisten dengan keputusan hard-delete
 *    global C, dan pelanggan bukan data yang butuh dipulihkan seperti stok.
 */

const fail = (error, aksi) => { throw new Error(`${aksi}: ${error.message}`); };

export function useCustomerData() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    const { data, error: e } = await supabase.from('customers').select('*').order('name');
    if (e) { setError(e.message); setLoading(false); return; }
    setCustomers(data || []);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const saveCustomer = async ({ id, name, phone }) => {
    const clean = (name || '').trim();
    if (!clean) throw new Error('Nama pelanggan wajib diisi!');
    if (id) {
      const { error: e } = await supabase.from('customers')
        .update({ name: clean, phone: phone || null, updated_at: new Date().toISOString() }).eq('id', id);
      if (e) fail(e, 'Gagal menyimpan pelanggan');
    } else {
      const { error: e } = await supabase.from('customers').insert({ name: clean, phone: phone || null });
      if (e) fail(e, 'Gagal menambah pelanggan');
    }
    await reload();
  };

  const deleteCustomer = async (id) => {
    // Transaksi lama yang menunjuk ke pelanggan ini TIDAK ikut hilang —
    // customer_id di baris transaksi cukup diset NULL (ON DELETE SET NULL),
    // nama pelanggan tetap ada lewat snapshot customer_name.
    const { error: e } = await supabase.from('customers').delete().eq('id', id);
    if (e) fail(e, 'Gagal menghapus pelanggan');
    await reload();
  };

  const bulkDeleteCustomers = async (ids) => {
    const { error: e } = await supabase.from('customers').delete().in('id', ids);
    if (e) fail(e, 'Gagal menghapus pelanggan terpilih');
    await reload();
  };

  return { customers, loading, error, reload, saveCustomer, deleteCustomer, bulkDeleteCustomers };
}
