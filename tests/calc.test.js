import { test, eq, ok } from './harness.js';
import {
  toMin, toHHMM, addDays, weekday, startOfWeek, weekDates, shiftInterval, grossMinutes,
  netMinutes, nightMinutes, weekBreakdown, totals, earnings, weekSummary, monthSummary
} from '../js/calc.js';

const T = {
  morning: { start: '06:30', end: '15:00', breakMin: 60 },
  evening: { start: '14:30', end: '23:00', breakMin: 60 },
  night: { start: '22:00', end: '06:00', breakMin: 30 },
  off: { off: true, start: '00:00', end: '00:00', breakMin: 0 }
};
const SETTINGS = { weeklyTarget: 45, night: { start: '20:00', end: '06:00' }, hourlyRate: 100, overtimeMultiplier: 1.5 };

/* ---------- Saat ve tarih ---------- */

test('toMin / toHHMM gidiş-dönüş', () => {
  eq(toMin('06:30'), 390);
  eq(toHHMM(390), '06:30');
  eq(toHHMM(1440 + 75), '01:15', 'gün sarması');
});

test('Hafta pazartesi başlar; ay ve yıl sınırı', () => {
  eq(weekday('2026-10-12'), 0, '12 Ekim 2026 pazartesi');
  eq(startOfWeek('2026-10-18'), '2026-10-12');
  eq(addDays('2026-12-31', 1), '2027-01-01');
  eq(weekDates('2026-01-01')[0], '2025-12-29', 'yıl sınırını geçen hafta');
});

/* ---------- Gece yarısını geçen vardiya ---------- */

test('22:00–06:00 vardiyası 8 saat brüt, ertesi güne taşar', () => {
  eq(grossMinutes(T.night), 480);
  const iv = shiftInterval('2026-10-12', T.night);
  eq(iv.end - iv.start, 480);
  ok(Math.floor(iv.end / 1440) > Math.floor(iv.start / 1440), 'bitiş ertesi günde olmalı');
});

test('Başlangıç = bitiş ise 24 saatlik vardiya sayılır', () => {
  eq(grossMinutes({ start: '08:00', end: '08:00', breakMin: 0 }), 1440);
});

test('İzin günü ve boş şablon 0 sayılır', () => {
  eq(grossMinutes(T.off), 0);
  eq(shiftInterval('2026-10-12', T.off), null);
  eq(netMinutes(null), 0);
});

/* ---------- Mola ---------- */

test('Mola net süreden düşülür', () => {
  eq(netMinutes(T.morning), 450, '8,5 sa − 60 dk = 7,5 sa');
  eq(netMinutes(T.night), 450, '8 sa − 30 dk');
});

test('Mola vardiyadan uzunsa net süre eksiye düşmez', () => {
  eq(netMinutes({ start: '10:00', end: '10:30', breakMin: 60 }), 0);
});

/* ---------- Gece saatleri ---------- */

test('Gece saatleri: 22:00–06:00 tamamı gece', () => {
  eq(nightMinutes(shiftInterval('2026-10-12', T.night)), 480);
});

test('Gece saatleri: akşam vardiyasının 20:00 sonrası', () => {
  eq(nightMinutes(shiftInterval('2026-10-12', T.evening)), 180, '20:00–23:00');
});

test('Gece saatleri: sabah vardiyasının 06:00 öncesi', () => {
  eq(nightMinutes(shiftInterval('2026-10-12', { start: '04:00', end: '12:00' })), 120, '04:00–06:00');
});

test('Gece saatleri: gündüz vardiyası 0', () => {
  eq(nightMinutes(shiftInterval('2026-10-12', { start: '08:00', end: '17:00' })), 0);
});

/* ---------- Fazla mesai ---------- */

test('Hedef aşılmazsa fazla mesai 0', () => {
  const week = ['morning', 'morning', 'evening', 'evening', 'morning', 'off', 'off']
    .map((k, i) => ({ date: addDays('2026-10-12', i), tpl: T[k] }));
  const t = totals(weekBreakdown(week, SETTINGS));
  eq(t.net, 5 * 450);
  eq(t.overtime, 0);
});

test('Fazla mesai hedefi aştığı günden itibaren yazılır', () => {
  // 7 × 7,5 sa = 52,5 sa → hedef 45 → 7,5 sa fazla mesai, tamamı pazar günü
  const week = Array.from({ length: 7 }, (_, i) => ({ date: addDays('2026-10-12', i), tpl: T.morning }));
  const days = weekBreakdown(week, SETTINGS);
  eq(totals(days).overtime, 450);
  eq(days.map((d) => d.overtime), [0, 0, 0, 0, 0, 0, 450]);
});

test('Hedefi gün ortasında aşan vardiya bölünür', () => {
  // hedef 10 sa: 7,5 + 7,5 = 15 → ikinci gün 2,5 sa normal + 5 sa fazla mesai
  const week = [{ date: '2026-10-12', tpl: T.morning }, { date: '2026-10-13', tpl: T.morning }];
  const days = weekBreakdown(week, { ...SETTINGS, weeklyTarget: 10 });
  eq(days.map((d) => d.overtime), [0, 300]);
});

test('Kazanç: normal + fazla mesai × çarpan', () => {
  eq(earnings({ net: 600, overtime: 60 }, 100, 1.5), { regular: 900, overtime: 150, total: 1050 });
  eq(earnings({ net: 600, overtime: 60 }, null), null, 'ücret yoksa null');
});

test('Haftalık özet uçtan uca', () => {
  const plan = { '2026-10-12': 'night', '2026-10-13': 'night' };
  const s = weekSummary('2026-10-15', (d) => T[plan[d]] || null, SETTINGS);
  eq([s.gross, s.net, s.night, s.overtime], [960, 900, 960, 0]);
  eq(s.pay.total, 1500, '15 sa × 100');
});

test('Aylık özet ay sınırındaki haftayı böler', () => {
  // Ekim 2026: 1 Ekim perşembe. Her gün sabah → ilk haftanın (29 Eyl–4 Eki)
  // fazla mesaisi pazara (4 Ekim) düşer ve Ekim'e sayılır.
  const s = monthSummary(2026, 10, () => T.morning, SETTINGS);
  eq(s.days.length, 31);
  eq(s.net, 31 * 450);
  // Haftalar: 29E–4E (Ekim'de 4 gün), 5–11, 12–18, 19–25, 26E–1K (Ekim'de 6 gün)
  // Fazla mesai: 450 + 450 + 450 + 450 + 0 (26–31 Ekim: 6 gün = 45 sa, hedefi aşmıyor)
  eq(s.overtime, 4 * 450);
});
