import { test, eq, ok } from './harness.js';
import { buildICS, fold, escapeText, localStamp, weekEvents } from '../js/ics.js';

test('ICS: gece yarısını geçen vardiya ertesi gün biter', () => {
  eq(localStamp('2026-10-12', 22 * 60), '20261012T220000');
  eq(localStamp('2026-10-12', 24 * 60 + 7 * 60), '20261013T070000');
  eq(localStamp('2026-12-31', 25 * 60), '20270101T010000', 'yıl sınırı');
});

test('ICS: dosya yapısı, saat dilimi ve CRLF', () => {
  const ics = buildICS([{ uid: 'a', title: 'Gece', date: '2026-10-12', start: 1320, end: 1860 }], { now: new Date('2026-10-12T09:00:00Z') });
  ok(ics.startsWith('BEGIN:VCALENDAR\r\n'), 'CRLF ile başlar');
  ok(ics.endsWith('END:VCALENDAR\r\n'));
  ok(ics.includes('DTSTART;TZID=Europe/Istanbul:20261012T220000'));
  ok(ics.includes('DTEND;TZID=Europe/Istanbul:20261013T070000'));
  ok(ics.includes('BEGIN:VTIMEZONE') && ics.includes('TZOFFSETTO:+0300'));
  ok(ics.includes('DTSTAMP:20261012T090000Z'));
  ok(!/[^\r]\n/.test(ics), 'tek başına LF yok');
});

test('ICS: metin kaçışı ve 75 bayt satır katlama', () => {
  eq(escapeText('KPSS; tarih, coğrafya\nnot'), 'KPSS\\; tarih\\, coğrafya\\nnot');
  const long = 'SUMMARY:' + 'ğ'.repeat(60);
  const folded = fold(long);
  const enc = new TextEncoder();
  folded.split('\r\n').forEach((line) => ok(enc.encode(line).length <= 75, 'her satır ≤ 75 bayt'));
  eq(folded.replace(/\r\n /g, ''), long, 'katlama geri açılınca aynı');
});

test('ICS: haftadan vardiya ve oturum etkinlikleri', () => {
  const tpl = { name: 'Gece', start: '22:00', end: '07:00', breakMin: 60 };
  const ev = weekEvents(['2026-10-12', '2026-10-13'], (d) => (d === '2026-10-12' ? tpl : { off: true }),
    { '2026-10-13': [{ id: 'x', goalId: 'k', start: 900, duration: 90 }] }, new Map([['k', { name: 'KPSS' }]]));
  eq(ev.length, 2, 'izin günü etkinlik olmaz');
  eq([ev[0].start, ev[0].end], [1320, 1860]);
  eq(ev[1].title, 'KPSS');
});
