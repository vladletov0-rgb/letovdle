'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../src/game/engine');
const words = require('../src/game/words');

const C = 'correct';
const P = 'present';
const A = 'absent';

test('точное совпадение — все зелёные', () => {
  assert.deepEqual(engine.evaluate('песня', 'песня'), [C, C, C, C, C]);
});

test('жёлтые и серые', () => {
  assert.deepEqual(engine.evaluate('слово', 'песня'), [P, A, A, A, A]);
  assert.deepEqual(engine.evaluate('весна', 'песня'), [A, C, C, C, A]);
});

test('повторяющиеся буквы не подсвечиваются больше раз, чем есть в ответе', () => {
  // в ответе одна «о», в догадке три
  assert.deepEqual(engine.evaluate('молок', 'город'), [A, C, A, C, A]);
  // в «колос» две «о», в «город» тоже две: обе на своих местах
  assert.deepEqual(engine.evaluate('колос', 'город'), [A, C, A, C, A]);
  // зелёная буква «съедает» совпадение раньше жёлтой
  assert.deepEqual(engine.evaluate('ааарб', 'арбуз'), [C, A, A, P, P]);
});

test('ё и е считаются одной буквой', () => {
  assert.equal(words.normalize('ЁЖИК'), 'ежик');
  assert.deepEqual(engine.evaluate('актёр', 'актер'), [C, C, C, C, C]);
  assert.ok(words.isValidGuess('ОСЁТР'));
});

test('словари: ответы есть среди допустимых слов, все по 5 букв', () => {
  assert.ok(words.ANSWERS.length > 500);
  for (const w of words.ANSWERS) {
    assert.equal(w.length, 5);
    assert.ok(words.VALID.has(w));
  }
  assert.ok(words.isValidGuess('столы'));
  assert.ok(!words.isValidGuess('ыыыыы'));
});

test('слово дня детерминировано и зависит от даты', () => {
  assert.equal(words.dailyWord('2026-11-26'), words.dailyWord('2026-11-26'));
  assert.notEqual(words.dailyWord('2026-11-26'), words.dailyWord('2026-11-27'));
  assert.equal(words.dayNumber('2026-01-01'), 1);
  // полночь по Москве = 21:00 UTC предыдущего дня
  assert.equal(words.dateKey(new Date('2026-11-26T20:59:00Z'), 'Europe/Moscow'), '2026-11-26');
  assert.equal(words.dateKey(new Date('2026-11-26T21:00:00Z'), 'Europe/Moscow'), '2026-11-27');
});

test('игра: победа, поражение и клавиатура', () => {
  const g = engine.newGame({ answer: 'песня', mode: 'practice' });
  engine.applyGuess(g, 'слово');
  assert.equal(g.status, 'playing');
  engine.applyGuess(g, 'песня');
  assert.equal(g.status, 'won');
  assert.throws(() => engine.applyGuess(g, 'весна'));
  const kb = engine.keyboardState(g);
  assert.equal(kb['с'], C); // зелёный важнее жёлтого
  assert.equal(kb['л'], A);
  assert.equal(engine.emojiGrid(g), '🟨⬛⬛⬛⬛\n🟩🟩🟩🟩🟩');

  const l = engine.newGame({ answer: 'песня', mode: 'practice' });
  for (let i = 0; i < 6; i++) engine.applyGuess(l, 'слово');
  assert.equal(l.status, 'lost');
});
