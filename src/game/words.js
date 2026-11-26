'use strict';

const fs = require('node:fs');
const path = require('node:path');

const WORD_LENGTH = 5;
const DATA_DIR = path.join(__dirname, '..', '..', 'data');

/**
 * Приводим слово к «игровому» виду: нижний регистр, ё -> е, без пробелов.
 * Буква ё во всей игре считается буквой е — так и в загаданных словах,
 * и в догадках, поэтому «ЕЛКА» и «ЁЛКА» — одно и то же слово.
 */
function normalize(word) {
  return String(word).trim().toLowerCase().replace(/ё/g, 'е');
}

function loadList(file) {
  return fs
    .readFileSync(path.join(DATA_DIR, file), 'utf8')
    .split(/\r?\n/)
    .map(normalize)
    .filter((w) => w.length === WORD_LENGTH && /^[а-я]+$/.test(w));
}

const ANSWERS = [...new Set(loadList('answers.txt'))];
const VALID = new Set([...loadList('valid.txt'), ...ANSWERS]);

function isValidGuess(word) {
  return VALID.has(normalize(word));
}

// Детерминированное перемешивание, чтобы слово дня не шло по алфавиту,
// но было одинаковым у всех и после перезапуска бота.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAILY_ORDER = (() => {
  const arr = [...ANSWERS].sort();
  const rnd = mulberry32(0x1e70d1e);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
})();

const EPOCH = Date.UTC(2026, 0, 1);

/** Дата (YYYY-MM-DD) в нужном часовом поясе. */
function dateKey(date = new Date(), timeZone = process.env.WORDLE_TZ || 'Europe/Moscow') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Номер дня игры (с 1), начиная с 1 января 2026. */
function dayNumber(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 86400000) + 1;
}

function dailyWord(key) {
  const n = dayNumber(key);
  const len = DAILY_ORDER.length;
  return DAILY_ORDER[(((n - 1) % len) + len) % len];
}

function randomWord(rnd = Math.random) {
  return ANSWERS[Math.floor(rnd() * ANSWERS.length)];
}

module.exports = {
  WORD_LENGTH,
  ANSWERS,
  VALID,
  normalize,
  isValidGuess,
  dateKey,
  dayNumber,
  dailyWord,
  randomWord,
};
