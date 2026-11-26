'use strict';

require('dotenv').config();
const { Client, Events, GatewayIntentBits, ActivityType } = require('discord.js');
const { Store } = require('./game/store');
const { createHandlers } = require('./bot');
const words = require('./game/words');

if (!process.env.DISCORD_TOKEN) {
  console.error('Не задан DISCORD_TOKEN. Скопируй .env.example в .env и заполни его.');
  process.exit(1);
}

const store = new Store();
const { handle } = createHandlers(store);

// Боту не нужны привилегированные интенты: всё работает через слэш-команды.
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (c) => {
  console.log(`Летовдле запущен как ${c.user.tag}. Слов для отгадывания: ${words.ANSWERS.length}, в словаре: ${words.VALID.size}.`);
  c.user.setActivity('/wordle', { type: ActivityType.Playing });
});

client.on(Events.InteractionCreate, handle);

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    store.flush();
    client.destroy();
    process.exit(0);
  });
}

client.login(process.env.DISCORD_TOKEN);
