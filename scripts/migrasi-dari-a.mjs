#!/usr/bin/env node
// Titik masuk skrip migrasi A -> C. Logikanya ada di scripts/migrasi/cli.mjs.
// Bantuan: node scripts/migrasi-dari-a.mjs --help
import { run } from './migrasi/cli.mjs';

process.exitCode = await run(process.argv.slice(2));
