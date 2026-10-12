/* ==========================================================================
   storage.js — veri modeli, localStorage, demo verisi, JSON yedek
   Her okuma/yazma try/catch içinde: gizli modda ya da depolama kapalıyken
   uygulama bellekteki verilerle çalışmaya devam eder.
   ========================================================================== */

import { weekDates, todayISO } from './calc.js';

const KEY = 'nobetci:v1';
export const VERSION = 1;

/*  Veri modeli
    {
      version: 1,
      demo: true,                      // örnek veriyle mi açıldı
      settings: {
        lang: 'tr' | 'en',
        theme: 'auto' | 'light' | 'dark',
        weeklyTarget: 45,              // saat
        hourlyRate: null | number,     // ₺ / saat
        overtimeMultiplier: 1.5,
        night: { start: '20:00', end: '06:00' },
        sleep: { start: '00:00', end: '07:30' },
        buffer: 45                     // vardiya öncesi/sonrası hazırlık + yol (dk)
      },
      templates: [{ id, name, start, end, breakMin, color, off }],
      shifts:    { 'YYYY-MM-DD': templateId },
      goals:     [{ id, name, weeklyHours, minSession, maxSession, color }],
      sessions:  { 'YYYY-MM-DD': [{ id, goalId, start, duration }] }   // start: gün içi dakika
    }
*/

export const uid = () => Math.random().toString(36).slice(2, 9);

export function defaultTemplates(lang = 'tr') {
  const tr = lang === 'tr';
  return [
    { id: 'morning', name: tr ? 'Sabah' : 'Morning', start: '06:30', end: '15:00', breakMin: 60, color: '#e8a317', off: false },
    { id: 'evening', name: tr ? 'Akşam' : 'Evening', start: '14:30', end: '23:00', breakMin: 60, color: '#7c5cff', off: false },
    { id: 'night', name: tr ? 'Gece' : 'Night', start: '22:00', end: '07:00', breakMin: 60, color: '#2f7fe0', off: false },
    { id: 'off', name: tr ? 'İzin' : 'Day off', start: '00:00', end: '00:00', breakMin: 0, color: '#8a9099', off: true }
  ];
}

export function defaultSettings(lang = 'tr') {
  return {
    lang,
    theme: 'auto',
    weeklyTarget: 45,
    hourlyRate: null,
    overtimeMultiplier: 1.5,
    night: { start: '20:00', end: '06:00' },
    sleep: { start: '00:00', end: '07:30' },
    buffer: 45
  };
}

/** Boş (sıfırlanmış) durum */
export function emptyState(lang = 'tr') {
  return {
    version: VERSION,
    demo: false,
    settings: defaultSettings(lang),
    templates: defaultTemplates(lang),
    shifts: {},
    goals: [],
    sessions: {}
  };
}

/** Portfolyodan gelen ziyaretçi boş ekran görmesin: içinde bulunulan hafta dolu */
export function demoState(lang = 'tr', today = todayISO()) {
  const s = emptyState(lang);
  s.demo = true;
  s.settings.hourlyRate = 150;
  const [mon, tue, wed, thu, fri, sat, sun] = weekDates(today);
  Object.assign(s.shifts, {
    [mon]: 'morning', [tue]: 'morning', [wed]: 'evening', [thu]: 'evening',
    [fri]: 'night', [sat]: 'night', [sun]: 'off'
  });
  const tr = lang === 'tr';
  s.goals = [
    { id: 'kpss', name: tr ? 'KPSS çalışması' : 'Exam prep', weeklyHours: 12, minSession: 45, maxSession: 90, color: '#16a37f' },
    { id: 'gym', name: tr ? 'Spor' : 'Workout', weeklyHours: 3, minSession: 45, maxSession: 60, color: '#e5484d' }
  ];
  return s;
}

/* ---------- Doğrulama ---------- */

const isHHMM = (v) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const isISO = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const num = (v, min, max, fallback) => (Number.isFinite(+v) && +v >= min && +v <= max ? +v : fallback);
const color = (v, fallback) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : fallback);
const text = (v, fallback) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 40) : fallback);

/** Dışarıdan gelen (localStorage ya da içe aktarılan) veriyi güvenli bir duruma çevirir */
export function normalize(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('invalid');
  const lang = raw.settings?.lang === 'en' ? 'en' : 'tr';
  const base = emptyState(lang);
  const st = raw.settings || {};

  const settings = {
    lang,
    theme: ['auto', 'light', 'dark'].includes(st.theme) ? st.theme : 'auto',
    weeklyTarget: num(st.weeklyTarget, 0, 168, 45),
    hourlyRate: st.hourlyRate == null || st.hourlyRate === '' ? null : num(st.hourlyRate, 0, 100000, null),
    overtimeMultiplier: num(st.overtimeMultiplier, 1, 5, 1.5),
    night: {
      start: isHHMM(st.night?.start) ? st.night.start : '20:00',
      end: isHHMM(st.night?.end) ? st.night.end : '06:00'
    },
    sleep: {
      start: isHHMM(st.sleep?.start) ? st.sleep.start : '00:00',
      end: isHHMM(st.sleep?.end) ? st.sleep.end : '07:30'
    },
    buffer: num(st.buffer, 0, 240, 45)
  };

  const templates = Array.isArray(raw.templates)
    ? raw.templates.filter((t) => t && t.id).map((t) => ({
      id: String(t.id).slice(0, 20),
      name: text(t.name, '—'),
      start: isHHMM(t.start) ? t.start : '09:00',
      end: isHHMM(t.end) ? t.end : '17:00',
      breakMin: num(t.breakMin, 0, 600, 0),
      color: color(t.color, '#8a9099'),
      off: !!t.off
    }))
    : base.templates;
  const ids = new Set(templates.map((t) => t.id));

  const shifts = {};
  for (const [d, id] of Object.entries(raw.shifts || {})) if (isISO(d) && ids.has(id)) shifts[d] = id;

  const goals = Array.isArray(raw.goals)
    ? raw.goals.filter((g) => g && g.id).map((g) => {
      const minSession = num(g.minSession, 15, 600, 45);
      return {
        id: String(g.id).slice(0, 20),
        name: text(g.name, '—'),
        weeklyHours: num(g.weeklyHours, 0, 100, 0),
        minSession,
        maxSession: Math.max(minSession, num(g.maxSession, 15, 600, 90)),
        color: color(g.color, '#16a37f')
      };
    })
    : [];
  const goalIds = new Set(goals.map((g) => g.id));

  const sessions = {};
  for (const [d, list] of Object.entries(raw.sessions || {})) {
    if (!isISO(d) || !Array.isArray(list)) continue;
    const ok = list.filter((x) => x && goalIds.has(x.goalId)).map((x) => ({
      id: String(x.id || uid()),
      goalId: x.goalId,
      start: num(x.start, 0, 1439, 0),
      duration: num(x.duration, 5, 1440, 45)
    }));
    if (ok.length) sessions[d] = ok;
  }

  return { version: VERSION, demo: !!raw.demo, settings, templates, shifts, goals, sessions };
}

/* ---------- localStorage ---------- */

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalize(JSON.parse(raw)) : null;
  } catch (e) {
    return null;
  }
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    return false;
  }
}

export function clear() {
  try { localStorage.removeItem(KEY); } catch (e) { /* yok say */ }
}

/* ---------- JSON yedek ---------- */

export function exportJSON(state) {
  return JSON.stringify({ app: 'nobetci', exportedAt: new Date().toISOString(), ...state }, null, 2);
}

/** Geçersizse hata fırlatır; arayüz kullanıcıya bildirir */
export function importJSON(textValue) {
  const data = JSON.parse(textValue);
  if (data.app && data.app !== 'nobetci') throw new Error('invalid');
  return normalize(data);
}
