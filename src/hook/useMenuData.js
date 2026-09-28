import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

/**
 * useMenuData — layer data Manajemen Menu, ONLINE-FIRST.
 *
 * Mengganti `menus/variantGroups/categories/variantCategories` dari
 * usePersistState + sync engine milik mamam-global. Tidak ada state lokal
 * yang dianggap "benar": setiap aksi tulis langsung ke Supabase, lalu
 * data di-fetch ulang, jadi yang tampil di layar = yang ada di database.
 *
 * BENTUK DATA yang diberikan ke UI sengaja SAMA dengan mamam-global
 * supaya form/list menu bisa dipakai tanpa diubah:
 *   menu         { id, name, price, hpp, category:'Ayam', variantGroupIds:[...] }
 *   variantGroup { id, name, category:'Level Pedas', isRequired, maxSelection,
 *                  options:[{ id, name, extraPrice }] }
 *   categories / variantCategories : string[] berurutan
 *
 * Kategori dikenali lewat NAMA (seperti di A). Nama kategori unik
 * (dicek di CategoryModal), jadi aman dipetakan ke id di sini.
 */

const num = (v) => Number(v) || 0;

function fail(error, aksi) {
  // Pesan jujur ke UI. Tidak ada retry diam-diam / antrean lokal.
  throw new Error(`${aksi}: ${error.message}`);
}

export function useMenuData() {
  const [menus, setMenus] = useState([]);
  const [variantGroups, setVariantGroups] = useState([]);
  const [categories, setCategories] = useState([]);
  const [variantCategories, setVariantCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Kategori yang dipakai item tapi belum terdaftar (mis. baru dibuat)
  const catIdByName = useRef({});
  const vCatIdByName = useRef({});

  const reload = useCallback(async () => {
    const [cats, items, links, vcats, vgs, opts] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order').order('created_at'),
      supabase.from('menu_items').select('*').order('sort_order').order('created_at'),
      supabase.from('menu_item_variant_groups').select('*'),
      supabase.from('variant_categories').select('*').order('sort_order').order('created_at'),
      supabase.from('variant_groups').select('*').order('sort_order').order('created_at'),
      supabase.from('variant_options').select('*').order('sort_order'),
    ]);
    const bad = [cats, items, links, vcats, vgs, opts].find(r => r.error);
    if (bad) { setError(bad.error.message); setLoading(false); return; }

    catIdByName.current = Object.fromEntries(cats.data.map(c => [c.name, c.id]));
    vCatIdByName.current = Object.fromEntries(vcats.data.map(c => [c.name, c.id]));
    const catNameById = Object.fromEntries(cats.data.map(c => [c.id, c.name]));
    const vCatNameById = Object.fromEntries(vcats.data.map(c => [c.id, c.name]));

    const linksByItem = {};
    links.data.forEach(l => { (linksByItem[l.menu_item_id] ||= []).push(l.variant_group_id); });
    const optsByGroup = {};
    opts.data.forEach(o => {
      (optsByGroup[o.variant_group_id] ||= []).push({ id: o.id, name: o.name, extraPrice: o.extra_price });
    });

    setCategories(cats.data.map(c => c.name));
    setVariantCategories(vcats.data.map(c => c.name));
    setMenus(items.data.map(i => ({
      id: i.id, name: i.name, price: i.price, hpp: i.hpp ?? 0,
      category: catNameById[i.category_id] || 'Lainnya',
      variantGroupIds: linksByItem[i.id] || [],
    })));
    setVariantGroups(vgs.data.map(g => ({
      id: g.id, name: g.name,
      category: vCatNameById[g.category_id] || 'Lainnya',
      isRequired: g.is_required, maxSelection: g.max_selection,
      options: optsByGroup[g.id] || [],
    })));
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Pastikan kategori (menu/varian) ada, kembalikan id-nya. Dibuat kalau belum.
  const ensureCategory = async (table, cacheRef, name) => {
    const clean = (name || 'Lainnya').trim() || 'Lainnya';
    if (cacheRef.current[clean]) return cacheRef.current[clean];
    const { data, error: e } = await supabase.from(table)
      .insert({ name: clean, sort_order: Object.keys(cacheRef.current).length })
      .select('id').single();
    if (e) fail(e, 'Gagal membuat kategori');
    cacheRef.current[clean] = data.id;
    return data.id;
  };

  // ── MENU ────────────────────────────────────────────────────────────
  const saveMenu = async (m) => {
    const category_id = await ensureCategory('categories', catIdByName, m.category);
    const row = { name: m.name, price: num(m.price), hpp: num(m.hpp), category_id };
    let id = m.id;
    if (id) {
      const { error: e } = await supabase.from('menu_items')
        .update({ ...row, updated_at: new Date().toISOString() }).eq('id', id);
      if (e) fail(e, 'Gagal menyimpan menu');
    } else {
      const { data, error: e } = await supabase.from('menu_items')
        .insert({ ...row, sort_order: menus.length }).select('id').single();
      if (e) fail(e, 'Gagal menambah menu');
      id = data.id;
    }
    // Sinkronkan koneksi varian: hapus semua lalu isi ulang (tabel penghubung kecil)
    const del = await supabase.from('menu_item_variant_groups').delete().eq('menu_item_id', id);
    if (del.error) fail(del.error, 'Gagal memperbarui koneksi varian');
    if ((m.variantGroupIds || []).length > 0) {
      const ins = await supabase.from('menu_item_variant_groups')
        .insert(m.variantGroupIds.map(vid => ({ menu_item_id: id, variant_group_id: vid })));
      if (ins.error) fail(ins.error, 'Gagal menyimpan koneksi varian');
    }
    await reload();
  };

  const deleteMenu = async (id) => {
    const { error: e } = await supabase.from('menu_items').delete().eq('id', id);
    if (e) fail(e, 'Gagal menghapus menu');
    await reload();
  };

  // Simpan urutan menu dalam satu kategori (array id sesuai urutan baru)
  const reorderMenus = async (orderedIds) => {
    const results = await Promise.all(orderedIds.map((id, idx) =>
      supabase.from('menu_items').update({ sort_order: idx }).eq('id', id)));
    const bad = results.find(r => r.error);
    if (bad) fail(bad.error, 'Gagal menyimpan urutan menu');
    await reload();
  };

  // ── KATEGORI (dipakai CategoryModal lewat setCategories(nextArray)) ──
  // Menerima daftar nama berurutan yang baru; men-diff terhadap yang ada:
  // nama baru = tambah, nama hilang = hapus, urutan = simpan ulang,
  // lalu rename ditangani terpisah lewat renameCategory (dipanggil onRename).
  const syncCategoryList = async (table, cacheRef, nextNames, currentNames) => {
    const toAdd = nextNames.filter(n => !currentNames.includes(n) && !cacheRef.current[n]);
    for (const n of toAdd) {
      const { data, error: e } = await supabase.from(table).insert({ name: n, sort_order: 0 }).select('id').single();
      if (e) fail(e, 'Gagal menambah kategori');
      cacheRef.current[n] = data.id;
    }
    const removed = currentNames.filter(n => !nextNames.includes(n));
    for (const n of removed) {
      const id = cacheRef.current[n];
      if (id) {
        const { error: e } = await supabase.from(table).delete().eq('id', id);
        if (e) fail(e, 'Gagal menghapus kategori');
        delete cacheRef.current[n];
      }
    }
    const results = await Promise.all(nextNames.map((n, idx) =>
      cacheRef.current[n] ? supabase.from(table).update({ sort_order: idx }).eq('id', cacheRef.current[n]) : null));
    const bad = results.find(r => r && r.error);
    if (bad) fail(bad.error, 'Gagal menyimpan urutan kategori');
  };

  const setCategoriesPersist = async (nextOrUpdater) => {
    const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(categories) : nextOrUpdater;
    if (next === categories) return;
    // Rename sudah diubah nama-nya di baris yang sama lewat renameCategory;
    // di sini hanya urutan + tambah/hapus.
    await syncCategoryList('categories', catIdByName, next, categories);
    await reload();
  };
  const setVariantCategoriesPersist = async (nextOrUpdater) => {
    const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(variantCategories) : nextOrUpdater;
    if (next === variantCategories) return;
    await syncCategoryList('variant_categories', vCatIdByName, next, variantCategories);
    await reload();
  };

  // Rename = UPDATE nama di baris yang sama (id tetap) supaya semua
  // menu/varian di kategori itu otomatis ikut, tanpa menyentuh baris menu.
  const renameCategory = async (table, cacheRef, oldName, newName) => {
    const id = cacheRef.current[oldName];
    if (!id) return;
    const { error: e } = await supabase.from(table).update({ name: newName }).eq('id', id);
    if (e) fail(e, 'Gagal mengganti nama kategori');
    cacheRef.current[newName] = id;
    delete cacheRef.current[oldName];
    await reload();
  };
  const renameMenuCategory = (o, n) => renameCategory('categories', catIdByName, o, n);
  const renameVariantCategory = (o, n) => renameCategory('variant_categories', vCatIdByName, o, n);

  // Hapus kategori BERURUTAN: (1) pindahkan item ke kategori fallback,
  // (2) baru hapus kategorinya. Urutan ini penting — kalau kategori dihapus
  // dulu, category_id item jadi NULL dan item "hilang" ke Lainnya.
  const deleteCategoryOrdered = async (table, itemTable, cacheRef, name, fallbackName) => {
    const id = cacheRef.current[name];
    if (!id) return;
    if (name !== fallbackName) {
      const toId = await ensureCategory(table, cacheRef, fallbackName);
      const mv = await supabase.from(itemTable).update({ category_id: toId }).eq('category_id', id);
      if (mv.error) fail(mv.error, 'Gagal memindahkan item kategori');
    }
    const del = await supabase.from(table).delete().eq('id', id);
    if (del.error) fail(del.error, 'Gagal menghapus kategori');
    delete cacheRef.current[name];
    await reload();
  };
  const deleteMenuCategory = (name) => deleteCategoryOrdered('categories', 'menu_items', catIdByName, name, 'Umum');
  const deleteVariantCategory = (name) => deleteCategoryOrdered('variant_categories', 'variant_groups', vCatIdByName, name, 'Lainnya');

  // ── VARIAN ──────────────────────────────────────────────────────────
  const saveVariantGroup = async (g) => {
    const category_id = await ensureCategory('variant_categories', vCatIdByName, g.category);
    const row = {
      name: g.name, category_id,
      is_required: !!g.isRequired, max_selection: num(g.maxSelection) || 1,
    };
    let id = g.id;
    if (id) {
      const { error: e } = await supabase.from('variant_groups')
        .update({ ...row, updated_at: new Date().toISOString() }).eq('id', id);
      if (e) fail(e, 'Gagal menyimpan grup varian');
    } else {
      const { data, error: e } = await supabase.from('variant_groups')
        .insert({ ...row, sort_order: variantGroups.length }).select('id').single();
      if (e) fail(e, 'Gagal menambah grup varian');
      id = data.id;
    }
    // Opsi: hapus semua lalu isi ulang sesuai urutan di form (urutan = sort_order)
    const del = await supabase.from('variant_options').delete().eq('variant_group_id', id);
    if (del.error) fail(del.error, 'Gagal memperbarui opsi varian');
    const options = g.options || [];
    if (options.length > 0) {
      const ins = await supabase.from('variant_options').insert(options.map((o, idx) => ({
        variant_group_id: id, name: o.name, extra_price: num(o.extraPrice), sort_order: idx,
      })));
      if (ins.error) fail(ins.error, 'Gagal menyimpan opsi varian');
    }
    await reload();
  };

  const deleteVariantGroup = async (id) => {
    // menu_item_variant_groups & variant_options ikut terhapus (ON DELETE CASCADE)
    const { error: e } = await supabase.from('variant_groups').delete().eq('id', id);
    if (e) fail(e, 'Gagal menghapus grup varian');
    await reload();
  };

  const reorderVariantGroups = async (orderedIds) => {
    const results = await Promise.all(orderedIds.map((id, idx) =>
      supabase.from('variant_groups').update({ sort_order: idx }).eq('id', id)));
    const bad = results.find(r => r.error);
    if (bad) fail(bad.error, 'Gagal menyimpan urutan varian');
    await reload();
  };

  return {
    menus, variantGroups, categories, variantCategories, loading, error, reload,
    saveMenu, deleteMenu, reorderMenus,
    saveVariantGroup, deleteVariantGroup, reorderVariantGroups,
    setCategoriesPersist, setVariantCategoriesPersist,
    renameMenuCategory, renameVariantCategory,
    deleteMenuCategory, deleteVariantCategory,
  };
}
