// Hitungan posisi indikator PillTabs. Murni (tanpa React) supaya bisa dites.
// Semua tab sama lebar, jadi indikator cukup selebar 1/n dan digeser n kali lebarnya sendiri.

// Urutan tab yang sedang aktif; -1 kalau value tidak ada di options.
export function pillIndex(options, value) {
  return options.findIndex((opt) => opt.value === value);
}

// Style indikator geser. translateX dalam persen = persen dari lebar indikator itu sendiri,
// jadi index * 100% = geser sejauh `index` tab.
export function pillIndicatorStyle(index, count) {
  if (count <= 0 || index < 0) return { width: '0%', transform: 'translateX(0%)' };
  return { width: `calc(100% / ${count})`, transform: `translateX(${index * 100}%)` };
}
