/**
 * payrollEngine — mesin hitung gaji. FUNGSI MURNI (tanpa React, Supabase,
 * atau Date.now() tersembunyi), port LANGSUNG dari
 * mamam-kasir/lib/features/hrd/domain/payroll_engine.dart.
 *
 * Kenapa persis B: supaya saat migrasi ke mamam-kasir, gaji yang dihitung C
 * dan yang dihitung B untuk data yang sama hasilnya SAMA. Nilai patokan di
 * payrollEngine.test.js diambil dari tes B (yang dibuat dari mockup aslinya).
 * Jangan "memperbaiki" aturan di sini tanpa mengubah B juga.
 *
 * Aturan (dari B):
 *  - Jam toko tetap 09:00–19:00 untuk semua karyawan.
 *  - Lembur pagi: masuk <= 08:30  -> (09:00 - jam masuk) menit.
 *  - Lembur sore: pulang >= 19:30 -> (jam pulang - 19:00) menit.
 *  - Uang lembur = floor(TOTAL menit lembur dalam periode / 30) x tarif per 30 menit.
 *  - Upah hanya untuk menit DI DALAM 09:00–19:00; menit di luar jam itu
 *    hanya dibayar lewat lembur (tidak dobel).
 *  - Jam bolong (bolong -> masuk_lagi berikutnya) dikurangkan, hanya bagian
 *    yang jatuh di dalam jam normal.
 *  - Bonus Full Time: masuk <= 09:00 DAN pulang >= 19:00, per hari.
 *  - Bolong yang "nyangkut" (tidak ada masuk_lagi sesudahnya) TIDAK pernah
 *    otomatis dianggap pulang di hari yang sama. Baru dianggap pulang setelah
 *    harinya lewat; sebelum itu statusnya "perlu klarifikasi".
 *  - Bersih = upah + bonus full time + lembur + tambahan - potongan - saldo awal
 *    (saldo awal hanya untuk periode bulanan).
 *
 * Satu fungsi menghitung rentang tanggal apa pun, jadi mode bulanan dan
 * mingguan (Jumat–Kamis) tidak mungkin berbeda hasilnya.
 *
 * Bentuk data:
 *   employee: { id, wagePerHour, bonusFullTime, overtimeRatePer30Min }
 *   log:      { id, employeeId, date:'YYYY-MM-DD', type, time:'HH:mm'|null, auto? }
 *             type: 'masuk' | 'masuk_lagi' | 'bolong' | 'pulang' | 'libur'
 *   tambahan/potongan: { id, employeeId, label, amount, date, category }
 */

// ── Konstanta (menit sejak tengah malam) ─────────────────────────────
export const STORE_START_MINUTES = 9 * 60;                 // 09:00
export const STORE_END_MINUTES = 19 * 60;                  // 19:00
export const OT_MORNING_THRESHOLD_MINUTES = 8 * 60 + 30;   // 08:30
export const OT_EVENING_THRESHOLD_MINUTES = 19 * 60 + 30;  // 19:30
export const DEFAULT_OVERTIME_RATE_PER_30MIN = 5000;

// ── Utilitas tanggal/jam (UTC sengaja: tanpa geser zona waktu/DST) ───
const pad = (n, len = 2) => String(n).padStart(len, '0');

export const timeToMinutes = (t) => {
  const [h, m] = String(t).split(':');
  return parseInt(h, 10) * 60 + parseInt(m, 10);
};

export const parseIsoDate = (iso) =>
  new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))));

export const formatIsoDate = (d) => `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

// ── Periode ──────────────────────────────────────────────────────────
/** Satu bulan penuh, mis. monthPeriod('2026-09'). */
export function monthPeriod(yyyyMm) {
  const y = Number(yyyyMm.slice(0, 4));
  const m = Number(yyyyMm.slice(5, 7));
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${yyyyMm}-01`, end: `${yyyyMm}-${pad(lastDay)}`, isMonth: true, monthKey: yyyyMm };
}

/** Rentang tanggal bebas (inklusif), dipakai untuk minggu gajian. */
export const rangePeriod = (start, end) => ({ start, end, isMonth: false, monthKey: null });

export const periodContains = (period, iso) => iso >= period.start && iso <= period.end;

/** Minggu gajian yang memuat tanggal itu: dihitung Jumat–Kamis (Jumat = hari ke-1). */
export function weekPeriodForDate(dateIso) {
  const d = parseIsoDate(dateIso);
  const dow = d.getUTCDay();                       // Minggu=0 ... Jumat=5
  const daysSinceFriday = (dow - 5 + 7) % 7;
  const friday = addDays(d, -daysSinceFriday);
  const thursday = addDays(friday, 6);
  return rangePeriod(formatIsoDate(friday), formatIsoDate(thursday));
}

/** Geser minggu gajian maju/mundur (biasanya +/-7 hari). */
export const shiftWeek = (week, deltaDays) =>
  weekPeriodForDate(formatIsoDate(addDays(parseIsoDate(week.start), deltaDays)));

// ── Aturan per hari ──────────────────────────────────────────────────
const hasTime = (l) => l.time != null;
const minutesOf = (l) => timeToMinutes(l.time);
const firstOfType = (logs, type) => logs.find((l) => l.type === type) || null;

/** Bolong pertama yang tidak punya masuk_lagi sesudahnya di hari yang sama. */
export function findStuckBolong(dayLogs) {
  const bolongs = dayLogs.filter((l) => l.type === 'bolong' && hasTime(l)).sort((a, b) => minutesOf(a) - minutesOf(b));
  for (const b of bolongs) {
    const hasResumeAfter = dayLogs.some((l) => l.type === 'masuk_lagi' && hasTime(l) && minutesOf(l) > minutesOf(b));
    if (!hasResumeAfter) return b;
  }
  return null;
}

function resultWithClockOut(dayLogs, masuk, clockOutMinutes, effectiveFromBolong) {
  const masukMin = minutesOf(masuk);
  const pulangMin = clockOutMinutes;

  // Lembur: pagi (masuk <= 08:30) + sore (pulang >= 19:30). Bolong yang dipakai
  // sebagai jam pulang tidak pernah menghasilkan lembur sore.
  let overtimeMinutes = 0;
  if (masukMin <= OT_MORNING_THRESHOLD_MINUTES) overtimeMinutes += STORE_START_MINUTES - masukMin;
  if (!effectiveFromBolong && pulangMin >= OT_EVENING_THRESHOLD_MINUTES) overtimeMinutes += pulangMin - STORE_END_MINUTES;

  // Menit upah biasa dijepit KE DALAM jam toko; di luar itu hanya lembur.
  const normalStart = Math.max(masukMin, STORE_START_MINUTES);
  const normalEnd = Math.min(pulangMin, STORE_END_MINUTES);
  const grossNormalMinutes = Math.max(0, normalEnd - normalStart);

  // Kurangi jeda bolong -> masuk_lagi, hanya bagian di dalam jam normal.
  let bolongMinutes = 0;
  for (const b of dayLogs.filter((l) => l.type === 'bolong' && hasTime(l))) {
    const bMin = minutesOf(b);
    const resumes = dayLogs
      .filter((l) => l.type === 'masuk_lagi' && hasTime(l) && minutesOf(l) > bMin)
      .sort((x, y) => minutesOf(x) - minutesOf(y));
    if (resumes.length === 0) continue;            // yang nyangkut tidak punya jeda untuk dikurangi
    const resumeMin = minutesOf(resumes[0]);
    const gapStart = Math.max(bMin, normalStart);
    const gapEnd = Math.min(resumeMin, normalEnd);
    if (gapEnd - gapStart > 0) bolongMinutes += gapEnd - gapStart;
  }

  const worked = grossNormalMinutes - bolongMinutes;
  return {
    status: 'hadir',
    workedMinutes: Math.max(0, worked),
    overtimeMinutes,
    bolongMinutes,
    fullTimeBonus: !effectiveFromBolong && masukMin <= STORE_START_MINUTES && pulangMin >= STORE_END_MINUTES,
    effectiveFromBolong,
    stuckBolongTime: null,
  };
}

const emptyDay = (status, extra = {}) => ({
  status, workedMinutes: 0, overtimeMinutes: 0, bolongMinutes: 0,
  fullTimeBonus: false, effectiveFromBolong: false, stuckBolongTime: null, ...extra,
});

/**
 * Evaluasi satu karyawan pada satu hari dari log mentah hari itu.
 * `date` dan `today` berupa tanggal ISO; "hari sudah lewat" = date < today.
 * Status: 'hadir' | 'libur' | 'belumAbsen' | 'belumPulang' | 'perluKlarifikasi'.
 */
export function computeDayResult(dayLogs, _employee, date, today) {
  const masuk = firstOfType(dayLogs, 'masuk');
  const pulang = firstOfType(dayLogs, 'pulang');
  const libur = firstOfType(dayLogs, 'libur');
  const stuck = masuk ? findStuckBolong(dayLogs) : null;
  const dayHasEnded = date < today;

  if (libur || !masuk) return emptyDay(libur ? 'libur' : 'belumAbsen');

  if (stuck) {
    // Hari yang sama, atau ada pulang bersama bolong yang belum selesai (keadaan
    // janggal yang tidak pernah kita tebak): butuh keputusan manusia.
    if (pulang || !dayHasEnded) return emptyDay('perluKlarifikasi', { stuckBolongTime: stuck.time });
    // Hari sudah lewat dan tidak ada yang mengklarifikasi: bolong itu jam pulang.
    return resultWithClockOut(dayLogs, masuk, minutesOf(stuck), true);
  }

  if (!pulang) return emptyDay('belumPulang');
  return resultWithClockOut(dayLogs, masuk, minutesOf(pulang), false);
}

// ── Aturan per periode ───────────────────────────────────────────────
/** round(menit / 60 * upahPerJam) dengan aritmetika bilangan bulat (setengah naik). */
export const roundedWage = (minutes, wagePerHour) => Math.floor((minutes * wagePerHour + 30) / 60);

/** Gaji dari absensi untuk satu karyawan pada satu periode. */
export function computeAttendance(employee, allLogs, period, today) {
  const byDate = new Map();
  for (const l of allLogs) {
    if (l.employeeId === employee.id && periodContains(period, l.date)) {
      if (!byDate.has(l.date)) byDate.set(l.date, []);
      byDate.get(l.date).push(l);
    }
  }
  const dates = [...byDate.keys()].sort();

  let totalWorkedMinutes = 0, totalOvertimeMinutes = 0, fullTimeDays = 0, hadirDays = 0, liburDays = 0;
  const dayRows = [];
  for (const date of dates) {
    const r = computeDayResult(byDate.get(date), employee, date, today);
    if (r.status === 'hadir') {
      hadirDays++;
      totalWorkedMinutes += r.workedMinutes;
      totalOvertimeMinutes += r.overtimeMinutes;
      if (r.fullTimeBonus) fullTimeDays++;
    } else if (r.status === 'libur') {
      liburDays++;
    }
    dayRows.push({ date, ...r });
  }

  const overtimeBlocks30Min = Math.floor(totalOvertimeMinutes / 30);   // dibulatkan ke bawah, per aturan
  const overtimeRate = employee.overtimeRatePer30Min > 0 ? employee.overtimeRatePer30Min : DEFAULT_OVERTIME_RATE_PER_30MIN;

  return {
    dayRows, hadirDays, liburDays, fullTimeDays,
    totalWorkedMinutes, totalOvertimeMinutes, overtimeBlocks30Min, overtimeRate,
    wagePay: roundedWage(totalWorkedMinutes, employee.wagePerHour),
    overtimePay: overtimeBlocks30Min * overtimeRate,
    fullTimeBonusPay: fullTimeDays * employee.bonusFullTime,
  };
}

/**
 * Gaji lengkap satu karyawan pada satu periode.
 * openingBalances berkunci '<employeeId>|<yyyy-MM>' dan hanya berlaku untuk
 * periode bulanan (positif = karyawan berutang ke toko; negatif = toko berutang).
 */
export function computePayroll({ employee, logs, additions, deductions, openingBalances, period, today }) {
  const attendance = computeAttendance(employee, logs, period, today);
  const periodAdditions = additions.filter((a) => a.employeeId === employee.id && periodContains(period, a.date));
  const periodDeductions = deductions.filter((d) => d.employeeId === employee.id && periodContains(period, d.date));
  const additionsTotal = periodAdditions.reduce((s, a) => s + a.amount, 0);
  const deductionsTotal = periodDeductions.reduce((s, d) => s + d.amount, 0);
  const openingBalance = period.monthKey == null ? 0 : (openingBalances?.[`${employee.id}|${period.monthKey}`] ?? 0);

  const totalPenghasilan = attendance.wagePay + attendance.fullTimeBonusPay + attendance.overtimePay + additionsTotal;
  const netPay = totalPenghasilan - deductionsTotal - openingBalance;

  return {
    attendance, additions: periodAdditions, deductions: periodDeductions,
    additionsTotal, deductionsTotal, openingBalance, totalPenghasilan, netPay,
  };
}

// ── Status "saat ini" ────────────────────────────────────────────────
export function todayStatus(todayLogs, employee, today) {
  if (todayLogs.length === 0) return 'belumAbsen';
  return computeDayResult(todayLogs, employee, today, today).status;
}

/** "Sedang Jaga": sudah masuk hari ini, belum pulang, dan tidak nyangkut di bolong. */
export function isOnShiftNow(todayLogs) {
  const hasMasuk = todayLogs.some((l) => l.type === 'masuk');
  const hasPulang = todayLogs.some((l) => l.type === 'pulang');
  const stuck = hasMasuk ? findStuckBolong(todayLogs) : null;
  return hasMasuk && !hasPulang && !stuck;
}
