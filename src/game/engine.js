'use strict';

const { WORD_LENGTH, normalize } = require('./words');

const MAX_ATTEMPTS = 6;

/** Статусы клеток. */
const CORRECT = 'correct'; // буква на своём месте (зелёный)
const PRESENT = 'present'; // буква есть, но в другом месте (жёлтый)
const ABSENT = 'absent'; //   буквы нет (серый)

const RANK = { [ABSENT]: 1, [PRESENT]: 2, [CORRECT]: 3 };

/**
 * Оценка догадки по классическим правилам Wordle, с правильной обработкой
 * повторяющихся букв: сначала отмечаем точные совпадения, потом
 * «жёлтые» — но не больше раз, чем буква встречается в ответе.
 */
function evaluate(guess, answer) {
  const g = [...normalize(guess)];
  const a = [...normalize(answer)];
  if (g.length !== WORD_LENGTH || a.length !== WORD_LENGTH) {
    throw new Error(`Слова должны быть из ${WORD_LENGTH} букв`);
  }
  const result = new Array(WORD_LENGTH).fill(ABSENT);
  const left = {};

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (g[i] === a[i]) result[i] = CORRECT;
    else left[a[i]] = (left[a[i]] || 0) + 1;
  }
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] === CORRECT) continue;
    if (left[g[i]] > 0) {
      result[i] = PRESENT;
      left[g[i]]--;
    }
  }
  return result;
}

function newGame({ answer, mode, date = null }) {
  return {
    answer: normalize(answer),
    mode, // 'daily' | 'practice'
    date, // для ежедневной игры — YYYY-MM-DD
    guesses: [], // [{ word, result }]
    status: 'playing', // 'playing' | 'won' | 'lost'
    startedAt: Date.now(),
    finishedAt: null,
  };
}

/** Применяет догадку к игре (мутирует объект). Проверку словаря делает вызывающий код. */
function applyGuess(game, rawGuess) {
  if (game.status !== 'playing') throw new Error('Игра уже закончена');
  const word = normalize(rawGuess);
  const result = evaluate(word, game.answer);
  game.guesses.push({ word, result });
  if (word === game.answer) game.status = 'won';
  else if (game.guesses.length >= MAX_ATTEMPTS) game.status = 'lost';
  if (game.status !== 'playing') game.finishedAt = Date.now();
  return result;
}

/** Лучший известный статус каждой буквы — для раскраски клавиатуры. */
function keyboardState(game) {
  const keys = {};
  for (const { word, result } of game.guesses) {
    [...word].forEach((ch, i) => {
      if (!keys[ch] || RANK[result[i]] > RANK[keys[ch]]) keys[ch] = result[i];
    });
  }
  return keys;
}

const EMOJI = { [CORRECT]: '🟩', [PRESENT]: '🟨', [ABSENT]: '⬛' };

/** Сетка из эмодзи без букв — чтобы делиться результатом, не раскрывая слово. */
function emojiGrid(game) {
  return game.guesses.map((g) => g.result.map((r) => EMOJI[r]).join('')).join('\n');
}

module.exports = {
  MAX_ATTEMPTS,
  CORRECT,
  PRESENT,
  ABSENT,
  evaluate,
  newGame,
  applyGuess,
  keyboardState,
  emojiGrid,
};
