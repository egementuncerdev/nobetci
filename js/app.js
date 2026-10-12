/* ==========================================================================
   app.js — arayüz: durum, görünümler, olaylar
   Hesaplar calc.js'te, planlama planner.js'te; burada yalnızca bağlama ve çizim var.
   ========================================================================== */

import {
  weekDates, addDays, todayISO, toMin, grossMinutes, netMinutes, weekSummary, monthSummary,
  shiftInterval, startOfWeek, DAY
} from './calc.js';
import * as store from './storage.js';
import {
  t, setLang, getLang, applyStatic, fmtDuration, fmtHours, fmtMoney, fmtDayMonth, fmtMonthYear, fmtWeekRange
} from './i18n.js';

/* ---------- Durum ---------- */

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const today = todayISO();

let state = store.load();
let storageOk = true;
if (!state) {
  const lang = (navigator.language || 'tr').toLowerCase().startsWith('tr') ? 'tr' : 'en';
  state = store.demoState(lang, today);
  storageOk = store.save(state);
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
   BOŞ ZAMAN (3. aşamada doldurulacak)
   ========================================================================== */

function renderFree() {
  $('#free-root').innerHTML = '';
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
    case 'week-prev': view.week = addDays(view.week, -7); renderWeek(-1); break;
    case 'week-next': view.week = addDays(view.week, 7); renderWeek(1); break;
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
    case 'edit-template': templateForm(state.templates.find((x) => x.id === el.dataset.id)); break;

    case 'export-json':
      download(`nobetci-yedek-${today}.json`, store.exportJSON(state), 'application/json');
      toast(t('toast.downloaded'));
      break;
    case 'load-demo':
      if (!(await ask(t('confirm.demo')))) return;
      state = store.demoState(getLang(), today);
      store.save(state);
      view.week = startOfWeek(today);
      render();
      toast(t('toast.demo'));
      break;
    case 'reset':
      if (!(await ask(t('confirm.reset')))) return;
      state = store.emptyState(getLang());
      store.save(state);
      view.week = startOfWeek(today);
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
render();
