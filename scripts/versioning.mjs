/**
 * versioning — aturan penomoran versi otomatis. FUNGSI MURNI (tanpa git / file).
 * Dipakai scripts/bump-version.mjs, yang dijalankan GitHub Action tiap push ke main
 * (.github/workflows/versioning.yml). Penjelasan lengkap: docs/versioning.md.
 *
 * Besar-kecilnya kenaikan ditentukan dari AWALAN pesan commit (Conventional Commits):
 *   feat!: ... / feat(x)!: ... / ada baris "BREAKING CHANGE: ..."  -> major  (1.4.7 -> 2.0.0)
 *   feat: ...                                                      -> minor  (1.4.7 -> 1.5.0)
 *   fix: / refactor: / chore: / ... / pesan tanpa awalan           -> patch  (1.4.7 -> 1.4.8)
 * Satu push berisi banyak commit memakai kenaikan TERTINGGI di antara commit-commitnya.
 * Setiap push minimal menaikkan patch, jadi pesan seperti "push 7/10 v2" tetap dihitung.
 */

const LEVEL_RANK = { patch: 1, minor: 2, major: 3 };
const HEADER = /^(\w+)(\([^)]*\))?(!)?:\s/;
const RELEASE_COMMIT = /^chore\(release\):/i;

/** Commit yang dibuat otomatis oleh Action ini; tidak boleh dihitung lagi. */
export const isReleaseCommit = (message) => RELEASE_COMMIT.test(String(message ?? '').trim());

/** 'major' | 'minor' | 'patch' untuk satu pesan commit, atau null kalau tidak dihitung. */
export function commitLevel(message) {
  const text = String(message ?? '').trim();
  if (!text || isReleaseCommit(text)) return null;
  const subject = text.split(/\r?\n/)[0];
  const m = HEADER.exec(subject);
  if (/^BREAKING[ -]CHANGE:/m.test(text) || (m && m[3])) return 'major';
  if (m && m[1].toLowerCase() === 'feat') return 'minor';
  return 'patch';
}

/** Kenaikan tertinggi dari banyak pesan commit; null kalau tidak ada yang dihitung. */
export function highestLevel(messages) {
  let best = null;
  for (const msg of messages) {
    const lv = commitLevel(msg);
    if (lv && (!best || LEVEL_RANK[lv] > LEVEL_RANK[best])) best = lv;
  }
  return best;
}

/** '1.4.7' + 'minor' -> '1.5.0'. Akhiran pra-rilis (-beta.1) dibuang. */
export function bumpVersion(version, level) {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(String(version ?? '').trim());
  if (!m) throw new Error(`Versi tidak valid: "${version}"`);
  let [major, minor, patch] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (level === 'major') { major += 1; minor = 0; patch = 0; }
  else if (level === 'minor') { minor += 1; patch = 0; }
  else if (level === 'patch') { patch += 1; }
  else throw new Error(`Level tidak dikenal: "${level}"`);
  return `${major}.${minor}.${patch}`;
}

/** { level, next } untuk versi sekarang + pesan-pesan commit, atau null kalau tidak perlu naik. */
export function planBump(current, messages) {
  const level = highestLevel(messages);
  return level ? { level, next: bumpVersion(current, level) } : null;
}
