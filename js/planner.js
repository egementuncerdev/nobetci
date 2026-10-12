/* ==========================================================================
   planner.js — "Boş zaman bulucu" ve hedef planlayıcı
   Saf fonksiyonlar: aynı girdi → aynı çıktı. DOM'a ve depolamaya dokunmaz.

   Bir gün nasıl hesaplanır?
     1. Vardiyalar (önceki günden taşanlar ve ertesi günün erken vardiyası dahil)
     2. Her vardiyanın önüne ve arkasına "hazırlık + yol" süresi
     3. Uyku penceresi. Vardiya (+ yol) uykuyla çakışırsa:
        - uykunun en az yarısı vardiyadan önce kalıyorsa erken kalkılır
          (sabah vardiyası: 00:00–07:30 → 00:00–05:45),
        - kalmıyorsa aynı uzunlukta uyku vardiyadan sonraya kayar
          (gece vardiyası: gündüz uyunur).
     4. Gün içinde kalan boşluklar = boş zaman

   Planlama kuralları
     - Oturumlar mümkün olduğunca farklı günlere yayılır.
     - Vardiya (ve yol) bittikten hemen sonraki REST dakikaya oturum konmaz.
     - Uykudan önceki son WIND_DOWN dakikaya oturum konmaz.
     - Aynı gündeki iki oturum arasında en az GAP dakika bırakılır.
     - Sığmayan dakikalar "unplaced" olarak raporlanır.

   Zaman birimi: "mutlak dakika" (calc.js ile aynı): gün numarası × 1440 + dakika.
   ========================================================================== */

import { DAY, dayNumber, toMin } from './calc.js';

export const RULES = {
  REST: 30,       // vardiya + yol sonrası dinlenme payı
  WIND_DOWN: 30,  // uyku öncesi boş bırakılan süre
  GAP: 15,        // aynı gündeki iki oturum arası
  STEP: 5         // oturum süreleri bu katlara yuvarlanır
};

/* ---------- Aralık yardımcıları ---------- */

const clip = (iv, win) => {
  const start = Math.max(iv.start, win.start);
  const end = Math.min(iv.end, win.end);
  return end > start ? { ...iv, start, end } : null;
};

/** Aralık listesini sıralayıp çakışanları birleştirir */
function merge(list) {
  const sorted = list.filter(Boolean).map((x) => ({ start: x.start, end: x.end })).sort((a, b) => a.start - b.start);
  const out = [];
  for (const iv of sorted) {
    const last = out[out.length - 1];
    if (last && iv.start <= last.end) last.end = Math.max(last.end, iv.end);
    else out.push({ ...iv });
  }
  return out;
}

/** [win] aralığından [busy] aralıklarını çıkarır */
function subtract(win, busy) {
  const out = [];
  let cursor = win.start;
  for (const b of merge(busy)) {
    if (b.end <= cursor) continue;
    if (b.start >= win.end) break;
    if (b.start > cursor) out.push({ start: cursor, end: Math.min(b.start, win.end) });
    cursor = Math.max(cursor, b.end);
  }
  if (cursor < win.end) out.push({ start: cursor, end: win.end });
  return out;
}

const overlaps = (a, b) => a.start < b.end && b.start < a.end;

/* ---------- Bir günün yerleşimi ---------- */

/**
 * @param {string} date
 * @param {(date: string) => {start, end}|null} intervalFor  o gün başlayan vardiyanın mutlak aralığı
 * @param {{sleep: {start, end}, buffer: number}} settings
 * @returns {{
 *   window: {start, end},
 *   blocks: {type: 'shift'|'buffer'|'sleep', start, end}[],   // gün içine kırpılmış
 *   free:   {start, end}[],                                    // boş dilimler
 *   usable: {start, end}[]                                     // planlamaya uygun dilimler
 * }}
 */
export function dayLayout(date, intervalFor, settings) {
  const d = dayNumber(date);
  const window = { start: d * DAY, end: (d + 1) * DAY };
  const buffer = Math.max(0, settings.buffer || 0);

  // 1–2. Vardiyalar ve yolları: önceki, bugünkü ve sonraki gün
  const shifts = [];
  for (let k = -1; k <= 1; k++) {
    const iv = intervalFor(isoFromDay(d + k));
    if (iv) shifts.push(iv);
  }
  const shiftBlocks = shifts.map((s) => ({ type: 'shift', start: s.start, end: s.end }));
  const bufferBlocks = shifts.flatMap((s) => [
    { type: 'buffer', start: s.start - buffer, end: s.start },
    { type: 'buffer', start: s.end, end: s.end + buffer }
  ]);
  const work = merge([...shiftBlocks, ...bufferBlocks]);

  // 3. Uyku: her gün için pencere; vardiyayla çakışırsa vardiya sonrasına kayar
  const ss = toMin(settings.sleep.start);
  const se = toMin(settings.sleep.end);
  const sleepLen = ((se - ss + DAY) % DAY) || DAY;
  const sleepBlocks = [];
  for (let k = -1; k <= 1; k++) {
    const base = (d + k) * DAY;
    let sleep = { start: base + ss, end: base + ss + sleepLen };
    const clash = work.find((w) => overlaps(w, sleep));
    if (clash) {
      if (clash.start - sleep.start >= sleepLen / 2) sleep.end = clash.start;      // erken kalk
      else sleep = { start: clash.end, end: clash.end + sleepLen };              // vardiyadan sonra uyu
    }
    // Kaydırılan uyku bir sonraki işe çarparsa orada biter
    const next = work.find((w) => w.start >= sleep.start && w.start < sleep.end);
    if (next) sleep.end = next.start;
    if (sleep.end > sleep.start) sleepBlocks.push({ type: 'sleep', ...sleep });
  }

  // Görsel bloklar: öncelik vardiya > yol > uyku (çakışan kısımlar üstteki türe ait)
  const blocks = [];
  const taken = [];
  for (const b of [...shiftBlocks, ...bufferBlocks, ...sleepBlocks]) {
    for (const piece of subtract(b, taken)) {
      const c = clip({ type: b.type, ...piece }, window);
      if (c) blocks.push(c);
    }
    taken.push(b);
  }
  blocks.sort((a, b) => a.start - b.start);

  // 4. Boş zaman
  const free = subtract(window, blocks);

  // Planlamaya uygun kısım: vardiya/yol bitişinden sonra REST, uykudan önce WIND_DOWN payı
  const allWork = merge([...shiftBlocks, ...bufferBlocks]);
  const allSleep = sleepBlocks;
  const usable = free.map((f) => {
    let { start, end } = f;
    if (allWork.some((w) => w.end === start)) start += RULES.REST;
    if (allSleep.some((s) => s.start === end)) end -= RULES.WIND_DOWN;
    return end > start ? { start, end } : null;
  }).filter(Boolean);

  return { window, blocks, free, usable };
}

/** Gün numarası → 'YYYY-MM-DD' */
function isoFromDay(n) {
  return new Date(n * 86400000).toISOString().slice(0, 10);
}

/* ---------- Hedef → oturum uzunlukları ---------- */

/**
 * Haftalık dakikayı min–max aralığında, olabildiğince eşit oturumlara böler.
 * 12 sa, 45–90 dk → 8 × 90 dk.  3 sa, 45–60 dk → 3 × 60 dk.
 */
export function splitSessions(totalMin, min, max) {
  if (totalMin <= 0) return [];
  const n = Math.max(1, Math.ceil(totalMin / max));
  const round = (v) => Math.round(v / RULES.STEP) * RULES.STEP;
  const len = Math.min(max, Math.max(min, round(totalMin / n)));
  const lengths = Array(n).fill(len);
  // Yuvarlamadan kalan farkı son oturuma ver (min–max içinde kalacak şekilde)
  const diff = totalMin - len * n;
  lengths[n - 1] = Math.min(max, Math.max(min, len + diff));
  return lengths;
}

/* ---------- Planlayıcı ---------- */

/**
 * @param {object} o
 * @param {string[]} o.dates            haftanın 7 günü
 * @param {(date) => {start,end}|null} o.intervalFor
 * @param {object} o.settings           { sleep, buffer }
 * @param {{id, weeklyHours, minSession, maxSession}[]} o.goals
 * @returns {{ sessions: Record<string, {goalId, start, duration}[]>, unplaced: {goalId, minutes}[] }}
 *          start: o günün 00:00'ından itibaren dakika
 */
export function plan({ dates, intervalFor, settings, goals }) {
  // Her günün planlamaya uygun dilimleri (yerleştirdikçe küçülür)
  const days = dates.map((date) => ({
    date,
    base: dayNumber(date) * DAY,
    slots: dayLayout(date, intervalFor, settings).usable.map((s) => ({ ...s })),
    count: 0,            // o güne konan oturum sayısı
    perGoal: new Map()   // hedef → o gündeki oturum sayısı
  }));

  // Oturum kuyruğu: hedefler sırayla birer oturum alır (round-robin), böylece günleri paylaşırlar
  const queues = goals
    .filter((g) => g.weeklyHours > 0)
    .map((g) => ({ goal: g, lengths: splitSessions(Math.round(g.weeklyHours * 60), g.minSession, g.maxSession) }))
    .sort((a, b) => b.lengths.length - a.lengths.length);
  const queue = [];
  for (let i = 0; queues.some((q) => i < q.lengths.length); i++) {
    for (const q of queues) if (i < q.lengths.length) queue.push({ goal: q.goal, length: q.lengths[i] });
  }

  const sessions = Object.fromEntries(dates.map((d) => [d, []]));
  const missing = new Map();

  for (const { goal, length } of queue) {
    const placed = place(days, goal, length) || (length > goal.minSession && place(days, goal, goal.minSession, length));
    if (!placed) {
      missing.set(goal.id, (missing.get(goal.id) || 0) + length);
      continue;
    }
    sessions[placed.date].push({ goalId: goal.id, start: placed.start, duration: placed.duration });
    if (placed.short) missing.set(goal.id, (missing.get(goal.id) || 0) + placed.short);
  }

  for (const list of Object.values(sessions)) list.sort((a, b) => a.start - b.start);
  const unplaced = [...missing].map(([goalId, minutes]) => ({ goalId, minutes }));
  return { sessions, unplaced };
}

/**
 * Tek bir oturumu en uygun güne koyar.
 * Gün seçimi (küçük puan kazanır):
 *   - bu hedefin o günde zaten oturumu varsa +100 (aynı güne yığılmasın)
 *   - o güne konan her oturum +10 (yük dengesi)
 *   - günün en büyük boş dilimi ne kadar büyükse o kadar az puan
 * Gün içinde: oturumun sığdığı en büyük dilimin başına konur.
 * @param {number} [wanted]  kısaltılmış yerleştirmede asıl istenen süre (eksik kısım raporlanır)
 */
function place(days, goal, length, wanted = length) {
  let best = null;
  for (const day of days) {
    const slot = day.slots.filter((s) => s.end - s.start >= length).sort((a, b) => (b.end - b.start) - (a.end - a.start))[0];
    if (!slot) continue;
    const score = (day.perGoal.get(goal.id) || 0) * 100 + day.count * 10 - (slot.end - slot.start) / 60;
    if (!best || score < best.score) best = { day, slot, score };
  }
  if (!best) return null;

  const { day, slot } = best;
  const start = slot.start;
  // Dilimi kısalt: oturum + aradaki boşluk
  slot.start = Math.min(slot.end, start + length + RULES.GAP);
  day.slots = day.slots.filter((s) => s.end > s.start);
  day.count += 1;
  day.perGoal.set(goal.id, (day.perGoal.get(goal.id) || 0) + 1);

  return { date: day.date, start: start - day.base, duration: length, short: wanted - length };
}

/* ---------- Elle taşıma kontrolü ---------- */

/**
 * Bir oturum (gün içi dakika) o güne sığıyor mu? Vardiya, yol, uyku ve
 * diğer oturumlarla çakışmamalı. Gün dışına taşmamalı.
 */
export function fits(layout, daySessions, candidate, ignoreIndex = -1) {
  const base = layout.window.start;
  const iv = { start: base + candidate.start, end: base + candidate.start + candidate.duration };
  if (iv.start < layout.window.start || iv.end > layout.window.end) return false;
  if (layout.blocks.some((b) => overlaps(b, iv))) return false;
  return !daySessions.some((s, i) => i !== ignoreIndex && overlaps({ start: base + s.start, end: base + s.start + s.duration }, iv));
}

/** Bir günün toplam boş dakikası */
export const freeMinutes = (layout) => layout.free.reduce((t, f) => t + (f.end - f.start), 0);
