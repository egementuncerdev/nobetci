/* ==========================================================================
   i18n.js — TR/EN metinler ve biçimlendirme (süre, para, tarih)
   ========================================================================== */

const STRINGS = {
  tr: {
    'app.tagline': 'Vardiya & Mesai Planlayıcı',
    'skip': 'İçeriğe geç',
    'lang.toggle': 'Switch to English',
    'theme.toLight': 'Açık temaya geç',
    'theme.toDark': 'Koyu temaya geç',

    'tab.week': 'Hafta',
    'tab.free': 'Boş zaman',
    'tab.settings': 'Ayarlar',

    'demo.text': 'Örnek bir haftayla açıldı. Kendi vardiyalarını girmek için sıfırla.',
    'demo.reset': 'Sıfırla',

    'week.prev': 'Önceki hafta',
    'week.next': 'Sonraki hafta',
    'week.today': 'Bugün',
    'week.copyPrev': 'Geçen haftayı kopyala',
    'week.copied': 'Geçen haftanın vardiyaları kopyalandı',
    'week.empty': 'Boş',
    'week.tapHint': 'Bir güne dokun, vardiyasını seç.',
    'week.dayAria': '{day}: {shift}. Değiştir',

    'sum.net': 'Net mesai',
    'sum.gross': 'brüt {v}',
    'sum.overtime': 'Fazla mesai',
    'sum.target': 'hedef {v}',
    'sum.night': 'Gece',
    'sum.nightHint': '{start}–{end} arası',
    'sum.pay': 'Tahmini kazanç',
    'sum.payHint': 'fazla mesai {v}',
    'sum.payAdd': 'Saatlik ücret ekle',
    'sum.month': '{month} toplamı',

    'act.ics': 'Takvime aktar',
    'act.png': 'Görsel olarak indir',

    'pick.title': '{day}',
    'pick.clear': 'Vardiya yok (boş bırak)',
    'pick.edit': 'Şablonları düzenle',

    'set.templates': 'Vardiya şablonları',
    'set.addTemplate': 'Şablon ekle',
    'set.work': 'Mesai ayarları',
    'set.weeklyTarget': 'Haftalık hedef (saat)',
    'set.weeklyTargetHint': 'Bunu aşan net saatler fazla mesai sayılır.',
    'set.hourlyRate': 'Saatlik ücret (₺, isteğe bağlı)',
    'set.overtimeMultiplier': 'Fazla mesai çarpanı',
    'set.nightStart': 'Gece başlangıcı',
    'set.nightEnd': 'Gece bitişi',
    'set.data': 'Veri',
    'set.export': 'Yedeği indir (JSON)',
    'set.import': 'Yedekten yükle',
    'set.loadDemo': 'Örnek haftayı yükle',
    'set.reset': 'Tüm verileri sil',
    'set.storageOff': 'Tarayıcı depolaması kapalı: veriler sayfa kapanınca kaybolur. Yedeği indirmeyi unutma.',
    'set.about': 'Nöbetçi verilerini yalnızca bu cihazda saklar; hiçbir sunucuya gönderilmez.',

    'tpl.new': 'Yeni şablon',
    'tpl.edit': 'Şablonu düzenle',
    'tpl.name': 'Ad',
    'tpl.start': 'Başlangıç',
    'tpl.end': 'Bitiş',
    'tpl.break': 'Mola (dk)',
    'tpl.breakShort': '{v} dk mola',
    'sheet.close': 'Kapat',
    'nav.main': 'Ana menü',
    'tpl.color': 'Renk',
    'tpl.off': 'İzin günü (mesai sayılmaz)',
    'tpl.overnight': 'Ertesi gün biter',
    'tpl.save': 'Kaydet',
    'tpl.delete': 'Sil',
    'tpl.cancel': 'Vazgeç',
    'tpl.deleteAsk': '“{name}” şablonu {n} günde kullanılıyor. Silinirse o günler boş kalır.',
    'tpl.editAria': '{name} şablonunu düzenle',

    'free.title': 'Boş zaman bulucu',
    'free.intro': 'Uyku ve yol süreni gir; vardiyalar dışında gerçekten kullanabileceğin zamanı gör ve hedeflerini yerleştir.',
    'free.sleep': 'Uyku',
    'free.sleepStart': 'Yatış',
    'free.sleepEnd': 'Kalkış',
    'free.buffer': 'Hazırlık + yol (dk)',
    'free.bufferHint': 'Vardiyadan önce ve sonra',
    'free.weekFree': 'Bu hafta boş zaman',
    'free.goals': 'Hedefler',
    'free.addGoal': 'Hedef ekle',
    'free.goalLine': 'haftada {h} · oturum {min}–{max} dk',
    'free.plan': 'Planla',
    'free.replan': 'Yeniden planla',
    'free.planned': '{n} oturum yerleştirildi.',
    'free.unplaced': 'Bu hafta {v} sığmadı: {goal}',
    'free.allFit': 'Bütün hedefler sığdı ✓',
    'free.noGoals': 'Önce bir hedef ekle (ör. “KPSS çalışması — haftada 12 saat”).',
    'free.clearPlan': 'Planı temizle',
    'free.legend.shift': 'Vardiya',
    'free.legend.buffer': 'Yol',
    'free.legend.sleep': 'Uyku',
    'free.legend.free': 'Boş',
    'free.legend.session': 'Oturum',
    'free.dayFree': '{v} boş',
    'free.sessionAria': '{goal}, {start}–{end}. Taşımak için sürükle ya da ok tuşlarını kullan; silmek için Delete.',
    'free.moveEarlier': '15 dk erkene al',
    'free.moveLater': '15 dk geçe al',
    'free.remove': 'Oturumu sil',
    'free.blocked': 'Bu saat dolu; oturum eski yerine döndü.',
    'free.dragHint': 'Oturumları sürükleyerek taşıyabilirsin.',

    'goal.new': 'Yeni hedef',
    'goal.edit': 'Hedefi düzenle',
    'goal.name': 'Ad',
    'goal.hours': 'Haftalık saat',
    'goal.min': 'En kısa oturum (dk)',
    'goal.max': 'En uzun oturum (dk)',

    'share.title': 'Haftalık program',
    'share.footer': 'nobetci.egementuncer.dev ile hazırlandı',
    'ics.goal': 'Plan',

    'confirm.ok': 'Evet',
    'confirm.cancel': 'Vazgeç',
    'confirm.reset': 'Bütün vardiyalar, şablonlar ve hedefler silinecek. Emin misin?',
    'confirm.demo': 'Mevcut verilerin yerine örnek hafta yüklenecek. Emin misin?',
    'confirm.import': 'Yedekteki veriler mevcut verilerin yerini alacak. Devam edilsin mi?',
    'toast.saved': 'Kaydedildi',
    'toast.imported': 'Yedek yüklendi',
    'toast.importError': 'Bu dosya Nöbetçi yedeği değil ya da bozuk.',
    'toast.reset': 'Veriler silindi',
    'toast.demo': 'Örnek hafta yüklendi',
    'toast.downloaded': 'İndirildi',

    'unit.h': 'sa',
    'unit.m': 'dk',
    'day.short': ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'],
    'day.long': ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']
  },

  en: {
    'app.tagline': 'Shift & Hours Planner',
    'skip': 'Skip to content',
    'lang.toggle': 'Türkçeye geç',
    'theme.toLight': 'Switch to light theme',
    'theme.toDark': 'Switch to dark theme',

    'tab.week': 'Week',
    'tab.free': 'Free time',
    'tab.settings': 'Settings',

    'demo.text': 'Opened with a sample week. Reset to enter your own shifts.',
    'demo.reset': 'Reset',

    'week.prev': 'Previous week',
    'week.next': 'Next week',
    'week.today': 'Today',
    'week.copyPrev': 'Copy last week',
    'week.copied': 'Copied last week’s shifts',
    'week.empty': 'Empty',
    'week.tapHint': 'Tap a day to choose its shift.',
    'week.dayAria': '{day}: {shift}. Change',

    'sum.net': 'Net hours',
    'sum.gross': 'gross {v}',
    'sum.overtime': 'Overtime',
    'sum.target': 'target {v}',
    'sum.night': 'Night',
    'sum.nightHint': '{start}–{end}',
    'sum.pay': 'Estimated pay',
    'sum.payHint': 'overtime {v}',
    'sum.payAdd': 'Add hourly rate',
    'sum.month': '{month} total',

    'act.ics': 'Add to calendar',
    'act.png': 'Download as image',

    'pick.title': '{day}',
    'pick.clear': 'No shift (leave empty)',
    'pick.edit': 'Edit templates',

    'set.templates': 'Shift templates',
    'set.addTemplate': 'Add template',
    'set.work': 'Work settings',
    'set.weeklyTarget': 'Weekly target (hours)',
    'set.weeklyTargetHint': 'Net hours above this count as overtime.',
    'set.hourlyRate': 'Hourly rate (₺, optional)',
    'set.overtimeMultiplier': 'Overtime multiplier',
    'set.nightStart': 'Night starts',
    'set.nightEnd': 'Night ends',
    'set.data': 'Data',
    'set.export': 'Download backup (JSON)',
    'set.import': 'Restore from backup',
    'set.loadDemo': 'Load sample week',
    'set.reset': 'Delete all data',
    'set.storageOff': 'Browser storage is off: data is lost when the page closes. Remember to download a backup.',
    'set.about': 'Nöbetçi keeps your data on this device only; nothing is sent to a server.',

    'tpl.new': 'New template',
    'tpl.edit': 'Edit template',
    'tpl.name': 'Name',
    'tpl.start': 'Start',
    'tpl.end': 'End',
    'tpl.break': 'Break (min)',
    'tpl.breakShort': '{v} min break',
    'sheet.close': 'Close',
    'nav.main': 'Main menu',
    'tpl.color': 'Colour',
    'tpl.off': 'Day off (not counted)',
    'tpl.overnight': 'Ends next day',
    'tpl.save': 'Save',
    'tpl.delete': 'Delete',
    'tpl.cancel': 'Cancel',
    'tpl.deleteAsk': '“{name}” is used on {n} days. Those days will be left empty.',
    'tpl.editAria': 'Edit template {name}',

    'free.title': 'Free time finder',
    'free.intro': 'Enter your sleep and commute; see the time you can really use around your shifts and fit your goals into it.',
    'free.sleep': 'Sleep',
    'free.sleepStart': 'Bedtime',
    'free.sleepEnd': 'Wake up',
    'free.buffer': 'Prep + commute (min)',
    'free.bufferHint': 'Before and after a shift',
    'free.weekFree': 'Free time this week',
    'free.goals': 'Goals',
    'free.addGoal': 'Add goal',
    'free.goalLine': '{h} a week · sessions {min}–{max} min',
    'free.plan': 'Plan',
    'free.replan': 'Plan again',
    'free.planned': '{n} sessions placed.',
    'free.unplaced': '{v} didn’t fit this week: {goal}',
    'free.allFit': 'All goals fit ✓',
    'free.noGoals': 'Add a goal first (e.g. “Exam prep — 12 hours a week”).',
    'free.clearPlan': 'Clear plan',
    'free.legend.shift': 'Shift',
    'free.legend.buffer': 'Commute',
    'free.legend.sleep': 'Sleep',
    'free.legend.free': 'Free',
    'free.legend.session': 'Session',
    'free.dayFree': '{v} free',
    'free.sessionAria': '{goal}, {start}–{end}. Drag or use arrow keys to move; Delete to remove.',
    'free.moveEarlier': 'Move 15 min earlier',
    'free.moveLater': 'Move 15 min later',
    'free.remove': 'Remove session',
    'free.blocked': 'That time is taken; the session went back.',
    'free.dragHint': 'Drag sessions to move them.',

    'goal.new': 'New goal',
    'goal.edit': 'Edit goal',
    'goal.name': 'Name',
    'goal.hours': 'Hours per week',
    'goal.min': 'Shortest session (min)',
    'goal.max': 'Longest session (min)',

    'share.title': 'Weekly schedule',
    'share.footer': 'Made with nobetci.egementuncer.dev',
    'ics.goal': 'Plan',

    'confirm.ok': 'Yes',
    'confirm.cancel': 'Cancel',
    'confirm.reset': 'All shifts, templates and goals will be deleted. Are you sure?',
    'confirm.demo': 'Your data will be replaced with the sample week. Are you sure?',
    'confirm.import': 'The backup will replace your current data. Continue?',
    'toast.saved': 'Saved',
    'toast.imported': 'Backup restored',
    'toast.importError': 'This file isn’t a Nöbetçi backup or it is damaged.',
    'toast.reset': 'Data deleted',
    'toast.demo': 'Sample week loaded',
    'toast.downloaded': 'Downloaded',

    'unit.h': 'h',
    'unit.m': 'm',
    'day.short': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    'day.long': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  }
};

let lang = 'tr';

export function setLang(next) {
  lang = STRINGS[next] ? next : 'tr';
  document.documentElement.lang = lang;
}
export const getLang = () => lang;

/** t('sum.gross', { v: '8 sa' }) */
export function t(key, vars) {
  const value = STRINGS[lang][key] ?? STRINGS.tr[key] ?? key;
  if (!vars || typeof value !== 'string') return value;
  return value.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}

/** Statik HTML: data-i18n (metin) ve data-i18n-aria / data-i18n-title (öznitelik) */
export function applyStatic(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
  root.querySelectorAll('[data-i18n-title]').forEach((el) => el.setAttribute('title', t(el.dataset.i18nTitle)));
}

/* ---------- Biçimlendirme ---------- */

/** 450 → "7 sa 30 dk" / "7h 30m"; 0 → "0 sa" */
export function fmtDuration(min) {
  const m = Math.round(min);
  const h = Math.floor(m / 60);
  const r = m % 60;
  const H = t('unit.h');
  const M = t('unit.m');
  if (!h && !r) return `0 ${H}`;
  if (lang === 'en') return [h ? `${h}${H}` : '', r ? `${r}${M}` : ''].filter(Boolean).join(' ');
  return [h ? `${h} ${H}` : '', r ? `${r} ${M}` : ''].filter(Boolean).join(' ');
}

/** 450 → "7,5 sa" (kısa, ondalık) */
export function fmtHours(min) {
  const v = Math.round((min / 60) * 10) / 10;
  const n = new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'tr-TR', { maximumFractionDigits: 1 }).format(v);
  return lang === 'en' ? `${n}${t('unit.h')}` : `${n} ${t('unit.h')}`;
}

export function fmtMoney(v) {
  return new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'tr-TR', {
    style: 'currency', currency: 'TRY', maximumFractionDigits: 0
  }).format(v);
}

const locale = () => (lang === 'en' ? 'en-GB' : 'tr-TR');
const asDate = (iso) => new Date(`${iso}T12:00:00Z`);

/** "13 Eki" */
export function fmtDayMonth(iso) {
  return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(asDate(iso));
}

/** "Ekim 2026" */
export function fmtMonthYear(iso) {
  return new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(asDate(iso));
}

/** "13–19 Ekim 2026" / "29 Eyl – 5 Eki 2026" */
export function fmtWeekRange(first, last) {
  const a = asDate(first);
  const b = asDate(last);
  const sameMonth = a.getUTCMonth() === b.getUTCMonth();
  const day = (d) => d.getUTCDate();
  if (sameMonth) {
    const month = new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(b);
    return `${day(a)}–${day(b)} ${month}`;
  }
  return `${fmtDayMonth(first)} – ${fmtDayMonth(last)} ${b.getUTCFullYear()}`;
}
