/* ==========================================================================
   share.js — haftalık programı paylaşılabilir bir PNG kartına çizer (canvas)
   Harici servis yok. Kart 1080×1350 (telefonda ve mesajlaşma uygulamalarında
   tam ekran görünen dikey oran). Kişisel hedef oturumları karta girmez;
   yalnızca vardiyalar paylaşılır.
   ========================================================================== */

const W = 1080;
const H = 1350;
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const C = {
  bg: '#f5f6f8',
  card: '#ffffff',
  ink: '#14161a',
  muted: '#5d6470',
  line: '#e2e5ea',
  accent: '#2f5bd8',
  soft: '#eef0f3',
  alert: '#c92a2a'
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Sığmayan metni … ile kısaltır */
function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

/**
 * @param {object} data
 * @param {string} data.title     "Haftalık program"
 * @param {string} data.range     "12–18 Ekim 2026"
 * @param {{day, date, name, time, color, hours, overtime, empty}[]} data.rows   7 satır
 * @param {{label, value, alert?}[]} data.totals                                3 kutu
 * @param {string} data.footer
 * @returns {HTMLCanvasElement}
 */
export function drawWeekCard(data, canvas = document.createElement('canvas')) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const P = 72; // kenar boşluğu

  // Zemin
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  // Üst: marka + başlık
  ctx.strokeStyle = C.accent;
  ctx.lineWidth = 5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  roundRect(ctx, P, 70, 64, 58, 14);
  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(P, 92); ctx.lineTo(P + 64, 92); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(P + 17, 60); ctx.lineTo(P + 17, 74); ctx.moveTo(P + 47, 60); ctx.lineTo(P + 47, 74); ctx.stroke();
  ctx.fillStyle = C.ink;
  ctx.font = `800 46px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.fillText('Nöbetçi', P + 88, 100);

  ctx.font = `600 30px ${FONT}`;
  ctx.fillStyle = C.muted;
  ctx.fillText(data.title, P, 182);
  ctx.font = `800 54px ${FONT}`;
  ctx.fillStyle = C.ink;
  ctx.fillText(fitText(ctx, data.range, W - 2 * P), P, 240);

  // Günler
  const top = 300;
  const rowH = 104;
  const gap = 12;
  data.rows.forEach((r, i) => {
    const y = top + i * (rowH + gap);
    ctx.fillStyle = C.card;
    roundRect(ctx, P, y, W - 2 * P, rowH, 22);
    ctx.fill();

    // gün
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.ink;
    ctx.font = `800 34px ${FONT}`;
    ctx.fillText(r.day, P + 32, y + rowH / 2 - 16);
    ctx.fillStyle = C.muted;
    ctx.font = `500 24px ${FONT}`;
    ctx.fillText(r.date, P + 32, y + rowH / 2 + 20);

    // vardiya rengi
    const sx = P + 200;
    if (r.empty) {
      ctx.strokeStyle = C.muted;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 6]);
      roundRect(ctx, sx, y + 30, 26, 44, 8);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.fillStyle = r.color;
      roundRect(ctx, sx, y + 26, 26, 52, 8);
      ctx.fill();
    }

    // vardiya adı + saat
    const hoursW = 190;
    const textMax = W - 2 * P - (sx - P) - 44 - hoursW;
    ctx.fillStyle = r.empty ? C.muted : C.ink;
    ctx.font = `700 34px ${FONT}`;
    ctx.fillText(fitText(ctx, r.name, textMax), sx + 44, y + rowH / 2 - (r.time ? 16 : 0));
    if (r.time) {
      ctx.fillStyle = C.muted;
      ctx.font = `500 26px ${FONT}`;
      ctx.fillText(r.time, sx + 44, y + rowH / 2 + 20);
    }

    // saat
    ctx.textAlign = 'right';
    ctx.fillStyle = C.ink;
    ctx.font = `800 34px ${FONT}`;
    ctx.fillText(r.hours, W - P - 32, y + rowH / 2 - (r.overtime ? 14 : 0));
    if (r.overtime) {
      ctx.fillStyle = C.alert;
      ctx.font = `700 24px ${FONT}`;
      ctx.fillText(r.overtime, W - P - 32, y + rowH / 2 + 22);
    }
    ctx.textAlign = 'left';
  });

  // Toplamlar
  const ty = top + 7 * (rowH + gap) + 12;
  const boxW = (W - 2 * P - 2 * 16) / 3;
  data.totals.forEach((tot, i) => {
    const x = P + i * (boxW + 16);
    ctx.fillStyle = C.soft;
    roundRect(ctx, x, ty, boxW, 116, 22);
    ctx.fill();
    ctx.fillStyle = C.muted;
    ctx.font = `600 24px ${FONT}`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(fitText(ctx, tot.label, boxW - 48), x + 24, ty + 44);
    ctx.fillStyle = tot.alert ? C.alert : C.ink;
    ctx.font = `800 40px ${FONT}`;
    ctx.fillText(fitText(ctx, tot.value, boxW - 48), x + 24, ty + 94);
  });

  // Alt bilgi
  ctx.fillStyle = C.muted;
  ctx.font = `500 22px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(data.footer, W / 2, H - 34);
  ctx.textAlign = 'left';

  return canvas;
}
