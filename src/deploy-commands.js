'use strict';

require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { commands } = require('./commands');

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('Заполни DISCORD_TOKEN и CLIENT_ID в файле .env');
  process.exit(1);
}

const rest = new REST().setToken(DISCORD_TOKEN);
const body = commands.map((c) => c.toJSON());
const route = GUILD_ID ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID) : Routes.applicationCommands(CLIENT_ID);

rest
  .put(route, { body })
  .then(() => console.log(`Команды зарегистрированы ${GUILD_ID ? `на сервере ${GUILD_ID}` : 'глобально'}.`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
