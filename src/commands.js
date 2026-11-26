'use strict';

const { SlashCommandBuilder, InteractionContextType, ApplicationIntegrationType } = require('discord.js');

const letodle = new SlashCommandBuilder()
  .setName('letodle')
  .setDescription('Russian Wordle: guess the 5-letter word in 6 tries')
  .setDescriptionLocalizations({ ru: 'Летовдле: угадай слово из 5 букв за 6 попыток' })
  .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
  .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
  .addSubcommand((s) =>
    s
      .setName('daily')
      .setNameLocalizations({ ru: 'день' })
      .setDescription('Word of the day: the same word for everyone')
      .setDescriptionLocalizations({ ru: 'Слово дня — одно на всех, одна попытка в сутки' }),
  )
  .addSubcommand((s) =>
    s
      .setName('practice')
      .setNameLocalizations({ ru: 'тренировка' })
      .setDescription('Practice with a random word, as many times as you like')
      .setDescriptionLocalizations({ ru: 'Случайное слово, играй сколько хочешь' }),
  )
  .addSubcommand((s) =>
    s
      .setName('stats')
      .setNameLocalizations({ ru: 'статистика' })
      .setDescription('Your statistics')
      .setDescriptionLocalizations({ ru: 'Твоя статистика' }),
  )
  .addSubcommand((s) =>
    s
      .setName('rules')
      .setNameLocalizations({ ru: 'правила' })
      .setDescription('How to play')
      .setDescriptionLocalizations({ ru: 'Как играть' }),
  );

module.exports = { commands: [letodle] };
