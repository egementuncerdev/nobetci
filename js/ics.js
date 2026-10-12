/* ==========================================================================
   ics.js — haftanın vardiyalarını ve oturumlarını .ics (iCalendar) dosyasına çevirir
   Google Takvim, iOS/macOS Takvim ve Outlook ile açılır.
   Saf fonksiyonlar: tarih/saat dışarıdan verilir, test edilebilir.

   Kurallar (RFC 5545):
   - Satır sonları CRLF
   - 75 bayttan uzun satırlar kırpılıp bir boşlukla devam ettirilir
   - Metinlerde \ ; , ve satır sonu kaçışlanır
   - Saat dilimi: Europe/Istanbul (2016'dan beri yıl boyu UTC+3, yaz saati yok)
   ========================================================================== */

import { addDays, toMin, DAY } from './calc.js';

const TZ = 'Europe/Istanbul';

const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  `TZID:${TZ}`,
  'BEGIN:STANDARD',
  'DTSTART:20160907T000000',
  'TZOFFSETFROM:+0300',
  'TZOFFSETTO:+0300',
  'TZNAME:+03',
  'END:STANDARD',
  'END:VTIMEZONE'
];

/** Metin alanı kaçışı */
export function escapeText(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** 75 bayt kuralına göre satır katlama (UTF-8 çok baytlı karakterleri bölmeden) */
export function fold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts = [];
  let current = '';
  let limit = 75;
  for (const ch of line) {
    if (enc.encode(current + ch).length > limit) {
      parts.push(current);
      current = ch;
      limit = 74; // devam satırları baştaki boşlukla birlikte 75
    } else current += ch;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

/** '2026-10-12' + 390 dk → '20261012T063000' (yerel saat; gün taşmasını işler) */
export function localStamp(date, minutes) {
  const dayShift = Math.floor(minutes / DAY);
  const m = ((minutes % DAY) + DAY) % DAY;
  const d = addDays(date, dayShift).replace(/-/g, '');
  return `${d}T${String(Math.floor(m / 60)).padStart(2, '0')}${String(m % 60).padStart(2, '0')}00`;
}

/** Date → '20261012T093000Z' */
const utcStamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/**
 * @param {{uid, title, date, start, end, description?}[]} events
 *   date: 'YYYY-MM-DD', start/end: o günün 00:00'ından itibaren dakika (end > 1440 olabilir)
 * @param {{now?: Date, calName?: string}} opts
 */
export function buildICS(events, { now = new Date(), calName = 'Nöbetçi' } = {}) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nobetci//Vardiya Planlayici//TR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calName)}`,
    `X-WR-TIMEZONE:${TZ}`,
    ...VTIMEZONE
  ];
  const stamp = utcStamp(now);
  for (const ev of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${ev.uid}@nobetci.egementuncer.dev`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=${TZ}:${localStamp(ev.date, ev.start)}`,
      `DTEND;TZID=${TZ}:${localStamp(ev.date, ev.end)}`,
      `SUMMARY:${escapeText(ev.title)}`,
      ...(ev.description ? [`DESCRIPTION:${escapeText(ev.description)}`] : []),
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

/**
 * Uygulama verisinden bir haftanın etkinliklerini çıkarır.
 * @param {string[]} dates  haftanın günleri
 * @param {(date) => tpl|null} tplFor
 * @param {Record<string, {id, goalId, start, duration}[]>} sessions
 * @param {Map<string, {name}>} goals
 */
export function weekEvents(dates, tplFor, sessions, goals, labels = { plan: 'Plan' }) {
  const events = [];
  for (const date of dates) {
    const tpl = tplFor(date);
    if (tpl && !tpl.off) {
      const start = toMin(tpl.start);
      let end = toMin(tpl.end);
      if (end <= start) end += DAY;
      events.push({
        uid: `shift-${date}`,
        title: `${tpl.name} (${tpl.start}–${tpl.end})`,
        date, start, end,
        description: tpl.breakMin ? `${tpl.breakMin} dk mola` : ''
      });
    }
    for (const s of sessions[date] || []) {
      events.push({
        uid: `session-${date}-${s.id}`,
        title: `${goals.get(s.goalId)?.name || labels.plan}`,
        date, start: s.start, end: s.start + s.duration,
        description: labels.plan
      });
    }
  }
  return events;
}
