/* ==========================================================================
   calc.js — mesai hesapları
   Hepsi saf fonksiyon: DOM'a, saate ya da depolamaya dokunmaz. Aynı girdi
   her zaman aynı çıktıyı verir; bu yüzden tests/ altında test edilebilir.

   Birimler
   - Süreler dakika (number).
   - Tarihler 'YYYY-MM-DD' metni. Tarih aritmetiği UTC ile yapılır; böylece
     tarayıcının saat dilimi ya da yaz saati geçişleri sonucu değiştirmez.
   - "Mutlak dakika" = 1970-01-01'den bu yana gün sayısı × 1440 + günün dakikası.
     Gece yarısını geçen vardiyalar bu sayede tek bir aralık olarak kalır.
   ========================================================================== */

export const DAY = 1440;
const MS_DAY = 86400000;

/* ---------- Saat ---------- */

/** '06:30' → 390 */
export function toMin(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + (m || 0);
}

/** 390 → '06:30' (gün içi; 1440 ve üstü sarılır) */
export function toHHMM(min) {
  const m = ((Math.round(min) % DAY) + DAY) % DAY;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/* ---------- Tarih ---------- */

export function parseDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function formatDate(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(iso, n) {
  return formatDate(parseDate(iso) + n * MS_DAY);
}

/** 1970-01-01'den bu yana gün sayısı */
export function dayNumber(iso) {
  return Math.round(parseDate(iso) / MS_DAY);
}

/** 0 = Pazartesi … 6 = Pazar */
export function weekday(iso) {
  return (new Date(parseDate(iso)).getUTCDay() + 6) % 7;
}

/** Haftanın pazartesisi */
export function startOfWeek(iso) {
  return addDays(iso, -weekday(iso));
}

/** Pazartesiden başlayan 7 gün */
export function weekDates(iso) {
  const monday = startOfWeek(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Ayın bütün günleri (month: 1–12) */
export function monthDates(year, month) {
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: days }, (_, i) => formatDate(Date.UTC(year, month - 1, i + 1)));
}

/** Yerel takvime göre bugün (kullanıcının saati) */
export function todayISO(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/* ---------- Aralıklar ---------- */

/** İki [start, end) aralığının kesişen dakikası */
export function overlap(a, b) {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
}

/**
 * Bir vardiyanın mutlak dakika aralığı. İzin günü ya da şablon yoksa null.
 * Bitiş başlangıçtan önce veya eşitse vardiya ertesi güne taşar (22:00–06:00).
 */
export function shiftInterval(date, tpl) {
  if (!tpl || tpl.off) return null;
  const base = dayNumber(date) * DAY;
  const start = base + toMin(tpl.start);
  let end = base + toMin(tpl.end);
  if (end <= start) end += DAY;
  return { start, end };
}

/** Brüt süre (mola dahil) */
export function grossMinutes(tpl) {
  if (!tpl || tpl.off) return 0;
  const s = toMin(tpl.start);
  let e = toMin(tpl.end);
  if (e <= s) e += DAY;
  return e - s;
}

/** Net süre (mola düşülmüş, eksiye düşmez) */
export function netMinutes(tpl) {
  return Math.max(0, grossMinutes(tpl) - Math.max(0, tpl?.breakMin || 0));
}

/**
 * Bir aralığın gece penceresine (varsayılan 20:00–06:00) denk gelen dakikası.
 * Pencere gece yarısını geçebilir. Molanın vardiyanın neresinde verildiği
 * bilinmediği için gece saati brüt süre üzerinden hesaplanır.
 */
export function nightMinutes(interval, night = { start: '20:00', end: '06:00' }) {
  if (!interval) return 0;
  const ns = toMin(night.start);
  const ne = toMin(night.end);
  let total = 0;
  // Aralığın bir gün öncesinden başlayan pencereler de taşabilir
  const first = Math.floor(interval.start / DAY) - 1;
  const last = Math.floor(interval.end / DAY);
  for (let d = first; d <= last; d++) {
    const base = d * DAY;
    const win = ns < ne
      ? { start: base + ns, end: base + ne }
      : { start: base + ns, end: base + DAY + ne };
    total += overlap(interval, win);
  }
  return total;
}

/* ---------- Mesai özeti ---------- */

/**
 * Bir haftanın günlük dökümü.
 * @param {{date: string, tpl: object|null}[]} entries  pazartesiden pazara 7 gün
 * @param {{weeklyTarget: number, night: {start, end}}} settings  hedef saat cinsinden
 *
 * Fazla mesai kronolojik dağıtılır: haftanın net toplamı hedefi hangi gün
 * aşıyorsa, aşan kısım o güne (ve sonraki günlere) yazılır. Böylece bir ayın
 * içine düşen günler toplanınca aylık fazla mesai de doğru çıkar.
 * Vardiya başladığı güne sayılır.
 */
export function weekBreakdown(entries, settings) {
  const target = Math.max(0, settings.weeklyTarget) * 60;
  let cumulative = 0;
  return entries.map(({ date, tpl }) => {
    const iv = shiftInterval(date, tpl);
    const gross = iv ? iv.end - iv.start : 0;
    const net = iv ? Math.max(0, gross - Math.max(0, tpl.breakMin || 0)) : 0;
    cumulative += net;
    const overtime = Math.max(0, Math.min(net, cumulative - target));
    return { date, gross, net, overtime, night: nightMinutes(iv, settings.night) };
  });
}

/** Günlük satırları toplar */
export function totals(days) {
  return days.reduce((t, d) => ({
    gross: t.gross + d.gross,
    net: t.net + d.net,
    overtime: t.overtime + d.overtime,
    night: t.night + d.night
  }), { gross: 0, net: 0, overtime: 0, night: 0 });
}

/**
 * Tahmini kazanç. Saatlik ücret yoksa null.
 * Normal saatler ücretle, fazla mesai ücret × çarpanla hesaplanır.
 */
export function earnings({ net, overtime }, rate, multiplier = 1.5) {
  if (!(rate > 0)) return null;
  const regular = ((net - overtime) / 60) * rate;
  const extra = (overtime / 60) * rate * multiplier;
  const round = (n) => Math.round(n * 100) / 100;
  return { regular: round(regular), overtime: round(extra), total: round(regular + extra) };
}

/**
 * Haftalık özet.
 * @param {string} anyDate  haftanın herhangi bir günü
 * @param {(date: string) => object|null} tplFor  o günün şablonu
 */
export function weekSummary(anyDate, tplFor, settings) {
  const days = weekBreakdown(weekDates(anyDate).map((date) => ({ date, tpl: tplFor(date) })), settings);
  const sum = totals(days);
  return { days, ...sum, pay: earnings(sum, settings.hourlyRate, settings.overtimeMultiplier) };
}

/**
 * Aylık özet: ayla kesişen her haftanın dökümünden yalnızca o aya ait günler alınır.
 * (Fazla mesai haftalık hedefe göre hesaplandığı için tam haftalar üzerinden gidilir.)
 */
export function monthSummary(year, month, tplFor, settings) {
  const dates = monthDates(year, month);
  const inMonth = new Set(dates);
  const days = [];
  for (let monday = startOfWeek(dates[0]); monday <= dates[dates.length - 1]; monday = addDays(monday, 7)) {
    const week = weekBreakdown(weekDates(monday).map((date) => ({ date, tpl: tplFor(date) })), settings);
    days.push(...week.filter((d) => inMonth.has(d.date)));
  }
  const sum = totals(days);
  return { days, ...sum, pay: earnings(sum, settings.hourlyRate, settings.overtimeMultiplier) };
}
