'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * Простое хранилище в JSON-файле: текущие игры и статистика игроков.
 * Для небольшого бота этого достаточно; при желании легко заменить на БД.
 */
class Store {
  constructor(file = process.env.WORDLE_STATE_FILE || path.join(__dirname, '..', '..', 'data', 'state.json')) {
    this.file = file;
    this.data = { games: {}, stats: {} };
    this.timer = null;
    try {
      if (file && fs.existsSync(file)) this.data = { ...this.data, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
    } catch (err) {
      console.error('Не удалось прочитать файл состояния, начинаю с нуля:', err.message);
    }
  }

  static key(userId, mode) {
    return `${userId}:${mode}`;
  }

  getGame(userId, mode) {
    return this.data.games[Store.key(userId, mode)] || null;
  }

  setGame(userId, mode, game) {
    this.data.games[Store.key(userId, mode)] = game;
    this.save();
  }

  getStats(userId) {
    if (!this.data.stats[userId]) {
      this.data.stats[userId] = {
        daily: { played: 0, wins: 0, streak: 0, maxStreak: 0, lastWinDate: null, dist: [0, 0, 0, 0, 0, 0] },
        practice: { played: 0, wins: 0 },
      };
    }
    return this.data.stats[userId];
  }

  /** Записывает результат законченной игры в статистику. */
  recordResult(userId, game, previousDate = null) {
    const stats = this.getStats(userId);
    const won = game.status === 'won';
    if (game.mode === 'daily') {
      const s = stats.daily;
      s.played++;
      if (won) {
        s.wins++;
        s.dist[game.guesses.length - 1]++;
        s.streak = s.lastWinDate && s.lastWinDate === previousDate ? s.streak + 1 : 1;
        s.lastWinDate = game.date;
        s.maxStreak = Math.max(s.maxStreak, s.streak);
      } else {
        s.streak = 0;
      }
    } else {
      stats.practice.played++;
      if (won) stats.practice.wins++;
    }
    this.save();
    return stats;
  }

  save() {
    if (!this.file) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 500);
  }

  flush() {
    if (!this.file) return;
    clearTimeout(this.timer);
    const tmp = `${this.file}.tmp`;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(this.data));
    fs.renameSync(tmp, this.file);
  }
}

module.exports = { Store };
