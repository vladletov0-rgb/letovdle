'use strict';

const {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const words = require('./game/words');
const engine = require('./game/engine');
const { renderBoard } = require('./game/render');
const { renderShareCard, fetchAvatar } = require('./game/card');

const GREEN = 0x538d4e;
const YELLOW = 0xb59f3b;
const GRAY = 0x3a3a3c;

function prevDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

function title(game) {
  return game.mode === 'daily' ? `Летовдле #${words.dayNumber(game.date)}` : 'Летовдле · тренировка';
}

/** Сообщение с полем игры: картинка + кнопки. */
function buildView(game, notice = null) {
  const file = new AttachmentBuilder(renderBoard(game, { reveal: game.status === 'lost' }), { name: 'letovdle.png' });
  const embed = new EmbedBuilder().setTitle(title(game)).setImage('attachment://letovdle.png');

  const tries = game.guesses.length;
  if (game.status === 'won') {
    const praise = ['Гениально!', 'Великолепно!', 'Впечатляет!', 'Отлично!', 'Хорошо!', 'Фух, успел!'][tries - 1];
    embed.setColor(GREEN).setDescription(`🎉 **${praise}** Слово **${game.answer.toUpperCase()}** угадано за ${tries}/${engine.MAX_ATTEMPTS}.`);
  } else if (game.status === 'lost') {
    embed.setColor(GRAY).setDescription(`Попытки закончились. Загаданное слово: **${game.answer.toUpperCase()}**.`);
  } else {
    const left = engine.MAX_ATTEMPTS - tries;
    embed
      .setColor(YELLOW)
      .setDescription(
        `${notice ? `⚠️ ${notice}\n\n` : ''}Осталось ${left} ${plural(left, 'попытка', 'попытки', 'попыток')}. Жми **«Ввести слово»**.`,
      );
  }
  if (game.mode === 'daily' && game.status !== 'playing') embed.setFooter({ text: 'Новое слово — завтра в 00:00 по Москве' });

  const row = new ActionRowBuilder();
  if (game.status === 'playing') {
    row.addComponents(
      new ButtonBuilder().setCustomId(`letodle:guess:${game.mode}`).setLabel('Ввести слово').setEmoji('⌨️').setStyle(ButtonStyle.Success),
    );
  } else {
    row.addComponents(
      new ButtonBuilder().setCustomId(`letodle:share:${game.mode}`).setLabel('Поделиться').setEmoji('📤').setStyle(ButtonStyle.Primary),
    );
    if (game.mode === 'practice') {
      row.addComponents(
        new ButtonBuilder().setCustomId('letodle:new:practice').setLabel('Новое слово').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
      );
    }
  }
  return { embeds: [embed], files: [file], components: [row], attachments: [] };
}

function buildModal(mode) {
  const input = new TextInputBuilder()
    .setCustomId('word')
    .setLabel('Слово из 5 букв')
    .setPlaceholder('например, КОШКА')
    .setStyle(TextInputStyle.Short)
    .setMinLength(words.WORD_LENGTH)
    .setMaxLength(words.WORD_LENGTH)
    .setRequired(true);
  return new ModalBuilder()
    .setCustomId(`letodle:modal:${mode}`)
    .setTitle('Летовдле')
    .addComponents(new ActionRowBuilder().addComponents(input));
}

function rulesEmbed() {
  return new EmbedBuilder()
    .setTitle('Как играть в Летовдле')
    .setColor(GREEN)
    .setDescription(
      [
        `Угадай слово из **${words.WORD_LENGTH} букв** за **${engine.MAX_ATTEMPTS} попыток**.`,
        'После каждой попытки буквы подсвечиваются:',
        '🟩 буква есть в слове и стоит на своём месте',
        '🟨 буква есть в слове, но в другом месте',
        '⬛ такой буквы в слове нет',
        '',
        'Можно вводить только существующие слова. Буквы **Е** и **Ё** считаются одной буквой.',
        '',
        '`/letodle день` — слово дня, одно на всех, обновляется в полночь по Москве.',
        '`/letodle тренировка` — случайные слова без ограничений.',
        '`/letodle статистика` — твои результаты.',
      ].join('\n'),
    );
}

function statsEmbed(user, stats) {
  const d = stats.daily;
  const pct = d.played ? Math.round((d.wins / d.played) * 100) : 0;
  const max = Math.max(1, ...d.dist);
  const bars = d.dist
    .map((n, i) => `\`${i + 1}\` ${'🟩'.repeat(Math.max(n ? 1 : 0, Math.round((n / max) * 10)))} ${n}`)
    .join('\n');
  return new EmbedBuilder()
    .setTitle(`Статистика: ${user.displayName ?? user.username}`)
    .setColor(GREEN)
    .addFields(
      { name: 'Сыграно', value: String(d.played), inline: true },
      { name: 'Побед', value: `${pct}%`, inline: true },
      { name: 'Серия', value: String(d.streak), inline: true },
      { name: 'Лучшая серия', value: String(d.maxStreak), inline: true },
      { name: 'Тренировки', value: `${stats.practice.wins}/${stats.practice.played}`, inline: true },
      { name: 'Попыток до победы (слово дня)', value: bars },
    );
}

/** Текстовая версия результата — идёт в alt-текст картинки. */
function shareText(game, name) {
  const score = game.status === 'won' ? game.guesses.length : 'X';
  const head = game.mode === 'daily' ? `Летовдле #${words.dayNumber(game.date)}` : 'Летовдле (тренировка)';
  return `${name}: ${head} ${score}/${engine.MAX_ATTEMPTS}\n${engine.emojiGrid(game)}`;
}

/**
 * Обработчики взаимодействий. store — хранилище игр, now — функция текущего времени (для тестов).
 */
function createHandlers(store, { now = () => new Date(), random = Math.random } = {}) {
  const today = () => words.dateKey(now());

  function getOrStartDaily(userId) {
    const key = today();
    let game = store.getGame(userId, 'daily');
    if (!game || game.date !== key) {
      game = engine.newGame({ answer: words.dailyWord(key), mode: 'daily', date: key });
      store.setGame(userId, 'daily', game);
    }
    return game;
  }

  function startPractice(userId) {
    const game = engine.newGame({ answer: words.randomWord(random), mode: 'practice' });
    store.setGame(userId, 'practice', game);
    return game;
  }

  async function onCommand(interaction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const ephemeral = { flags: MessageFlags.Ephemeral };

    if (sub === 'rules') return interaction.reply({ embeds: [rulesEmbed()], ...ephemeral });
    if (sub === 'stats') return interaction.reply({ embeds: [statsEmbed(interaction.user, store.getStats(userId))], ...ephemeral });

    let game;
    if (sub === 'daily') {
      game = getOrStartDaily(userId);
    } else {
      game = store.getGame(userId, 'practice');
      if (!game || game.status !== 'playing') game = startPractice(userId);
    }
    return interaction.reply({ ...buildView(game), ...ephemeral });
  }

  async function onButton(interaction) {
    const [, action, mode] = interaction.customId.split(':');
    const userId = interaction.user.id;
    const game = store.getGame(userId, mode);

    if (action === 'new') return interaction.update(buildView(startPractice(userId)));

    if (!game) {
      return interaction.reply({ content: 'Игра не найдена. Начни заново: `/letodle`.', flags: MessageFlags.Ephemeral });
    }

    if (action === 'guess') {
      if (mode === 'daily' && game.date !== today()) {
        return interaction.update(buildView(getOrStartDaily(userId), 'Наступил новый день — вот новое слово!'));
      }
      if (game.status !== 'playing') return interaction.update(buildView(game));
      return interaction.showModal(buildModal(mode));
    }

    if (action === 'share') {
      if (game.status === 'playing') return interaction.reply({ content: 'Сначала доиграй!', flags: MessageFlags.Ephemeral });
      return shareCard(interaction, game);
    }
    return undefined;
  }

  /** Публикует в чат картинку-карточку с результатом (без букв, чтобы не спойлерить). */
  async function shareCard(interaction, game) {
    await interaction.deferReply();
    const { user, member } = interaction;
    const hasMember = member && typeof member.displayAvatarURL === 'function';
    const name = (hasMember && member.displayName) || user.displayName || user.username;
    const avatarUrl = (hasMember ? member : user).displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
    const avatar = await fetchAvatar(avatarUrl);
    const png = renderShareCard({ game, name, avatar, streak: store.getStats(user.id).daily.streak });
    return interaction.editReply({
      files: [new AttachmentBuilder(png, { name: 'letovdle-result.png', description: shareText(game, name) })],
    });
  }

  async function onModal(interaction) {
    const [, , mode] = interaction.customId.split(':');
    const userId = interaction.user.id;
    const respond = (payload) =>
      interaction.isFromMessage() ? interaction.update(payload) : interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });

    let game = store.getGame(userId, mode);
    if (!game) return respond({ content: 'Игра не найдена. Начни заново: `/letodle`.', embeds: [], components: [] });

    if (mode === 'daily' && game.date !== today()) {
      return respond(buildView(getOrStartDaily(userId), 'Наступил новый день — вот новое слово! Введи догадку ещё раз.'));
    }
    if (game.status !== 'playing') return respond(buildView(game));

    const raw = interaction.fields.getTextInputValue('word');
    const guess = words.normalize(raw);
    if (!/^[а-я]+$/.test(guess) || guess.length !== words.WORD_LENGTH) {
      return respond(buildView(game, `«${raw}» — нужно слово из ${words.WORD_LENGTH} русских букв.`));
    }
    if (!words.isValidGuess(guess)) {
      return respond(buildView(game, `Слова **${guess.toUpperCase()}** нет в словаре.`));
    }
    if (game.guesses.some((g) => g.word === guess)) {
      return respond(buildView(game, `Слово **${guess.toUpperCase()}** уже было.`));
    }

    engine.applyGuess(game, guess);
    store.setGame(userId, mode, game);
    if (game.status !== 'playing') store.recordResult(userId, game, game.date ? prevDateKey(game.date) : null);
    game = store.getGame(userId, mode);
    return respond(buildView(game));
  }

  async function handle(interaction) {
    try {
      if (interaction.isChatInputCommand() && interaction.commandName === 'letodle') return await onCommand(interaction);
      if (interaction.isButton() && interaction.customId.startsWith('letodle:')) return await onButton(interaction);
      if (interaction.isModalSubmit() && interaction.customId.startsWith('letodle:')) return await onModal(interaction);
    } catch (err) {
      console.error('Ошибка при обработке взаимодействия:', err);
      const payload = { content: 'Что-то пошло не так 😕 Попробуй ещё раз.', flags: MessageFlags.Ephemeral };
      if (interaction.isRepliable()) {
        await (interaction.replied || interaction.deferred ? interaction.followUp(payload) : interaction.reply(payload)).catch(() => {});
      }
    }
    return undefined;
  }

  return { handle, onCommand, onButton, onModal };
}

module.exports = { createHandlers, buildView, shareText, prevDateKey, plural };
