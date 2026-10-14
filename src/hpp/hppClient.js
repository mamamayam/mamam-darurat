import { createClient } from '@supabase/supabase-js';

/**
 * Klien Supabase KHUSUS halaman HPP. Terpisah dari klien POS (src/lib/supabase.js) supaya:
 *  - sesi login HPP tidak bertabrakan dengan sesi POS (storageKey sendiri), dan
 *  - src/hpp tidak mengimpor kode POS (aturan PRD Routing, dijaga appMode.test.js).
 * Hanya anon key. Hak akses data dijaga RLS di database (supabase/migrations/013_hpp.sql).
 */
const url = import.meta.env?.VITE_SUPABASE_URL;
const key = import.meta.env?.VITE_SUPABASE_ANON_KEY;

export const hppConfigured = Boolean(url && key);

export const hppDb = hppConfigured
  ? createClient(url, key, {
    auth: { storageKey: 'mamam-hpp-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  })
  : null;
