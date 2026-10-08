import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

/**
 * usePayrollCategories — kategori Tambahan & Potongan penggajian yang bisa
 * dikustomisasi (Kelola Kategori), polanya sama dengan kategori Pengeluaran
 * (useExpenseData). Disimpan di tabel payroll_categories (migrasi 008).
 *
 * Kalau tabelnya BELUM dibuat, hook memakai daftar bawaan dan `ready` = false;
 * mengubah kategori lalu ditolak dengan pesan yang jelas (bukan gagal diam-diam).
 * Kolom category di payroll_additions / payroll_deductions tetap teks bebas, jadi
 * ganti nama / hapus kategori tidak mengubah catatan lama.
 */
export const DEFAULT_PAYROLL_CATEGORIES = {
  tambahan: ['Bonus', 'THR', 'Tambahan'],
  potongan: ['Kasbon', 'Denda', 'Potongan'],
};
const MIGRATION_HINT = 'Kategori kustom belum aktif: jalankan supabase/migrations/008_payroll_categories.sql di SQL Editor dulu.';
const fail = (error, aksi) => { throw new Error(`${aksi}: ${error.message}`); };

export function usePayrollCategories() {
  const [categories, setCategories] = useState(DEFAULT_PAYROLL_CATEGORIES);
  const [ready, setReady] = useState(true);
  const idByKey = useRef({});   // `${kind}:${name}` -> id

  const reload = useCallback(async () => {
    const { data, error } = await supabase.from('payroll_categories').select('*').order('sort_order').order('created_at');
    if (error) { setReady(false); setCategories(DEFAULT_PAYROLL_CATEGORIES); idByKey.current = {}; return; }
    const next = { tambahan: [], potongan: [] };
    const ids = {};
    for (const c of data || []) {
      if (!next[c.kind]) continue;
      next[c.kind].push(c.name);
      ids[`${c.kind}:${c.name}`] = c.id;
    }
    idByKey.current = ids;
    setCategories(next);
    setReady(true);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const guard = () => { if (!ready) throw new Error(MIGRATION_HINT); };

  // Tambah / hapus / urutkan: diff terhadap tabel (pola sama dengan useExpenseData).
  const setCategoriesPersist = async (kind, next) => {
    guard();
    const current = categories[kind] || [];
    for (const name of next.filter(n => !current.includes(n))) {
      const clean = (name || '').trim();
      if (!clean) throw new Error('Nama kategori wajib diisi.');
      const { error } = await supabase.from('payroll_categories').insert({ kind, name: clean, sort_order: current.length });
      if (error) fail(error, 'Gagal menambah kategori');
    }
    for (const name of current.filter(n => !next.includes(n))) {
      const id = idByKey.current[`${kind}:${name}`];
      if (!id) continue;
      const { error } = await supabase.from('payroll_categories').delete().eq('id', id);
      if (error) fail(error, 'Gagal menghapus kategori');
    }
    await reload();   // ambil id baru, lalu simpan urutan
    const results = await Promise.all(next.map((n, idx) => {
      const id = idByKey.current[`${kind}:${n}`];
      return id ? supabase.from('payroll_categories').update({ sort_order: idx }).eq('id', id) : null;
    }));
    const bad = results.find(r => r && r.error);
    if (bad) fail(bad.error, 'Gagal menyimpan urutan kategori');
    await reload();
  };

  const renameCategory = async (kind, oldName, newName) => {
    guard();
    const id = idByKey.current[`${kind}:${oldName}`];
    if (!id) return;
    const { error } = await supabase.from('payroll_categories').update({ name: newName }).eq('id', id);
    if (error) fail(error, 'Gagal mengganti nama kategori');
    await reload();
  };

  const deleteCategory = async (kind, name) => {
    guard();
    const id = idByKey.current[`${kind}:${name}`];
    if (!id) return;
    const { error } = await supabase.from('payroll_categories').delete().eq('id', id);
    if (error) fail(error, 'Gagal menghapus kategori');
    await reload();
  };

  return { categories, ready, reload, setCategoriesPersist, renameCategory, deleteCategory };
}
