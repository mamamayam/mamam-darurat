import React, { useState } from 'react';
import { Button, PillTabs } from '../../components/ui';
import MenuListTab from './tabs/MenuListTab';
import VariantListTab from './tabs/VariantListTab';
import { useMenuData } from '../../hook/useMenuData';

// Shell tipis: cuma nampung subtab switcher Menu/Varian (pola sama kayak
// HppView.jsx & BalanceTab.jsx), supaya edit menu & varian gak perlu
// pindah halaman/sidebar terpisah kayak sebelumnya — sekali buka
// "Manajemen Menu", dua-duanya ada di sini tinggal ganti tab.
//
// Isi & logic CRUD sesungguhnya ada di tabs/MenuListTab.jsx dan
// tabs/VariantListTab.jsx — dipindah apa adanya dari MenuMgmt.jsx &
// VariantMgmt.jsx lama, TIDAK ada perubahan logic, cuma lokasi file.
export default function MenuMgmt() {
  const [activeTab, setActiveTab] = useState('menu');
  // Data diambil SEKALI di shell supaya pindah tab Menu <-> Varian tidak
  // fetch ulang, dan kedua tab selalu melihat data yang sama.
  const data = useMenuData();

  if (data.loading) {
    return <div className="flex-1 flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">Memuat menu...</div>;
  }
  if (data.error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-3">
        <p className="text-sm font-semibold text-red-500">Gagal memuat menu</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs">{data.error}</p>
        <Button onClick={data.reload}>Coba Lagi</Button>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-slate-50 dark:bg-slate-950">
      <div className="border-b border-slate-200 dark:border-slate-700 px-4 md:px-6 pt-4 md:pt-6 pb-3 shrink-0">
        <PillTabs
          className="max-w-md"
          value={activeTab}
          onChange={setActiveTab}
          options={[{ value: 'menu', label: 'Menu' }, { value: 'varian', label: 'Varian' }]}
        />
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {activeTab === 'menu' ? <MenuListTab data={data} /> : <VariantListTab data={data} />}
      </div>
    </div>
  );
}
