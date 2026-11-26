'use strict';

const path = require('node:path');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const { MAX_ATTEMPTS, CORRECT, PRESENT, ABSENT, keyboardState } = require('./engine');
const { WORD_LENGTH } = require('./words');

// Шрифт с кириллицей, чтобы картинка выглядела одинаково на любом сервере.
let FONT = 'sans-serif';
try {
  const fontPath = path.join(path.dirname(require.resolve('dejavu-fonts-ttf/package.json')), 'ttf', 'DejaVuSans-Bold.ttf');
  if (GlobalFonts.registerFromPath(fontPath, 'LetovdleFont')) FONT = 'LetovdleFont';
} catch {
  // нет пакета со шрифтом — используем системный
}

const COLORS = {
  bg: '#121213',
  emptyBorder: '#3a3a3c',
  text: '#ffffff',
  [CORRECT]: '#538d4e',
  [PRESENT]: '#b59f3b',
  [ABSENT]: '#3a3a3c',
  key: '#818384',
};

const KEYBOARD = ['йцукенгшщзхъ', 'фывапролджэ', 'ячсмитьбю'];

const TILE = 62;
const GAP = 8;
const PAD = 24;
const KEY_W = 34;
const KEY_H = 46;
const KEY_GAP = 5;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Рисует поле игры и клавиатуру. Возвращает PNG (Buffer).
 * @param {object} game
 * @param {{ reveal?: boolean }} opts reveal — показать загаданное слово под полем
 */
function renderBoard(game, { reveal = false } = {}) {
  const gridW = WORD_LENGTH * TILE + (WORD_LENGTH - 1) * GAP;
  const kbW = KEYBOARD[0].length * KEY_W + (KEYBOARD[0].length - 1) * KEY_GAP;
  const width = Math.max(gridW, kbW) + PAD * 2;
  const gridH = MAX_ATTEMPTS * TILE + (MAX_ATTEMPTS - 1) * GAP;
  const revealH = reveal ? 50 : 0;
  const kbTop = PAD + gridH + revealH + 28;
  const height = kbTop + KEYBOARD.length * KEY_H + (KEYBOARD.length - 1) * KEY_GAP + PAD;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const gridX = (width - gridW) / 2;
  for (let row = 0; row < MAX_ATTEMPTS; row++) {
    const guess = game.guesses[row];
    for (let col = 0; col < WORD_LENGTH; col++) {
      const x = gridX + col * (TILE + GAP);
      const y = PAD + row * (TILE + GAP);
      if (guess) {
        ctx.fillStyle = COLORS[guess.result[col]];
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = COLORS.text;
        ctx.font = `bold 34px ${FONT}`;
        ctx.fillText(guess.word[col].toUpperCase(), x + TILE / 2, y + TILE / 2 + 1);
      } else {
        ctx.strokeStyle = COLORS.emptyBorder;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
      }
    }
  }

  if (reveal) {
    ctx.fillStyle = COLORS.text;
    ctx.font = `bold 26px ${FONT}`;
    ctx.fillText(game.answer.toUpperCase(), width / 2, PAD + gridH + 32);
  }

  const keys = keyboardState(game);
  KEYBOARD.forEach((line, r) => {
    const lineW = line.length * KEY_W + (line.length - 1) * KEY_GAP;
    const startX = (width - lineW) / 2;
    [...line].forEach((ch, i) => {
      const x = startX + i * (KEY_W + KEY_GAP);
      const y = kbTop + r * (KEY_H + KEY_GAP);
      ctx.fillStyle = keys[ch] ? COLORS[keys[ch]] : COLORS.key;
      roundRect(ctx, x, y, KEY_W, KEY_H, 5);
      ctx.fill();
      ctx.fillStyle = keys[ch] === ABSENT ? '#8a8a8c' : COLORS.text;
      ctx.font = `bold 18px ${FONT}`;
      ctx.fillText(ch.toUpperCase(), x + KEY_W / 2, y + KEY_H / 2 + 1);
    });
  });

  return canvas.toBuffer('image/png');
}

module.exports = { renderBoard, COLORS, FONT };
