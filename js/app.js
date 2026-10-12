/* ==========================================================================
   app.js — arayüz: durum, görünümler, olaylar
   Hesaplar calc.js'te, planlama planner.js'te; burada yalnızca bağlama ve çizim var.
   ========================================================================== */

import {
  weekDates, addDays, todayISO, toMin, toHHMM, grossMinutes, netMinutes, weekSummary, monthSummary,
  shiftInterval, startOfWeek, DAY
} from './calc.js';
import * as store from './storage.js';
import { dayLayout, plan, fits, freeMinutes } from './planner.js';
import {
  t, setLang, getLang, applyStatic, fmtDuration, fmtHours, fmtMoney, fmtDayMonth, fmtMonthYear, fmtWeekRange
} from './i18n.js';

/* ---------- Durum ---------- */

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const today = todayISO();

let state = store.load();
let firstRunPlan = false;
let storageOk = true;
if (!state) {
  const lang = (navigator.language || 'tr').toLowerCase().startsWith('tr') ? 'tr' : 'en';
  state = store.demoState(lang, today);
  storageOk = store.save(state);
  firstRunPlan = true;
}

const view = {
  tab: 'week',
  week: startOfWeek(today), // gösterilen haftanın pazartesisi
  freeDay: today             // boş zaman görünümünde seçili gün
};

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const tplById = () => new Map(state.templates.map((x) => [x.id, x]));
const tplFor = (date) => tplById().get(state.shifts[date]) || null;

/** Durumu değiştir, kaydet, yeniden çiz */
function commit(mutate, { render: doRender = true } = {}) {
  mutate(state);
  storageOk = store.save(state) && storageOk;
  if (doRender) render();
}

/* ---------- Yardımcılar ---------- */

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('is-on');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('is-on'), 2600);
}

function download(filename, data, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const dayName = (iso, form = 'long') => t(form === 'long' ? 'day.long' : 'day.short')[(new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7];
const timeRange = (tpl) => `${tpl.start}–${tpl.end}`;
const gsapOk = () => window.gsap && !reduceMotion;

/* ---------- Alttan açılan panel ---------- */

const sheet = $('#sheet');
function openSheet(title, html, onMount) {
  $('#sheet-title').textContent = title;
  $('#sheet-body').innerHTML = html;
  if (!sheet.open) sheet.showModal();
  onMount?.($('#sheet-body'));
}
function closeSheet() { if (sheet.open) sheet.close(); }
sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); }); // arka plana tıklama

/** Onay paneli → Promise<boolean> */
function ask(message, okLabel = t('confirm.ok'), danger = true) {
  return new Promise((resolve) => {
    openSheet('', `
      <p class="confirm-text">${esc(message)}</p>
      <div class="form-actions">
        <button class="btn btn--ghost" type="button" data-answer="no">${esc(t('confirm.cancel'))}</button>
        <button class="btn ${danger ? 'btn--primary' : 'btn--primary'}" type="button" data-answer="yes">${esc(okLabel)}</button>
      </div>`, (body) => {
      const done = (v) => { sheet.removeEventListener('close', onClose); closeSheet(); resolve(v); };
      const onClose = () => resolve(false);
      sheet.addEventListener('close', onClose, { once: true });
      body.querySelector('[data-answer="yes"]').addEventListener('click', () => done(true));
      body.querySelector('[data-answer="no"]').addEventListener('click', () => done(false));
      body.querySelector('[data-answer="yes"]').focus();
    });
  });
}

/* ==========================================================================
   HAFTA
   ========================================================================== */

/** Gün şeridinin altındaki 24 saatlik mini çubuk */
function dayBar(date) {
  const parts = [];
  // gece penceresi (soluk bant)
  const ns = toMin(state.settings.night.start);
  const ne = toMin(state.settings.night.end);
  const band = (a, b) => `<span class="night-band" style="left:${(a / DAY) * 100}%;width:${((b - a) / DAY) * 100}%"></span>`;
  if (ns > ne) parts.push(band(0, ne), band(ns, DAY));
  else parts.push(band(ns, ne));

  // önceki günden taşan vardiya
  const prev = tplFor(addDays(date, -1));
  const prevIv = shiftInterval(addDays(date, -1), prev);
  if (prevIv) {
    const spill = (prevIv.end % DAY) && Math.floor(prevIv.end / DAY) > Math.floor(prevIv.start / DAY) ? prevIv.end % DAY : 0;
    if (spill) parts.push(`<i class="spill" style="--c:${prev.color};left:0;width:${(spill / DAY) * 100}%"></i>`);
  }
  // bugünün vardiyası (gece yarısında kesilir)
  const tpl = tplFor(date);
  if (tpl && !tpl.off) {
    const s = toMin(tpl.start);
    const e = Math.min(DAY, s + grossMinutes(tpl));
    parts.push(`<i style="--c:${tpl.color};left:${(s / DAY) * 100}%;width:${((e - s) / DAY) * 100}%"></i>`);
  }
  return `<span class="day__bar" aria-hidden="true">${parts.join('')}</span>`;
}

function renderWeek(direction = 0) {
  const dates = weekDates(view.week);
  $('#week-title').textContent = fmtWeekRange(dates[0], dates[6]);
  $('[data-action="week-today"]').hidden = dates.includes(today);

  const s = state.settings;
  const sum = weekSummary(view.week, tplFor, s);

  // Özet kartları
  const target = s.weeklyTarget * 60;
  $('#week-stats').innerHTML = `
    <div class="stat">
      <p class="stat__label">${esc(t('sum.net'))}</p>
      <p class="stat__value">${esc(fmtHours(sum.net))}</p>
      <p class="stat__sub">${esc(t('sum.gross', { v: fmtHours(sum.gross) }))}</p>
    </div>
    <div class="stat">
      <p class="stat__label">${esc(t('sum.overtime'))}</p>
      <p class="stat__value ${sum.overtime ? 'stat__value--alert' : ''}">${esc(fmtHours(sum.overtime))}</p>
      <p class="stat__sub">${esc(t('sum.target', { v: fmtHours(target) }))}</p>
    </div>
    <div class="stat">
      <p class="stat__label">${esc(t('sum.night'))}</p>
      <p class="stat__value">${esc(fmtHours(sum.night))}</p>
      <p class="stat__sub">${esc(t('sum.nightHint', { start: s.night.start, end: s.night.end }))}</p>
    </div>
    <div class="stat">
      <p class="stat__label">${esc(t('sum.pay'))}</p>
      ${sum.pay
        ? `<p class="stat__value">${esc(fmtMoney(sum.pay.total))}</p>
           <p class="stat__sub">${esc(t('sum.payHint', { v: fmtMoney(sum.pay.overtime) }))}</p>`
        : `<p class="stat__value">—</p><button class="link-btn" type="button" data-action="goto-rate">${esc(t('sum.payAdd'))}</button>`}
    </div>`;

  // Günler
  $('#days').innerHTML = sum.days.map((d) => {
    const tpl = tplFor(d.date);
    const label = tpl ? (tpl.off ? tpl.name : `${tpl.name} ${timeRange(tpl)}`) : t('week.empty');
    const shift = tpl
      ? `<span class="day__shift" style="--c:${tpl.color}"><i class="dot"></i><span>${esc(tpl.name)}${tpl.off ? '' : `<small>${esc(timeRange(tpl))}</small>`}</span></span>`
      : `<span class="day__shift day__shift--empty"><i class="dot"></i><span>${esc(t('week.empty'))}</span></span>`;
    return `
      <li class="day ${d.date === today ? 'day--today' : ''}">
        <button class="day__btn" type="button" data-action="pick" data-date="${d.date}"
          aria-label="${esc(t('week.dayAria', { day: `${dayName(d.date)} ${fmtDayMonth(d.date)}`, shift: label }))}">
          <span class="day__date"><b>${esc(dayName(d.date, 'short'))}</b><small>${esc(fmtDayMonth(d.date))}</small></span>
          ${shift}
          <span class="day__hours">${d.net ? esc(fmtHours(d.net)) : ''}${d.overtime ? `<small>+${esc(fmtHours(d.overtime))}</small>` : ''}</span>
          ${dayBar(d.date)}
        </button>
      </li>`;
  }).join('');

  // Ay özeti (haftanın perşembesinin ayı)
  const mid = dates[3];
  const [y, m] = mid.split('-').map(Number);
  const month = monthSummary(y, m, tplFor, s);
  $('#month-card').innerHTML = `
    <h3 class="card__title">${esc(t('sum.month', { month: fmtMonthYear(mid) }))}</h3>
    <dl class="month__grid">
      <div><dt>${esc(t('sum.net'))}</dt><dd>${esc(fmtHours(month.net))}</dd></div>
      <div><dt>${esc(t('sum.overtime'))}</dt><dd>${esc(fmtHours(month.overtime))}</dd></div>
      <div><dt>${esc(t('sum.night'))}</dt><dd>${esc(fmtHours(month.night))}</dd></div>
      <div><dt>${esc(t('sum.pay'))}</dt><dd>${month.pay ? esc(fmtMoney(month.pay.total)) : '—'}</dd></div>
    </dl>`;

  // Hafta geçişi animasyonu
  if (direction && gsapOk()) {
    window.gsap.fromTo('#days > li', { x: direction * 28, opacity: 0 }, { x: 0, opacity: 1, duration: 0.32, stagger: 0.025, ease: 'power2.out', clearProps: 'transform,opacity' });
  }
}

function openPicker(date) {
  const current = state.shifts[date];
  const items = state.templates.map((tpl) => `
    <li><button type="button" data-pick="${esc(tpl.id)}" aria-pressed="${current === tpl.id}">
      <i class="dot" style="--c:${tpl.color}"></i>${esc(tpl.name)}
      <small>${tpl.off ? '' : esc(`${timeRange(tpl)} · ${fmtDuration(netMinutes(tpl))}`)}</small>
    </button></li>`).join('');
  openSheet(`${dayName(date)}, ${fmtDayMonth(date)}`, `
    <ul class="picker">${items}
      <li><button type="button" data-pick="" aria-pressed="${!current}"><i class="dot" style="--c:transparent;border:1.5px dashed var(--muted)"></i>${esc(t('pick.clear'))}</button></li>
    </ul>
    <div class="sheet__foot"><button class="link-btn" type="button" data-action="goto-templates">${esc(t('pick.edit'))}</button></div>`,
  (body) => {
    body.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.pick;
      commit((s) => { if (id) s.shifts[date] = id; else delete s.shifts[date]; });
      closeSheet();
    }));
    (body.querySelector('[aria-pressed="true"]') || body.querySelector('button')).focus();
  });
}

function copyPreviousWeek() {
  const dates = weekDates(view.week);
  commit((s) => {
    dates.forEach((d) => {
      const prev = s.shifts[addDays(d, -7)];
      if (prev) s.shifts[d] = prev; else delete s.shifts[d];
    });
  });
  toast(t('week.copied'));
}

/* ==========================================================================
   AYARLAR
   ========================================================================== */

const PALETTE = ['#e8a317', '#7c5cff', '#2f7fe0', '#16a37f', '#e5484d', '#d6409f', '#0ea5b7', '#8a9099'];
const chevron = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 6l6 6-6 6"/></svg>';

function renderSettings() {
  const s = state.settings;
  $('#settings-root').innerHTML = `
    <h3 class="section-title">${esc(t('set.templates'))}</h3>
    <ul class="list">${state.templates.map((tpl) => `
      <li><button class="list__item" type="button" data-action="edit-template" data-id="${esc(tpl.id)}" aria-label="${esc(t('tpl.editAria', { name: tpl.name }))}">
        <i class="dot" style="--c:${tpl.color}"></i>
        <span class="list__main"><b>${esc(tpl.name)}</b>
          <small>${tpl.off ? esc(t('tpl.off')) : esc(`${timeRange(tpl)} · ${t('tpl.breakShort', { v: tpl.breakMin })} · net ${fmtDuration(netMinutes(tpl))}`)}</small></span>
        ${chevron}
      </button></li>`).join('')}
    </ul>
    <button class="btn btn--block" type="button" data-action="new-template">+ ${esc(t('set.addTemplate'))}</button>

    <h3 class="section-title">${esc(t('set.work'))}</h3>
    <form class="card stack" id="work-form" novalidate>
      <div class="field">
        <label for="f-target">${esc(t('set.weeklyTarget'))}</label>
        <input class="input" id="f-target" name="weeklyTarget" type="number" inputmode="decimal" min="0" max="168" step="0.5" value="${s.weeklyTarget}">
        <small>${esc(t('set.weeklyTargetHint'))}</small>
      </div>
      <div class="grid-2">
        <div class="field">
          <label for="f-rate">${esc(t('set.hourlyRate'))}</label>
          <input class="input" id="f-rate" name="hourlyRate" type="number" inputmode="decimal" min="0" step="1" value="${s.hourlyRate ?? ''}" placeholder="—">
        </div>
        <div class="field">
          <label for="f-mult">${esc(t('set.overtimeMultiplier'))}</label>
          <input class="input" id="f-mult" name="overtimeMultiplier" type="number" inputmode="decimal" min="1" max="5" step="0.25" value="${s.overtimeMultiplier}">
        </div>
      </div>
      <div class="grid-2">
        <div class="field">
          <label for="f-ns">${esc(t('set.nightStart'))}</label>
          <input class="input" id="f-ns" name="nightStart" type="time" value="${s.night.start}">
        </div>
        <div class="field">
          <label for="f-ne">${esc(t('set.nightEnd'))}</label>
          <input class="input" id="f-ne" name="nightEnd" type="time" value="${s.night.end}">
        </div>
      </div>
    </form>

    <h3 class="section-title">${esc(t('set.data'))}</h3>
    <div class="stack">
      <button class="btn btn--block" type="button" data-action="export-json">${esc(t('set.export'))}</button>
      <label class="btn btn--block" for="import-file">${esc(t('set.import'))}</label>
      <input class="sr-only" id="import-file" type="file" accept="application/json,.json">
      <button class="btn btn--block btn--ghost" type="button" data-action="load-demo">${esc(t('set.loadDemo'))}</button>
      <button class="btn btn--block btn--ghost btn--danger" type="button" data-action="reset">${esc(t('set.reset'))}</button>
    </div>
    <p class="about">${esc(t('set.about'))}</p>`;

  // Mesai ayarları: her değişiklikte kaydet
  $('#work-form').addEventListener('change', (e) => {
    const f = e.currentTarget.elements;
    commit((st) => {
      const n = (v, fb) => (v === '' || !Number.isFinite(+v) ? fb : +v);
      st.settings.weeklyTarget = Math.min(168, Math.max(0, n(f.weeklyTarget.value, 45)));
      st.settings.hourlyRate = f.hourlyRate.value === '' ? null : Math.max(0, n(f.hourlyRate.value, 0));
      st.settings.overtimeMultiplier = Math.min(5, Math.max(1, n(f.overtimeMultiplier.value, 1.5)));
      if (f.nightStart.value) st.settings.night.start = f.nightStart.value;
      if (f.nightEnd.value) st.settings.night.end = f.nightEnd.value;
    }, { render: false });
    renderWeek();
    toast(t('toast.saved'));
  });

  $('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const next = store.importJSON(await file.text());
      if (!(await ask(t('confirm.import')))) return;
      state = next;
      store.save(state);
      setLang(state.settings.lang);
      render();
      toast(t('toast.imported'));
    } catch (err) {
      toast(t('toast.importError'));
    }
  });
}

function templateForm(tpl) {
  const isNew = !tpl;
  const x = tpl || { id: '', name: '', start: '09:00', end: '17:00', breakMin: 60, color: PALETTE[3], off: false };
  openSheet(t(isNew ? 'tpl.new' : 'tpl.edit'), `
    <form class="stack" id="tpl-form" novalidate>
      <div class="field">
        <label for="t-name">${esc(t('tpl.name'))}</label>
        <input class="input" id="t-name" name="name" required maxlength="40" value="${esc(x.name)}" autocomplete="off">
      </div>
      <label class="check"><input type="checkbox" name="off" ${x.off ? 'checked' : ''}> ${esc(t('tpl.off'))}</label>
      <div class="grid-2" data-times>
        <div class="field"><label for="t-start">${esc(t('tpl.start'))}</label><input class="input" id="t-start" name="start" type="time" value="${x.start}"></div>
        <div class="field"><label for="t-end">${esc(t('tpl.end'))}</label><input class="input" id="t-end" name="end" type="time" value="${x.end}"></div>
      </div>
      <div class="field" data-times>
        <label for="t-break">${esc(t('tpl.break'))}</label>
        <input class="input" id="t-break" name="breakMin" type="number" inputmode="numeric" min="0" max="600" step="5" value="${x.breakMin}">
        <small id="t-summary" aria-live="polite"></small>
      </div>
      <fieldset class="field" style="border:0;padding:0;margin:0">
        <legend class="label">${esc(t('tpl.color'))}</legend>
        <div class="swatches">${PALETTE.map((c) => `
          <label class="swatch"><input type="radio" name="color" value="${c}" ${c === x.color ? 'checked' : ''} aria-label="${c}"><span style="--c:${c}"></span></label>`).join('')}
        </div>
      </fieldset>
      <div class="form-actions">
        ${isNew ? '' : `<button class="btn btn--ghost btn--danger" type="button" data-del>${esc(t('tpl.delete'))}</button>`}
        <button class="btn btn--primary" type="submit">${esc(t('tpl.save'))}</button>
      </div>
    </form>`, (body) => {
    const form = body.querySelector('form');
    const f = form.elements;
    const sync = () => {
      const off = f.off.checked;
      body.querySelectorAll('[data-times]').forEach((el) => { el.hidden = off; });
      if (!off && f.start.value && f.end.value) {
        const probe = { start: f.start.value, end: f.end.value, breakMin: +f.breakMin.value || 0 };
        const overnight = toMin(probe.end) <= toMin(probe.start);
        $('#t-summary').textContent = `net ${fmtDuration(netMinutes(probe))}${overnight ? ` · ${t('tpl.overnight')}` : ''}`;
      }
    };
    form.addEventListener('input', sync);
    sync();
    f.name.focus();

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = f.name.value.trim();
      if (!name) { f.name.focus(); return; }
      const data = {
        name: name.slice(0, 40),
        off: f.off.checked,
        start: f.start.value || '09:00',
        end: f.end.value || '17:00',
        breakMin: Math.max(0, Math.min(600, +f.breakMin.value || 0)),
        color: f.color.value || PALETTE[3]
      };
      commit((s) => {
        if (isNew) s.templates.push({ id: store.uid(), ...data });
        else Object.assign(s.templates.find((y) => y.id === x.id), data);
      });
      closeSheet();
      toast(t('toast.saved'));
    });

    body.querySelector('[data-del]')?.addEventListener('click', async () => {
      const used = Object.values(state.shifts).filter((id) => id === x.id).length;
      if (used && !(await ask(t('tpl.deleteAsk', { name: x.name, n: used }), t('tpl.delete')))) return;
      commit((s) => {
        s.templates = s.templates.filter((y) => y.id !== x.id);
        for (const [d, id] of Object.entries(s.shifts)) if (id === x.id) delete s.shifts[d];
      });
      closeSheet();
    });
  });
}

/* ==========================================================================
   BOŞ ZAMAN
   ========================================================================== */

const intervalFor = (date) => shiftInterval(date, tplFor(date));
const goalById = () => new Map(state.goals.map((g) => [g.id, g]));
const pct = (min) => `${(min / DAY) * 100}%`;

/** Bir günün çizime hazır parçaları (gün içi dakika) */
function dayParts(date) {
  const layout = dayLayout(date, intervalFor, state.settings);
  const base = layout.window.start;
  const shiftTpl = (start) => {
    // Bu dakika hangi günün vardiyasına ait?
    for (const k of [0, -1, 1]) {
      const d = addDays(date, k);
      const iv = intervalFor(d);
      if (iv && start >= iv.start && start < iv.end) return tplFor(d);
    }
    return null;
  };
  const blocks = layout.blocks.map((b) => {
    const tpl = b.type === 'shift' ? shiftTpl(b.start) : null;
    return {
      type: b.type, start: b.start - base, end: b.end - base,
      color: tpl?.color || null,
      label: tpl ? `${tpl.name} ${tpl.start}–${tpl.end}` : null
    };
  });
  const free = layout.free.map((f) => ({ start: f.start - base, end: f.end - base }));
  return { layout, blocks, free, sessions: state.sessions[date] || [] };
}

function weekNavHTML() {
  const dates = weekDates(view.week);
  return `
    <div class="weeknav weeknav--compact">
      <button class="icon-btn icon-btn--lg" type="button" data-action="week-prev" aria-label="${esc(t('week.prev'))}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 6l-6 6 6 6"/></svg></button>
      <div class="weeknav__title"><h3>${esc(fmtWeekRange(dates[0], dates[6]))}</h3></div>
      <button class="icon-btn icon-btn--lg" type="button" data-action="week-next" aria-label="${esc(t('week.next'))}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 6l6 6-6 6"/></svg></button>
    </div>`;
}

function renderFree({ animate = false } = {}) {
  const s = state.settings;
  const dates = weekDates(view.week);
  if (!dates.includes(view.freeDay)) view.freeDay = dates.includes(today) ? today : dates[0];
  const goals = goalById();
  const parts = Object.fromEntries(dates.map((d) => [d, dayParts(d)]));
  const weekFree = dates.reduce((sum, d) => sum + freeMinutes(parts[d].layout), 0);

  const legend = `
    <ul class="legend" aria-hidden="true">
      <li><i class="k-shift"></i>${esc(t('free.legend.shift'))}</li>
      <li><i class="k-buffer"></i>${esc(t('free.legend.buffer'))}</li>
      <li><i class="k-sleep"></i>${esc(t('free.legend.sleep'))}</li>
      <li><i class="k-free"></i>${esc(t('free.legend.free'))}</li>
      <li><i class="k-session"></i>${esc(t('free.legend.session'))}</li>
    </ul>`;

  const segs = (p) => [
    ...p.free.map((f) => `<i class="seg seg--free" style="left:${pct(f.start)};width:${pct(f.end - f.start)}"></i>`),
    ...p.blocks.map((b) => `<i class="seg seg--${b.type}" style="left:${pct(b.start)};width:${pct(b.end - b.start)}${b.color ? `;--c:${b.color}` : ''}"></i>`),
    ...p.sessions.map((x) => `<i class="seg seg--session" style="left:${pct(x.start)};width:${pct(x.duration)};--c:${goals.get(x.goalId)?.color || '#16a37f'}"></i>`)
  ].join('');

  const overview = dates.map((d) => {
    const p = parts[d];
    const freeTxt = t('free.dayFree', { v: fmtHours(freeMinutes(p.layout)) });
    return `
      <li><button type="button" class="fday ${d === view.freeDay ? 'is-active' : ''} ${d === today ? 'is-today' : ''}" data-action="free-day" data-date="${d}"
        aria-pressed="${d === view.freeDay}" aria-label="${esc(`${dayName(d)} ${fmtDayMonth(d)}: ${freeTxt}`)}">
        <span class="fday__label"><b>${esc(dayName(d, 'short'))}</b> ${esc(fmtDayMonth(d))}</span>
        <span class="fday__free">${esc(freeTxt)}</span>
        <span class="fbar" aria-hidden="true">${segs(p)}</span>
      </button></li>`;
  }).join('');

  const goalsList = state.goals.map((g) => `
    <li><button class="list__item" type="button" data-action="edit-goal" data-id="${esc(g.id)}">
      <i class="dot" style="--c:${g.color}"></i>
      <span class="list__main"><b>${esc(g.name)}</b>
        <small>${esc(t('free.goalLine', { h: fmtHours(g.weeklyHours * 60), min: g.minSession, max: g.maxSession }))}</small></span>
      ${chevron}
    </button></li>`).join('');

  const hasPlan = dates.some((d) => (state.sessions[d] || []).length);
  const result = view.planResult;
  const resultHTML = result ? `
    <div class="plan-result ${result.unplaced.length ? 'plan-result--warn' : 'plan-result--ok'}" role="status">
      <p>${esc(t('free.planned', { n: result.count }))}</p>
      ${result.unplaced.length
        ? result.unplaced.map((u) => `<p><strong>${esc(t('free.unplaced', { v: fmtDuration(u.minutes), goal: goals.get(u.goalId)?.name || '' }))}</strong></p>`).join('')
        : `<p>${esc(t('free.allFit'))}</p>`}
    </div>` : '';

  $('#free-root').innerHTML = `
    ${weekNavHTML()}

    <form class="card stack" id="free-form" novalidate>
      <div class="grid-2">
        <div class="field"><label for="f-ss">${esc(t('free.sleepStart'))}</label><input class="input" id="f-ss" name="sleepStart" type="time" value="${s.sleep.start}"></div>
        <div class="field"><label for="f-se">${esc(t('free.sleepEnd'))}</label><input class="input" id="f-se" name="sleepEnd" type="time" value="${s.sleep.end}"></div>
      </div>
      <div class="field">
        <label for="f-buf">${esc(t('free.buffer'))}</label>
        <input class="input" id="f-buf" name="buffer" type="number" inputmode="numeric" min="0" max="240" step="5" value="${s.buffer}">
        <small>${esc(t('free.bufferHint'))}</small>
      </div>
    </form>

    <div class="card">
      <div class="card__row"><h3 class="card__title">${esc(t('free.weekFree'))}</h3><span class="card__big">${esc(fmtHours(weekFree))}</span></div>
      ${legend}
      <ol class="fdays">${overview}</ol>
    </div>

    <div class="card">
      <h3 class="card__title">${esc(t('free.goals'))}</h3>
      ${state.goals.length ? `<ul class="list">${goalsList}</ul>` : `<p class="hint">${esc(t('free.noGoals'))}</p>`}
      <button class="btn btn--block btn--ghost" type="button" data-action="new-goal">+ ${esc(t('free.addGoal'))}</button>
      <div class="plan-actions">
        <button class="btn btn--primary btn--block" type="button" data-action="plan" ${state.goals.length ? '' : 'disabled'}>✦ ${esc(t(hasPlan ? 'free.replan' : 'free.plan'))}</button>
        ${hasPlan ? `<button class="btn btn--ghost" type="button" data-action="clear-plan">${esc(t('free.clearPlan'))}</button>` : ''}
      </div>
      ${resultHTML}
    </div>

    <div class="card" id="day-detail"></div>`;

  renderDayDetail(parts[view.freeDay]);

  $('#free-form').addEventListener('change', (e) => {
    const f = e.currentTarget.elements;
    commit((st) => {
      if (f.sleepStart.value) st.settings.sleep.start = f.sleepStart.value;
      if (f.sleepEnd.value) st.settings.sleep.end = f.sleepEnd.value;
      st.settings.buffer = Math.max(0, Math.min(240, +f.buffer.value || 0));
    });
  });

  if (animate && gsapOk()) {
    window.gsap.from('.fbar .seg--session, .tl__session', { scaleX: 0, opacity: 0, transformOrigin: 'left center', duration: 0.45, stagger: 0.03, ease: 'power3.out', clearProps: 'transform,opacity' });
  }
}

/** Seçili günün dikey zaman çizelgesi */
function renderDayDetail(p) {
  const date = view.freeDay;
  const goals = goalById();
  const hours = Array.from({ length: 25 }, (_, h) => `<span class="tl__hour" style="top:calc(${h} * var(--hour))">${String(h % 24).padStart(2, '0')}:00</span>`).join('');
  const top = (m) => `calc(${m / 60} * var(--hour))`;
  const blocks = [
    ...p.free.map((f) => `<i class="tl__block tl__block--free" style="top:${top(f.start)};height:${top(f.end - f.start)}"></i>`),
    ...p.blocks.map((b) => `<i class="tl__block tl__block--${b.type}" style="top:${top(b.start)};height:${top(b.end - b.start)}${b.color ? `;--c:${b.color}` : ''}">${b.end - b.start >= 45 ? `<span>${esc(b.label || `${t(`free.legend.${b.type}`)} ${toHHMM(b.start)}–${toHHMM(b.end)}`)}</span>` : ''}</i>`)
  ].join('');
  const sessions = p.sessions.map((x, i) => {
    const g = goals.get(x.goalId);
    const range = `${toHHMM(x.start)}–${toHHMM(x.start + x.duration)}`;
    return `<button type="button" class="tl__session" data-index="${i}" data-id="${esc(x.id)}" style="top:${top(x.start)};height:${top(x.duration)};--c:${g?.color || '#16a37f'}"
      aria-label="${esc(t('free.sessionAria', { goal: g?.name || '', start: toHHMM(x.start), end: toHHMM(x.start + x.duration) }))}">
      <b>${esc(g?.name || '')}</b><span>${range}</span></button>`;
  }).join('');

  const list = p.sessions.map((x, i) => {
    const g = goals.get(x.goalId);
    return `<li class="srow">
      <i class="dot" style="--c:${g?.color || '#16a37f'}"></i>
      <span class="srow__main"><b>${esc(g?.name || '')}</b><small>${toHHMM(x.start)}–${toHHMM(x.start + x.duration)} · ${esc(fmtDuration(x.duration))}</small></span>
      <button class="icon-btn" type="button" data-action="session-move" data-index="${i}" data-delta="-15" aria-label="${esc(t('free.moveEarlier'))}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 15l6-6 6 6"/></svg></button>
      <button class="icon-btn" type="button" data-action="session-move" data-index="${i}" data-delta="15" aria-label="${esc(t('free.moveLater'))}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6"/></svg></button>
      <button class="icon-btn" type="button" data-action="session-remove" data-index="${i}" aria-label="${esc(t('free.remove'))}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    </li>`;
  }).join('');

  $('#day-detail').innerHTML = `
    <div class="card__row">
      <h3 class="card__title">${esc(`${dayName(date)}, ${fmtDayMonth(date)}`)}</h3>
      <span class="card__muted">${esc(t('free.dayFree', { v: fmtHours(freeMinutes(p.layout)) }))}</span>
    </div>
    ${p.sessions.length ? `<p class="hint">${esc(t('free.dragHint'))}</p>` : ''}
    <div class="tl" id="timeline">${hours}<div class="tl__track">${blocks}${sessions}</div></div>
    ${p.sessions.length ? `<ul class="srows">${list}</ul>` : ''}`;

  bindTimeline(date, p);
}

/** Oturumu taşı (gün içi dakika); sığmıyorsa false */
function moveSession(date, index, newStart) {
  const list = state.sessions[date] || [];
  const x = list[index];
  if (!x) return false;
  const candidate = { ...x, start: Math.round(newStart / 5) * 5 };
  const layout = dayLayout(date, intervalFor, state.settings);
  if (!fits(layout, list, candidate, index)) return false;
  commit((s) => { s.sessions[date][index].start = candidate.start; s.sessions[date].sort((a, b) => a.start - b.start); }, { render: false });
  renderFree();
  return true;
}

function removeSession(date, index) {
  commit((s) => {
    s.sessions[date].splice(index, 1);
    if (!s.sessions[date].length) delete s.sessions[date];
  }, { render: false });
  renderFree();
}

/** Sürükleme (pointer) ve klavye (↑ ↓ Delete) */
function bindTimeline(date) {
  const track = $('#timeline .tl__track');
  if (!track) return;
  const hourPx = () => parseFloat(getComputedStyle($('#timeline')).getPropertyValue('--hour')) || 32;

  track.querySelectorAll('.tl__session').forEach((el) => {
    const index = +el.dataset.index;
    const x = state.sessions[date][index];
    let startY = 0;
    let delta = 0;
    let dragging = false;

    el.addEventListener('pointerdown', (e) => {
      dragging = true;
      startY = e.clientY;
      delta = 0;
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* sentetik olaylar */ }
      el.classList.add('is-dragging');
    });
    el.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      // 15 dakikalık adımlara yapış
      delta = Math.round(((e.clientY - startY) / hourPx()) * 4) * 15;
      el.style.transform = `translateY(${(delta / 60) * hourPx()}px)`;
    });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove('is-dragging');
      if (!delta) { el.style.transform = ''; return; }
      if (!moveSession(date, index, x.start + delta)) {
        el.style.transform = '';
        toast(t('free.blocked'));
      }
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);

    el.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (!moveSession(date, index, x.start + (e.key === 'ArrowUp' ? -15 : 15))) toast(t('free.blocked'));
        $(`#timeline .tl__session[data-id="${x.id}"]`)?.focus();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeSession(date, index);
      }
    });
  });
}

function runPlan() {
  const dates = weekDates(view.week);
  const result = plan({ dates, intervalFor, settings: state.settings, goals: state.goals });
  commit((s) => {
    dates.forEach((d) => {
      const list = result.sessions[d].map((x) => ({ id: store.uid(), ...x }));
      if (list.length) s.sessions[d] = list; else delete s.sessions[d];
    });
  }, { render: false });
  view.planResult = {
    count: Object.values(result.sessions).reduce((n, l) => n + l.length, 0),
    unplaced: result.unplaced
  };
  renderFree({ animate: true });
}

function clearPlan() {
  const dates = weekDates(view.week);
  commit((s) => { dates.forEach((d) => delete s.sessions[d]); }, { render: false });
  view.planResult = null;
  renderFree();
}

function goalForm(goal) {
  const isNew = !goal;
  const x = goal || { id: '', name: '', weeklyHours: 5, minSession: 45, maxSession: 90, color: '#16a37f' };
  openSheet(t(isNew ? 'goal.new' : 'goal.edit'), `
    <form class="stack" id="goal-form" novalidate>
      <div class="field"><label for="g-name">${esc(t('goal.name'))}</label>
        <input class="input" id="g-name" name="name" required maxlength="40" value="${esc(x.name)}" autocomplete="off"></div>
      <div class="field"><label for="g-hours">${esc(t('goal.hours'))}</label>
        <input class="input" id="g-hours" name="weeklyHours" type="number" inputmode="decimal" min="0.5" max="100" step="0.5" value="${x.weeklyHours}"></div>
      <div class="grid-2">
        <div class="field"><label for="g-min">${esc(t('goal.min'))}</label>
          <input class="input" id="g-min" name="minSession" type="number" inputmode="numeric" min="15" max="600" step="5" value="${x.minSession}"></div>
        <div class="field"><label for="g-max">${esc(t('goal.max'))}</label>
          <input class="input" id="g-max" name="maxSession" type="number" inputmode="numeric" min="15" max="600" step="5" value="${x.maxSession}"></div>
      </div>
      <fieldset class="field" style="border:0;padding:0;margin:0">
        <legend class="label">${esc(t('tpl.color'))}</legend>
        <div class="swatches">${PALETTE.map((c) => `
          <label class="swatch"><input type="radio" name="color" value="${c}" ${c === x.color ? 'checked' : ''} aria-label="${c}"><span style="--c:${c}"></span></label>`).join('')}
        </div>
      </fieldset>
      <div class="form-actions">
        ${isNew ? '' : `<button class="btn btn--ghost btn--danger" type="button" data-del>${esc(t('tpl.delete'))}</button>`}
        <button class="btn btn--primary" type="submit">${esc(t('tpl.save'))}</button>
      </div>
    </form>`, (body) => {
    const form = body.querySelector('form');
    const f = form.elements;
    f.name.focus();
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = f.name.value.trim();
      if (!name) { f.name.focus(); return; }
      const minSession = Math.max(15, Math.min(600, +f.minSession.value || 45));
      const data = {
        name: name.slice(0, 40),
        weeklyHours: Math.max(0, Math.min(100, +f.weeklyHours.value || 0)),
        minSession,
        maxSession: Math.max(minSession, Math.min(600, +f.maxSession.value || minSession)),
        color: f.color.value || '#16a37f'
      };
      commit((s) => {
        if (isNew) s.goals.push({ id: store.uid(), ...data });
        else Object.assign(s.goals.find((g) => g.id === x.id), data);
      });
      closeSheet();
      toast(t('toast.saved'));
    });
    body.querySelector('[data-del]')?.addEventListener('click', () => {
      commit((s) => {
        s.goals = s.goals.filter((g) => g.id !== x.id);
        for (const [d, list] of Object.entries(s.sessions)) {
          s.sessions[d] = list.filter((y) => y.goalId !== x.id);
          if (!s.sessions[d].length) delete s.sessions[d];
        }
      });
      closeSheet();
    });
  });
}

/* ==========================================================================
   GENEL
   ========================================================================== */

function renderChrome() {
  applyStatic();
  $('#lang-btn .lang-code').textContent = getLang() === 'tr' ? 'EN' : 'TR';
  const dark = document.documentElement.dataset.theme === 'dark'
    || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  $('#theme-btn').setAttribute('aria-label', t(dark ? 'theme.toLight' : 'theme.toDark'));
  $('#demo-bar').hidden = !state.demo;
  $('#storage-warning').hidden = storageOk;
  $$('.tab').forEach((b) => (b.dataset.tab === view.tab ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
  $$('.view').forEach((v) => { v.hidden = v.id !== `view-${view.tab}`; });
}

function render() {
  renderChrome();
  if (view.tab === 'week') renderWeek();
  if (view.tab === 'free') renderFree();
  if (view.tab === 'settings') renderSettings();
}

function applyTheme() {
  const th = state.settings.theme;
  if (th === 'light' || th === 'dark') document.documentElement.dataset.theme = th;
  else delete document.documentElement.dataset.theme;
}

/** Dil değişince varsayılan (kullanıcının değiştirmediği) şablon ve hedef adlarını da çevir */
function translateDefaults(from, to) {
  const swap = (list, a, b) => list.forEach((item) => {
    const i = a.findIndex((x) => x.id === item.id);
    if (i > -1 && item.name === a[i].name) item.name = b[i].name;
  });
  swap(state.templates, store.defaultTemplates(from), store.defaultTemplates(to));
  swap(state.goals, store.demoState(from).goals, store.demoState(to).goals);
}

/** Demo haftası için hedefleri bir kez yerleştir */
function seedDemoPlan() {
  const dates = weekDates(today);
  const result = plan({ dates, intervalFor, settings: state.settings, goals: state.goals });
  dates.forEach((d) => {
    const list = result.sessions[d].map((x) => ({ id: store.uid(), ...x }));
    if (list.length) state.sessions[d] = list;
  });
  store.save(state);
}

function switchTab(tab) {
  view.tab = tab;
  render();
  window.scrollTo({ top: 0 });
}

/* ---------- Olaylar (tek dinleyici) ---------- */

document.addEventListener('click', async (e) => {
  const tabBtn = e.target.closest('[data-tab]');
  if (tabBtn) { switchTab(tabBtn.dataset.tab); return; }

  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;

  switch (action) {
    case 'week-prev': view.week = addDays(view.week, -7); view.planResult = null; view.tab === 'free' ? renderFree() : renderWeek(-1); break;
    case 'week-next': view.week = addDays(view.week, 7); view.planResult = null; view.tab === 'free' ? renderFree() : renderWeek(1); break;
    case 'week-today': {
      const dir = today < view.week ? -1 : 1;
      view.week = startOfWeek(today);
      renderWeek(dir);
      break;
    }
    case 'pick': openPicker(el.dataset.date); break;
    case 'copy-prev': copyPreviousWeek(); break;
    case 'sheet-close': closeSheet(); break;
    case 'goto-templates': closeSheet(); switchTab('settings'); break;
    case 'goto-rate': switchTab('settings'); setTimeout(() => $('#f-rate')?.focus(), 50); break;
    case 'new-template': templateForm(null); break;
    case 'free-day': view.freeDay = el.dataset.date; renderFree(); $(`[data-action="free-day"][data-date="${view.freeDay}"]`)?.focus(); break;
    case 'new-goal': goalForm(null); break;
    case 'edit-goal': goalForm(state.goals.find((g) => g.id === el.dataset.id)); break;
    case 'plan': runPlan(); break;
    case 'clear-plan': clearPlan(); break;
    case 'session-move': {
      const list = state.sessions[view.freeDay] || [];
      const x = list[+el.dataset.index];
      if (x && !moveSession(view.freeDay, +el.dataset.index, x.start + +el.dataset.delta)) toast(t('free.blocked'));
      break;
    }
    case 'session-remove': removeSession(view.freeDay, +el.dataset.index); break;
    case 'edit-template': templateForm(state.templates.find((x) => x.id === el.dataset.id)); break;

    case 'export-json':
      download(`nobetci-yedek-${today}.json`, store.exportJSON(state), 'application/json');
      toast(t('toast.downloaded'));
      break;
    case 'load-demo':
      if (!(await ask(t('confirm.demo')))) return;
      state = store.demoState(getLang(), today);
      seedDemoPlan();
      view.week = startOfWeek(today);
      view.planResult = null;
      render();
      toast(t('toast.demo'));
      break;
    case 'reset':
      if (!(await ask(t('confirm.reset')))) return;
      state = store.emptyState(getLang());
      store.save(state);
      view.week = startOfWeek(today);
      view.planResult = null;
      render();
      toast(t('toast.reset'));
      break;

    case 'export-ics':
    case 'export-png':
      // 4. aşamada bağlanacak
      break;
    default: break;
  }
});

$('#lang-btn').addEventListener('click', () => {
  const from = getLang();
  const to = from === 'tr' ? 'en' : 'tr';
  setLang(to);
  commit((s) => { translateDefaults(from, to); s.settings.lang = to; });
});

$('#theme-btn').addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme === 'dark'
    || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  commit((s) => { s.settings.theme = dark ? 'light' : 'dark'; }, { render: false });
  applyTheme();
  renderChrome();
});

/* ---------- Başlat ---------- */

setLang(state.settings.lang);
applyTheme();
if (firstRunPlan) seedDemoPlan();
render();
