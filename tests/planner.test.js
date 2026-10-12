import { test, eq, ok } from './harness.js';
import { shiftInterval, toHHMM, addDays, dayNumber, DAY } from '../js/calc.js';
import { dayLayout, splitSessions, plan, fits, RULES } from '../js/planner.js';

const T = {
  morning: { start: '06:30', end: '15:00', breakMin: 60 },
  evening: { start: '14:30', end: '23:00', breakMin: 60 },
  night: { start: '22:00', end: '07:00', breakMin: 60 }
};
const SETTINGS = { sleep: { start: '00:00', end: '07:30' }, buffer: 45 };
const MON = '2026-10-12';

const intervals = (map) => (date) => shiftInterval(date, T[map[date]]);
/** Mutlak aralıkları gün içi "HH:MM–HH:MM" metnine çevirir (okunaklı test) */
const fmt = (date, list) => list.map((x) => {
  const base = dayNumber(date) * DAY;
  const end = x.end - base === DAY ? '24:00' : toHHMM(x.end - base);
  return `${x.type ? x.type + ' ' : ''}${toHHMM(x.start - base)}–${end}`;
});

/* ---------- Günün yerleşimi ---------- */

test('Boş gün: uyku dışındaki her şey boş; uyku öncesi 30 dk planlanmaz', () => {
  const L = dayLayout(MON, () => null, SETTINGS);
  eq(fmt(MON, L.blocks), ['sleep 00:00–07:30']);
  eq(fmt(MON, L.free), ['07:30–24:00']);
  eq(fmt(MON, L.usable), ['07:30–23:30'], 'ertesi gecenin uykusundan önce 30 dk');
});

test('Sabah vardiyası: erken kalkılır, yol eklenir, vardiya sonrası dinlenme payı', () => {
  const L = dayLayout(MON, intervals({ [MON]: 'morning' }), SETTINGS);
  eq(fmt(MON, L.blocks), ['sleep 00:00–05:45', 'buffer 05:45–06:30', 'shift 06:30–15:00', 'buffer 15:00–15:45']);
  eq(fmt(MON, L.free), ['15:45–24:00']);
  eq(fmt(MON, L.usable), ['16:15–23:30'], `vardiya + yol sonrası ${RULES.REST} dk boş`);
});

test('Gece vardiyası (22:00–07:00): ertesi gün gündüz uyunur', () => {
  const TUE = addDays(MON, 1);
  const L = dayLayout(TUE, intervals({ [MON]: 'night' }), SETTINGS);
  eq(fmt(TUE, L.blocks), ['shift 00:00–07:00', 'buffer 07:00–07:45', 'sleep 07:45–15:15']);
  eq(fmt(TUE, L.free), ['15:15–24:00']);
});

test('Gece vardiyası günü: akşam yola çıkılır, o akşam boş zaman yolda biter', () => {
  const L = dayLayout(MON, intervals({ [MON]: 'night' }), SETTINGS);
  eq(fmt(MON, L.free), ['07:30–21:15']);
});

/* ---------- Oturum bölme ---------- */

test('Haftalık hedef eşit oturumlara bölünür', () => {
  eq(splitSessions(720, 45, 90), [90, 90, 90, 90, 90, 90, 90, 90], '12 sa → 8 × 90 dk');
  eq(splitSessions(180, 45, 60), [60, 60, 60], '3 sa → 3 × 60 dk');
  eq(splitSessions(100, 45, 90), [50, 50], '100 dk → 2 × 50 dk');
  eq(splitSessions(0, 45, 90), []);
});

/* ---------- Planlayıcı ---------- */

const week = Array.from({ length: 7 }, (_, i) => addDays(MON, i));

test('Planla: hedef tamamen yerleşir ve günlere yayılır', () => {
  const r = plan({
    dates: week,
    intervalFor: intervals({ [week[0]]: 'morning', [week[1]]: 'morning', [week[2]]: 'evening' }),
    settings: SETTINGS,
    goals: [{ id: 'k', weeklyHours: 6, minSession: 45, maxSession: 90 }]
  });
  const all = Object.values(r.sessions).flat();
  eq(all.reduce((t, s) => t + s.duration, 0), 360, '6 saat');
  eq(r.unplaced, []);
  const daysUsed = Object.values(r.sessions).filter((l) => l.length).length;
  eq(daysUsed, 4, '4 oturum 4 farklı güne');
});

test('Planla: vardiya bitiminden hemen sonraya ve uyku öncesine oturum koymaz', () => {
  const map = Object.fromEntries(week.map((d) => [d, 'morning']));
  const r = plan({ dates: week, intervalFor: intervals(map), settings: SETTINGS, goals: [{ id: 'k', weeklyHours: 10, minSession: 45, maxSession: 90 }] });
  for (const [date, list] of Object.entries(r.sessions)) {
    for (const s of list) {
      ok(s.start >= 16 * 60 + 15, `${date} ${toHHMM(s.start)}: 15:45 + 30 dk'dan önce olmamalı`);
      ok(s.start + s.duration <= 23 * 60 + 30, `${date}: 23:30'dan sonra bitmemeli`);
    }
  }
});

test('Planla: sığmayan saatleri raporlar', () => {
  // Her gün 16 saatlik vardiya (+ yol + uyku): neredeyse hiç boş zaman yok
  const long = { start: '07:00', end: '23:00', breakMin: 60 };
  const r = plan({
    dates: week,
    intervalFor: (d) => shiftInterval(d, long),
    settings: SETTINGS,
    goals: [{ id: 'k', weeklyHours: 12, minSession: 45, maxSession: 90 }]
  });
  const missing = r.unplaced.find((u) => u.goalId === 'k');
  ok(missing && missing.minutes > 0, 'sığmayan dakika raporlanmalı');
  const placed = Object.values(r.sessions).flat().reduce((t, s) => t + s.duration, 0);
  eq(placed + missing.minutes, 720, 'yerleşen + sığmayan = hedef');
});

test('Planla: iki hedef aynı gün çakışmaz, aralarında boşluk kalır', () => {
  const r = plan({
    dates: week,
    intervalFor: intervals({}),
    settings: SETTINGS,
    goals: [
      { id: 'a', weeklyHours: 14, minSession: 60, maxSession: 120 },
      { id: 'b', weeklyHours: 7, minSession: 60, maxSession: 60 }
    ]
  });
  for (const list of Object.values(r.sessions)) {
    for (let i = 1; i < list.length; i++) {
      ok(list[i].start >= list[i - 1].start + list[i - 1].duration + RULES.GAP, 'oturumlar arası boşluk');
    }
  }
  eq(r.unplaced, []);
});

/* ---------- Elle taşıma ---------- */

test('fits: vardiyaya ya da başka oturuma denk gelen taşıma reddedilir', () => {
  const L = dayLayout(MON, intervals({ [MON]: 'morning' }), SETTINGS);
  const sessions = [{ goalId: 'k', start: 17 * 60, duration: 60 }];
  ok(fits(L, sessions, { start: 19 * 60, duration: 60 }), '19:00 boş');
  ok(!fits(L, sessions, { start: 14 * 60, duration: 60 }), '14:00 vardiyada');
  ok(!fits(L, sessions, { start: 17 * 60 + 30, duration: 60 }), 'diğer oturumla çakışıyor');
  ok(fits(L, sessions, { start: 17 * 60 + 15, duration: 60 }, 0), 'kendisiyle çakışması sayılmaz');
  ok(!fits(L, sessions, { start: 23 * 60 + 30, duration: 60 }), 'gün dışına taşıyor');
});
