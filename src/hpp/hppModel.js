/**
 * Model HPP (fungsi murni, dites). Mengubah baris tabel Supabase (supabase/migrations/013_hpp.sql)
 * menjadi struktur yang enak dipakai UI, dan menghitung modal/margin/dampak.
 *
 * Aturan hitung:
 *  - harga per unit dasar bahan = harga / isi            (isi = jumlah unit dasar per satuan beli)
 *  - biaya baris resep (bahan)    = qty * harga per unit dasar
 *  - biaya baris resep (sub-resep)= resep batch (hasil_qty): qty / hasil_qty * total resep itu
 *                                   resep per porsi        : qty * total resep itu
 *  - HPP menu = jumlah komponen + biaya_lain (sisa yang belum diuraikan)
 *  - margin = (harga jual outlet - HPP) / harga jual outlet; HIGH jika >= batas atas, LOW jika < batas bawah.
 * Bahan tanpa harga dihitung 0 dan dilaporkan lewat menuBahanKosong().
 */
export const DEFAULT_MARGIN = { lo: 30, hi: 30 };
export const DEFAULT_MARKUP = 1.25;

const n = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const urut = (a, b) => (a.urutan - b.urutan) || a.nama.localeCompare(b.nama, 'id');

export function buildModel(raw) {
  const kategori = (raw.kategori || []).map((k) => ({ id: k.id, jenis: k.jenis, nama: k.nama, urutan: n(k.urutan) ?? 0 }));
  const bahan = {};
  for (const b of raw.bahan || []) {
    bahan[b.id] = {
      id: b.id, nama: b.nama, kategoriId: b.kategori_id ?? null, satuan: b.satuan, isi: n(b.isi) || 1, unit: b.unit_dasar,
      harga: n(b.harga), hargaAcuan: n(b.harga_acuan), catatan: b.catatan ?? null, aktif: b.aktif !== false,
    };
  }
  const resep = {};
  for (const r of raw.resep || []) {
    resep[r.id] = { id: r.id, nama: r.nama, grup: r.grup, hasilQty: n(r.hasil_qty), hasilUnit: r.hasil_unit ?? null, urutan: n(r.urutan) ?? 0, items: [] };
  }
  for (const i of raw.resepItem || []) {
    resep[i.resep_id]?.items.push({ id: i.id, urutan: n(i.urutan) ?? 0, bahanId: i.bahan_id ?? null, subResepId: i.sub_resep_id ?? null, qty: n(i.qty) ?? 0 });
  }
  Object.values(resep).forEach((r) => r.items.sort((a, b) => a.urutan - b.urutan));
  const menu = (raw.menu || []).map((m) => ({
    id: m.id, nama: m.nama, kategoriId: m.kategori_id ?? null, hargaOutlet: n(m.harga_outlet) ?? 0, biayaLain: n(m.biaya_lain) ?? 0,
    hppFile: n(m.hpp_file), urutan: n(m.urutan) ?? 0, aktif: m.aktif !== false, items: [],
  }));
  const menuById = Object.fromEntries(menu.map((m) => [m.id, m]));
  for (const i of raw.menuItem || []) {
    menuById[i.menu_id]?.items.push({ id: i.id, urutan: n(i.urutan) ?? 0, resepId: i.resep_id ?? null, bahanId: i.bahan_id ?? null, qty: n(i.qty) ?? 0 });
  }
  menu.forEach((m) => m.items.sort((a, b) => a.urutan - b.urutan));
  menu.sort((a, b) => (a.urutan - b.urutan) || a.nama.localeCompare(b.nama, 'id'));

  const riwayat = {};
  for (const r of raw.riwayat || []) {
    (riwayat[r.bahan_id] ||= []).push({ id: r.id, harga: n(r.harga), hargaSebelum: n(r.harga_sebelum), catatan: r.catatan || '', sumber: r.sumber, pada: r.dibuat_pada });
  }
  Object.values(riwayat).forEach((l) => l.sort((a, b) => new Date(b.pada) - new Date(a.pada)));

  const st = Object.fromEntries((raw.setting || []).map((s) => [s.key, s.value]));
  const margin = {
    lo: Number(st.margin?.lo ?? DEFAULT_MARGIN.lo),
    hi: Number(st.margin?.hi ?? DEFAULT_MARGIN.hi),
  };
  if (margin.lo > margin.hi) margin.lo = margin.hi;

  return {
    kategoriBahan: kategori.filter((k) => k.jenis === 'bahan').sort(urut),
    kategoriMenu: kategori.filter((k) => k.jenis === 'menu').sort(urut),
    bahan, bahanList: Object.values(bahan).sort((a, b) => a.nama.localeCompare(b.nama, 'id')),
    resep, menu, riwayat, margin, markup: Number(st.online_markup ?? DEFAULT_MARKUP),
  };
}

/**
 * Konteks hitung. `overrides` = { bahanId: harga } untuk menghitung "bagaimana kalau harganya X"
 * (dipakai untuk dampak perubahan dan pembanding acuan). Hasil di-cache per konteks.
 */
export function makeCtx(model, overrides = {}) {
  const totals = new Map();
  const priceOf = (b) => (Object.prototype.hasOwnProperty.call(overrides, b.id) ? overrides[b.id] : b.harga);
  const unitCost = (bahanId) => {
    const b = model.bahan[bahanId];
    if (!b) return 0;
    const h = priceOf(b);
    return h === null || h === undefined ? 0 : h / b.isi;
  };
  const resepTotal = (id, stack = []) => {
    if (totals.has(id)) return totals.get(id);
    const r = model.resep[id];
    if (!r || stack.includes(id)) return 0;          // resep saling merujuk: putus di sini, bukan loop tak hingga
    const t = r.items.reduce((s, it) => s + itemCost(it, [...stack, id]), 0);
    totals.set(id, t);
    return t;
  };
  const resepCost = (id, qty, stack = []) => {
    const r = model.resep[id];
    if (!r) return 0;
    const total = resepTotal(id, stack);
    return r.hasilQty ? (qty / r.hasilQty) * total : qty * total;
  };
  const itemCost = (it, stack) => (it.bahanId ? it.qty * unitCost(it.bahanId) : resepCost(it.subResepId, it.qty, stack));
  const menuItemCost = (it) => (it.bahanId ? it.qty * unitCost(it.bahanId) : resepCost(it.resepId, it.qty));
  const menuHpp = (m) => m.items.reduce((s, it) => s + menuItemCost(it), 0) + m.biayaLain;
  return { unitCost, resepTotal, resepCost, itemCost: (it) => itemCost(it, []), menuItemCost, menuHpp, priceOf };
}

/** Konteks pada harga acuan (harga_acuan kosong = pakai harga sekarang). */
export function ctxAcuan(model) {
  const ov = {};
  for (const b of Object.values(model.bahan)) if (b.hargaAcuan !== null) ov[b.id] = b.hargaAcuan;
  return makeCtx(model, ov);
}

export function marginPct(hargaOutlet, hpp) {
  return hargaOutlet > 0 ? ((hargaOutlet - hpp) / hargaOutlet) * 100 : 0;
}

export function tierOf(pct, margin = DEFAULT_MARGIN) {
  if (pct >= margin.hi) return 'HIGH';
  if (pct < margin.lo) return 'LOW';
  return 'SEDANG';
}
export const tiersFor = (margin) => (margin.lo < margin.hi ? ['LOW', 'SEDANG', 'HIGH'] : ['LOW', 'HIGH']);

/** Ringkasan satu menu pada konteks tertentu. */
export function menuInfo(model, ctx, m) {
  const hpp = ctx.menuHpp(m);
  const pct = marginPct(m.hargaOutlet, hpp);
  return { hpp, pct, tier: tierOf(pct, model.margin), profit: m.hargaOutlet - hpp, online: m.hargaOutlet * model.markup };
}

/** Harga jual outlet minimum (kelipatan `step`) supaya margin >= target. 0 kalau tidak bisa dihitung. */
export function hargaMinimal(hpp, targetPct, step = 500) {
  if (!(hpp > 0) || !(targetPct >= 0 && targetPct < 100)) return 0;
  return Math.ceil(hpp / (1 - targetPct / 100) / step) * step;
}

/** Komponen menu untuk tampilan: [{kind:'resep'|'bahan'|'lain', id, nama, qty, unit, biaya}] urut biaya terbesar. */
export function menuParts(model, ctx, m) {
  const parts = m.items.map((it) => {
    if (it.bahanId) {
      const b = model.bahan[it.bahanId];
      return { kind: 'bahan', itemId: it.id, id: it.bahanId, nama: b?.nama ?? '(bahan dihapus)', qty: it.qty, unit: b?.unit ?? '', biaya: ctx.menuItemCost(it) };
    }
    const r = model.resep[it.resepId];
    return { kind: 'resep', itemId: it.id, id: it.resepId, nama: r?.nama ?? '(resep dihapus)', qty: it.qty, unit: r?.hasilUnit ?? 'porsi', biaya: ctx.menuItemCost(it) };
  });
  parts.sort((a, b) => b.biaya - a.biaya);
  if (m.biayaLain) parts.push({ kind: 'lain', id: m.id, nama: 'Biaya lain', qty: 1, unit: '', biaya: m.biayaLain });
  return parts;
}

/** Baris isi satu resep: bahan atau sub-resep, lengkap dengan biaya pada porsi/qty yang dipakai. */
export function resepRows(model, ctx, resepId) {
  const r = model.resep[resepId];
  if (!r) return [];
  return r.items.map((it) => {
    if (it.bahanId) {
      const b = model.bahan[it.bahanId];
      return { kind: 'bahan', itemId: it.id, id: it.bahanId, nama: b?.nama ?? '(bahan dihapus)', qty: it.qty, unit: b?.unit ?? '', biaya: ctx.itemCost(it) };
    }
    const s = model.resep[it.subResepId];
    return { kind: 'resep', itemId: it.id, id: it.subResepId, nama: s?.nama ?? '(resep dihapus)', qty: it.qty, unit: s?.hasilUnit ?? 'porsi', biaya: ctx.itemCost(it) };
  });
}

/** Menu yang memakai bahan ini, langsung atau lewat resep (bertingkat). */
export function menusUsingBahan(model, bahanId) {
  const memo = new Map();
  const memakai = (resepId, stack = []) => {
    if (memo.has(resepId)) return memo.get(resepId);
    if (stack.includes(resepId)) return false;
    const r = model.resep[resepId];
    const ya = !!r && r.items.some((it) => (it.bahanId ? it.bahanId === bahanId : memakai(it.subResepId, [...stack, resepId])));
    memo.set(resepId, ya);
    return ya;
  };
  return model.menu.filter((m) => m.items.some((it) => (it.bahanId ? it.bahanId === bahanId : memakai(it.resepId))));
}

/** True kalau resep `resepId` memuat resep `targetId`, langsung atau bertingkat. */
export function resepMemuat(model, resepId, targetId, stack = []) {
  if (stack.includes(resepId)) return false;
  const r = model.resep[resepId];
  if (!r) return false;
  return r.items.some((it) => it.subResepId && (it.subResepId === targetId || resepMemuat(model, it.subResepId, targetId, [...stack, resepId])));
}

/** Boleh menaruh `subId` sebagai isi resep `resepId`? Tidak boleh diri sendiri atau yang akan membuat lingkaran. */
export function bisaTambahSub(model, resepId, subId) {
  return subId !== resepId && !resepMemuat(model, subId, resepId);
}

/** Menu yang memakai resep ini, langsung atau lewat resep lain. */
export function menusUsingResep(model, resepId) {
  return model.menu.filter((m) => m.items.some((it) => it.resepId && (it.resepId === resepId || resepMemuat(model, it.resepId, resepId))));
}

/** Biaya sebuah komponen pada takaran `qty`: { bahanId } atau { resepId }. */
export function biayaKomponen(ctx, { bahanId = null, resepId = null, qty }) {
  return bahanId ? qty * ctx.unitCost(bahanId) : ctx.resepCost(resepId, qty);
}

/** Dampak harga bahan berubah dari `hargaSebelum` ke harga sekarang pada tiap menu yang memakainya. */
export function dampakHarga(model, bahanId, hargaSebelum) {
  const before = makeCtx(model, { [bahanId]: hargaSebelum });
  const after = makeCtx(model);
  const rows = menusUsingBahan(model, bahanId).map((m) => {
    const a = menuInfo(model, before, m);
    const z = menuInfo(model, after, m);
    return { menu: m, sebelum: a, sesudah: z, selisih: z.hpp - a.hpp, ganti: a.tier !== z.tier };
  });
  return { rows, ganti: rows.filter((r) => r.ganti).length };
}

/** Nama bahan tanpa harga yang dipakai (qty > 0) oleh menu ini, langsung atau lewat resep. */
export function menuBahanKosong(model, m) {
  const kosong = new Set();
  const jalan = (resepId, stack) => {
    const r = model.resep[resepId];
    if (!r || stack.includes(resepId)) return;
    for (const it of r.items) {
      if (!(it.qty > 0)) continue;
      if (it.bahanId) { if (model.bahan[it.bahanId]?.harga === null) kosong.add(model.bahan[it.bahanId].nama); } else jalan(it.subResepId, [...stack, resepId]);
    }
  };
  for (const it of m.items) {
    if (!(it.qty > 0)) continue;
    if (it.bahanId) { if (model.bahan[it.bahanId]?.harga === null) kosong.add(model.bahan[it.bahanId].nama); } else jalan(it.resepId, []);
  }
  return [...kosong];
}

/** Perubahan harga terakhir dari riwayat: { persen, pada } atau null kalau belum pernah berubah. */
export function perubahanTerakhir(model, bahanId) {
  const l = model.riwayat[bahanId] || [];
  if (l.length < 2 || !l[1].harga) return null;
  return { persen: ((l[0].harga - l[1].harga) / l[1].harga) * 100, pada: l[0].pada, dari: l[1].harga };
}

/** Kelompokkan item per kategori sesuai urutan kategori; item tanpa kategori masuk "Lainnya". */
export function kelompokkan(items, kategoriList, getKategoriId) {
  const ada = new Set(kategoriList.map((k) => k.id));
  const grup = kategoriList.map((k) => ({ id: k.id, nama: k.nama, items: items.filter((x) => getKategoriId(x) === k.id) }));
  const sisa = items.filter((x) => !ada.has(getKategoriId(x)));
  if (sisa.length) grup.push({ id: null, nama: 'Lainnya', items: sisa });
  return grup.filter((g) => g.items.length);
}
