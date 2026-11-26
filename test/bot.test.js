'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHandlers, prevDateKey } = require('../src/bot');
const { Store } = require('../src/game/store');
const words = require('../src/game/words');

function fakeInteraction(kind, { customId, sub, value, user = { id: '42', username: 'tester', displayName: 'Тестер', displayAvatarURL: () => null } } = {}) {
  const calls = [];
  const it = {
    calls,
    user,
    customId,
    commandName: 'letodle',
    replied: false,
    deferred: false,
    isChatInputCommand: () => kind === 'command',
    isButton: () => kind === 'button',
    isModalSubmit: () => kind === 'modal',
    isFromMessage: () => true,
    isRepliable: () => true,
    options: { getSubcommand: () => sub },
    fields: { getTextInputValue: () => value },
  };
  for (const m of ['reply', 'update', 'showModal', 'followUp', 'deferReply', 'editReply']) {
    it[m] = async (payload) => {
      calls.push([m, payload]);
    };
  }
  return it;
}

const NOW = new Date('2026-11-26T12:00:00Z');

test('полный цикл слова дня через взаимодействия', async () => {
  const store = new Store(null);
  const { handle } = createHandlers(store, { now: () => NOW });
  const answer = words.dailyWord('2026-11-26');

  const cmd = fakeInteraction('command', { sub: 'daily' });
  await handle(cmd);
  assert.equal(cmd.calls[0][0], 'reply');
  assert.ok(cmd.calls[0][1].files.length === 1);

  const btn = fakeInteraction('button', { customId: 'letodle:guess:daily' });
  await handle(btn);
  assert.equal(btn.calls[0][0], 'showModal');

  const bad = fakeInteraction('modal', { customId: 'letodle:modal:daily', value: 'ыыыыы' });
  await handle(bad);
  assert.match(bad.calls[0][1].embeds[0].data.description, /нет в словаре/);
  assert.equal(store.getGame('42', 'daily').guesses.length, 0);

  const good = fakeInteraction('modal', { customId: 'letodle:modal:daily', value: answer.toUpperCase() });
  await handle(good);
  assert.equal(store.getGame('42', 'daily').status, 'won');
  assert.match(good.calls[0][1].embeds[0].data.description, /угадано за 1\/6/);
  assert.equal(store.getStats('42').daily.wins, 1);
  assert.equal(store.getStats('42').daily.streak, 1);

  const share = fakeInteraction('button', { customId: 'letodle:share:daily' });
  await handle(share);
  assert.deepEqual(share.calls.map((c) => c[0]), ['deferReply', 'editReply']);
  assert.equal(share.calls[0][1], undefined, 'результат публикуется для всех, не эфемерно');
  const [file] = share.calls[1][1].files;
  assert.equal(file.name, 'letovdle-result.png');
  assert.equal(file.description, 'Тестер: Летовдле #330 1/6\n🟩🟩🟩🟩🟩');
  assert.ok(file.attachment.subarray(1, 4).toString() === 'PNG');

  // повторный /letodle день в тот же день не даёт сыграть заново
  const again = fakeInteraction('command', { sub: 'daily' });
  await handle(again);
  assert.equal(store.getGame('42', 'daily').status, 'won');
});

test('серия слова дня растёт только при победе в соседние дни', () => {
  const store = new Store(null);
  const win = (date) => store.recordResult('1', { mode: 'daily', status: 'won', date, guesses: [{}, {}] }, prevDateKey(date));
  win('2026-11-25');
  win('2026-11-26');
  assert.equal(store.getStats('1').daily.streak, 2);
  win('2026-11-28');
  assert.equal(store.getStats('1').daily.streak, 1);
  assert.equal(store.getStats('1').daily.maxStreak, 2);
  assert.deepEqual(store.getStats('1').daily.dist, [0, 3, 0, 0, 0, 0]);
  assert.equal(prevDateKey('2026-03-01'), '2026-02-28');
});

test('тренировка: новое слово после окончания', async () => {
  const store = new Store(null);
  const { handle } = createHandlers(store, { now: () => NOW, random: () => 0 });
  await handle(fakeInteraction('command', { sub: 'practice' }));
  const game = store.getGame('42', 'practice');
  assert.equal(game.answer, words.ANSWERS[0]);
  for (const w of ['слово', 'весна', 'песок', 'песня', 'город', 'лодка']) {
    if (w !== game.answer) await handle(fakeInteraction('modal', { customId: 'letodle:modal:practice', value: w }));
  }
  assert.equal(store.getGame('42', 'practice').status, 'lost');
  const btn = fakeInteraction('button', { customId: 'letodle:new:practice' });
  await handle(btn);
  assert.equal(store.getGame('42', 'practice').status, 'playing');
  assert.equal(store.getStats('42').practice.played, 1);
});

test('слэш-команда собирается без ошибок', () => {
  const { commands } = require('../src/commands');
  const json = commands[0].toJSON();
  assert.equal(json.name, 'letodle');
  assert.deepEqual(json.options.map((o) => o.name), ['daily', 'practice', 'stats', 'rules']);
});
