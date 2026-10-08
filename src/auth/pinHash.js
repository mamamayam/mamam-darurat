/**
 * pinHash — PIN karyawan disimpan sebagai hash SHA-256 bergaram (bukan teks
 * asli). Ini hanya supaya PIN tidak terbaca langsung di tabel; PIN 4 digit
 * tetap bisa ditebak habis (10.000 kemungkinan) oleh orang yang bisa membaca
 * tabel, jadi ini PAGAR TAMPILAN, bukan pengaman data (keamanan "Longgar").
 */
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export const randomSalt = () => toHex(globalThis.crypto.getRandomValues(new Uint8Array(16)));

/** 4 digit acak (bisa berawalan nol). */
export function generatePin() {
  const n = globalThis.crypto.getRandomValues(new Uint32Array(1))[0] % 10000;
  return String(n).padStart(4, '0');
}

export async function hashPin(pin, salt, employeeId) {
  const data = new TextEncoder().encode(`${salt}:${employeeId}:${pin}`);
  return toHex(await globalThis.crypto.subtle.digest('SHA-256', data));
}

export async function verifyPinHash(pin, salt, employeeId, expectedHash) {
  if (!salt || !expectedHash) return false;
  return (await hashPin(pin, salt, employeeId)) === expectedHash;
}
