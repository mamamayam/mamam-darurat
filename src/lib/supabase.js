import { createClient } from '@supabase/supabase-js';
import { trackedFetch } from './connection';

// Client Supabase C — ONLINE-FIRST, bukan hasil port dari sync engine
// mamam-global. Tidak ada usePersistState, tidak ada Dexie, tidak ada
// realtime-as-source-of-truth. Setiap fitur query langsung ke sini,
// tulis langsung ke sini — kalau internet putus, ya gagal, dan UI harus
// bilang jujur "gagal, coba lagi" (bukan diam-diam nyimpen draft lokal).
//
// Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di file .env.local
// (jangan di-commit ke git — lihat .env.example untuk formatnya).
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY belum diisi. ' +
    'Copy .env.example jadi .env.local lalu isi dengan kredensial project Supabase kamu.'
  );
}

// trackedFetch: hasil tiap permintaan ikut mengabari ConnectionBanner (internet putus / server tidak terjangkau).
export const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { fetch: trackedFetch } });
