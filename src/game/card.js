'use strict';

const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { MAX_ATTEMPTS, CORRECT, PRESENT } = require('./engine');
const { WORD_LENGTH, dayNumber } = require('./words');
const { COLORS, FONT } = require('./render');

const W = 560;
const PAD = 32;
const AVATAR = 76;
const TILE = 52;
const GAP = 7;

const C = {
  bgTop: '#1e1f24',
  bgBottom: '#121214',
  border: '#2e3036',
  muted: '#9a9ca3',
  faint: '#26272c',
  divider: '#2a2b30',
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

/** Убирает эмодзи и прочие символы, которые шрифт не нарисует (флаги, ZWJ-последовательности). */
function cleanName(name) {
  const cleaned = String(name ?? '')
    .replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}‍️︎⃣]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'Игрок';
}

/** Обрезает текст с многоточием, чтобы он влез в maxWidth. */
function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = [...text];
  while (t.length > 1 && ctx.measureText(`${t.join('')}…`).width > maxWidth) t.pop();
  return `${t.join('')}…`;
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** Скачивает аватарку; при любой ошибке возвращает null (тогда рисуем букву). */
async function fetchAvatar(url, timeoutMs = 4000) {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    return await loadImage(Buffer.from(await res.arrayBuffer()));
  } catch {
    return null;
  }
}

/**
 * Карточка результата для чата: аватарка, ник, номер игры, счёт и сетка без букв.
 * @param {object} p
 * @param {object} p.game законченная игра
 * @param {string} p.name отображаемое имя игрока
 * @param {import('@napi-rs/canvas').Image|null} [p.avatar]
 * @param {number} [p.streak] текущая серия побед (для слова дня)
 * @returns {Buffer} PNG
 */
function renderShareCard({ game, name, avatar = null, streak = 0 }) {
  const gridW = WORD_LENGTH * TILE + (WORD_LENGTH - 1) * GAP;
  const gridH = MAX_ATTEMPTS * TILE + (MAX_ATTEMPTS - 1) * GAP;
  const headerH = AVATAR;
  const gridTop = PAD + headerH + 28;
  const footerTop = gridTop + gridH + 26;
  const H = footerTop + 40 + PAD - 8;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // фон-карточка
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, C.bgTop);
  grad.addColorStop(1, C.bgBottom);
  roundRect(ctx, 0, 0, W, H, 24);
  ctx.fillStyle = grad;
  ctx.fill();
  roundRect(ctx, 1, 1, W - 2, H - 2, 23);
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 2;
  ctx.stroke();

  const won = game.status === 'won';
  const accent = won ? COLORS[CORRECT] : COLORS.emptyBorder;

  // аватарка в кружке с цветной обводкой
  const ax = PAD;
  const ay = PAD;
  ctx.save();
  ctx.beginPath();
  ctx.arc(ax + AVATAR / 2, ay + AVATAR / 2, AVATAR / 2 + 4, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ax + AVATAR / 2, ay + AVATAR / 2, AVATAR / 2, 0, Math.PI * 2);
  ctx.clip();
  const displayName = cleanName(name);
  if (avatar) {
    ctx.drawImage(avatar, ax, ay, AVATAR, AVATAR);
  } else {
    ctx.fillStyle = '#5865f2';
    ctx.fillRect(ax, ay, AVATAR, AVATAR);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 34px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText([...displayName][0].toUpperCase(), ax + AVATAR / 2, ay + AVATAR / 2 + 2);
  }
  ctx.restore();

  // счёт справа
  const score = `${won ? game.guesses.length : 'X'}/${MAX_ATTEMPTS}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `bold 46px ${FONT}`;
  ctx.fillStyle = won ? COLORS[CORRECT] : '#d9534f';
  ctx.fillText(score, W - PAD, ay + 50);
  const scoreW = ctx.measureText(score).width;
  ctx.font = `bold 13px ${FONT}`;
  ctx.fillStyle = C.muted;
  ctx.fillText(won ? 'УГАДАНО' : 'НЕ УГАДАНО', W - PAD, ay + 72);

  // ник и подпись
  const textX = ax + AVATAR + 20;
  const textMax = W - PAD - scoreW - 24 - textX;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 26px ${FONT}`;
  ctx.fillText(fitText(ctx, displayName, textMax), textX, ay + 34);
  ctx.font = `18px ${FONT}`;
  ctx.fillStyle = C.muted;
  const subtitle = game.mode === 'daily' ? `Летовдле #${dayNumber(game.date)}` : 'Летовдле · тренировка';
  ctx.fillText(fitText(ctx, subtitle, textMax), textX, ay + 62);

  // разделитель
  ctx.fillStyle = C.divider;
  ctx.fillRect(PAD, PAD + headerH + 14, W - PAD * 2, 2);

  // сетка без букв
  const gx = (W - gridW) / 2;
  for (let r = 0; r < MAX_ATTEMPTS; r++) {
    const g = game.guesses[r];
    for (let c = 0; c < WORD_LENGTH; c++) {
      const x = gx + c * (TILE + GAP);
      const y = gridTop + r * (TILE + GAP);
      roundRect(ctx, x, y, TILE, TILE, 8);
      if (g) {
        ctx.fillStyle = COLORS[g.result[c]];
        ctx.fill();
      } else {
        ctx.strokeStyle = C.faint;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  // подвал: время, серия
  const bits = [];
  const dur = formatDuration((game.finishedAt ?? 0) - (game.startedAt ?? 0));
  if (dur) bits.push(`⏱ ${dur}`);
  if (game.mode === 'daily' && won && streak > 0) bits.push(`серия ${streak}`);
  const greens = game.guesses.flatMap((g) => g.result).filter((r) => r === CORRECT).length;
  const yellows = game.guesses.flatMap((g) => g.result).filter((r) => r === PRESENT).length;

  ctx.textBaseline = 'middle';
  const fy = footerTop + 16;
  // легенда-точки
  ctx.font = `16px ${FONT}`;
  let x = PAD;
  for (const [color, n] of [[COLORS[CORRECT], greens], [COLORS[PRESENT], yellows]]) {
    roundRect(ctx, x, fy - 8, 16, 16, 4);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = C.muted;
    ctx.textAlign = 'left';
    ctx.fillText(String(n), x + 22, fy + 1);
    x += 22 + ctx.measureText(String(n)).width + 18;
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = C.muted;
  ctx.fillText(bits.join('   ·   ').replace('⏱ ', 'время '), W - PAD, fy + 1);

  return canvas.toBuffer('image/png');
}

module.exports = { renderShareCard, fetchAvatar, cleanName, formatDuration };
