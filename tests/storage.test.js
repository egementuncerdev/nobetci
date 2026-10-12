import { test, eq, ok } from './harness.js';
import { load, save, normalize, importJSON, exportJSON, demoState } from '../js/storage.js';

test('Depolama yoksa load null döner, save false döner (çökmez)', () => {
  const had = 'localStorage' in globalThis;
  if (!had) {
    eq(load(), null);
    eq(save({}), false);
  } else ok(true);
});

test('Bozuk veri temizlenir: geçersiz saat, bilinmeyen şablon, eksi değer', () => {
  const s = normalize({
    settings: { weeklyTarget: -5, sleep: { start: '25:00', end: '07:30' } },
    templates: [{ id: 'a', name: 'A', start: '9:00', end: '17:00', breakMin: 30, color: 'red' }],
    shifts: { '2026-10-12': 'a', '2026-10-13': 'yok', 'tarih-degil': 'a' },
    goals: [{ id: 'g', name: 'G', weeklyHours: 5, minSession: 90, maxSession: 30 }]
  });
  eq(s.settings.weeklyTarget, 45, 'eksi hedef → varsayılan');
  eq(s.settings.sleep.start, '00:00', 'geçersiz saat → varsayılan');
  eq(s.templates[0].start, '09:00', '9:00 geçersiz biçim → varsayılan');
  eq(s.templates[0].color, '#8a9099');
  eq(Object.keys(s.shifts), ['2026-10-12']);
  ok(s.goals[0].maxSession >= s.goals[0].minSession, 'max ≥ min');
});

test('JSON yedek dışa → içe aktarılınca aynı veri', () => {
  const s = demoState('tr', '2026-10-14');
  const back = importJSON(exportJSON(s));
  eq(back.shifts, s.shifts);
  eq(back.goals, s.goals);
  eq(back.settings, s.settings);
});

test('Başka uygulamanın JSON dosyası reddedilir', () => {
  let threw = false;
  try { importJSON(JSON.stringify({ app: 'baska' })); } catch (e) { threw = true; }
  ok(threw);
});
