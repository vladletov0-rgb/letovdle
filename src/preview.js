'use strict';

// Рисует пример поля в preview.png — удобно, чтобы посмотреть картинку без Discord.
const fs = require('node:fs');
const engine = require('./game/engine');
const { renderBoard } = require('./game/render');

const game = engine.newGame({ answer: 'песня', mode: 'practice' });
for (const w of process.argv.slice(2).length ? process.argv.slice(2) : ['слово', 'весна', 'песок', 'песня']) {
  if (game.status === 'playing') engine.applyGuess(game, w);
}
fs.writeFileSync('preview.png', renderBoard(game, { reveal: game.status === 'lost' }));
console.log('Сохранено в preview.png');
