# Discord Bot

A clean, scalable Discord bot foundation built with [discord.js v14](https://discord.js.org).

## Project Structure

```
discord-bot/
├── index.js              # Entry point — loads commands & events, logs in
├── deploy-commands.js    # Registers slash commands with Discord
├── .env                  # Your secrets (never commit this)
├── .env.example          # Template — copy to .env
└── src/
    ├── commands/
    │   └── ping/
    │       └── ping.js   # Example command
    └── events/
        ├── ready.js           # Fires when bot is online
        └── interactionCreate.js  # Handles slash commands + cooldowns
```

## Quick Start

### 1. Create a Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application** → name it
3. Go to **Bot** → click **Add Bot**
4. Copy the **Token**
5. Enable **Message Content Intent** under Privileged Gateway Intents

### 2. Invite to Your Server

In the Dev Portal go to **OAuth2 → URL Generator**:
- Scopes: `bot`, `applications.commands`
- Bot Permissions: whatever your bot needs
- Open the generated URL and invite it

### 3. Configure Environment

```bash
cp .env.example .env
```

Fill in `.env`:
- `BOT_TOKEN` — from the Bot page
- `CLIENT_ID` — your Application ID (General Information)
- `GUILD_ID` — right-click your server → Copy Server ID

### 4. Install & Run

```bash
npm install

# Register slash commands (run once, or after adding new commands)
npm run deploy

# Start the bot
npm start

# Dev mode with auto-reload (Node 18+)
npm run dev
```

## Adding a New Command

1. Create a folder under `src/commands/` (e.g. `src/commands/fun/`)
2. Add a `.js` file:

```js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hello')
    .setDescription('Says hello'),

  cooldown: 5, // optional, seconds

  async execute(interaction) {
    await interaction.reply('Hello! 👋');
  },
};
```

3. Run `npm run deploy` to register it with Discord.

## Adding a New Event

Create a `.js` file in `src/events/`:

```js
module.exports = {
  name: 'guildMemberAdd',
  execute(member) {
    console.log(`${member.user.tag} joined!`);
  },
};
```

The loader in `index.js` picks it up automatically.
