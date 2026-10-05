import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { fetchAllPages } from '../lib/fetchAllPages';
import { dayStartISO, nextDayStartISO } from '../features/reports/reportsMath';

/**
 * useReportData — penjualan lunas + pengeluaran untuk satu rentang tanggal LOKAL
 * (inklusif). fromDate/toDate null = tanpa batas. ONLINE-FIRST, semua dibaca
 * bertahap (paginasi) supaya periode besar tidak terpotong diam-diam di 1000 baris.
 *
 * Penjualan difilter pada paid_at (waktu presisi) memakai batas hari LOKAL:
 * [awal hari fromDate, awal hari setelah toDate). Pengeluaran difilter pada
 * transaction_date (kolom tanggal).
 */
const fail = (error, aksi) => { throw new Error(`${aksi}: ${error.message}`); };

const SALE_COLUMNS = 'id, display_number, order_type, customer_name, status, subtotal, voucher_discount, manual_discount_amount, tax_amount, service_amount, delivery_fee, total, payment_method, ojol_platform, ojol_order_number, split_payments_json, paid_at, created_at';
const ITEM_COLUMNS = 'menu_item_id, name, variant_name, note, qty, price, hpp';

export function useReportData({ fromDate, toDate }) {
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    try {
      const [salesRows, expenseRows] = await Promise.all([
        fetchAllPages((from, to) => {
          let q = supabase.from('transactions')
            .select(`${SALE_COLUMNS}, items:transaction_items(${ITEM_COLUMNS})`)
            .eq('status', 'paid');
          if (fromDate) q = q.gte('paid_at', dayStartISO(fromDate));
          if (toDate) q = q.lt('paid_at', nextDayStartISO(toDate));
          return q.order('paid_at', { ascending: false }).order('id').range(from, to);
        }, 'penjualan'),
        fetchAllPages((from, to) => {
          let q = supabase.from('expenses').select('*').eq('direction', 'pengeluaran');
          if (fromDate) q = q.gte('transaction_date', fromDate);
          if (toDate) q = q.lte('transaction_date', toDate);
          return q.order('transaction_date', { ascending: false }).order('id').range(from, to);
        }, 'pengeluaran'),
      ]);
      setSales(salesRows);
      setExpenses(expenseRows.map(e => ({ ...e, transaction_date: String(e.transaction_date).slice(0, 10) })));
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => { setLoading(true); reload(); }, [reload]);

  // Hapus PERMANEN (item transaksi ikut terhapus lewat ON DELETE CASCADE).
  const deleteTransaction = async (id) => {
    const { error: e } = await supabase.from('transactions').delete().eq('id', id);
    if (e) fail(e, 'Gagal menghapus transaksi');
    await reload();
  };

  return { sales, expenses, loading, error, reload, deleteTransaction };
}
