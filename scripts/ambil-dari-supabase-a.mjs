#!/usr/bin/env node
// Titik masuk: ambil data lengkap dari Supabase app lama (A) dan gabungkan dengan backup yang ada.
// Logikanya ada di scripts/migrasi/ambil-a.mjs. Bantuan: node scripts/ambil-dari-supabase-a.mjs --help
import { run } from './migrasi/ambil-a.mjs';

process.exitCode = await run(process.argv.slice(2));
