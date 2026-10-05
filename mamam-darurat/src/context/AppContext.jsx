import { createContext, useContext } from 'react';

/**
 * AppContext C — HANYA helper UI lintas-View (alert & konfirmasi), sama
 * seperti yang disediakan App.jsx mamam-global. Sengaja TIDAK memuat data
 * bisnis (menus, sales, dst): tiap View mengambil datanya sendiri dari
 * Supabase. Itu yang membedakan dari AppContext A yang jadi "gudang state".
 */
export const AppContext = createContext(null);

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext harus dipakai di dalam <AppContext.Provider> (App.jsx)');
  return ctx;
};
