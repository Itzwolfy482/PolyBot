const db = require('../database');
const { buildMarketEmbed } = require('../utils/marketEmbed');
const { deductCoins } = require('../utils/currency');

// Import command execute functions directly
const betCmd          = require('../commands/markets/bet');
const marketsCmd      = require('../commands/markets/markets');
const marketCmd       = require('../commands/markets/market');
const marketStatsCmd  = require('../commands/markets/market-stats');
const currentCmd      = require('../commands/markets/current');

const PREFIX = '!';

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const [rawCmd, ...args] = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const cmd = rawCmd.toLowerCase();

    // Define known commands
    const knownCommands = ['bet', 'markets', 'market', 'market-stats', 'current'];
    
    // Only process known commands - silently ignore unknown ones
    if (!knownCommands.includes(cmd)) return;

    // Build a fake interaction object that mirrors what Discord.js provides,
    // so the existing command execute() functions work without any changes.
    const fakeInteraction = buildFakeInteraction(message, args, cmd);
    if (!fakeInteraction) return;

    try {
      if (cmd === 'bet')          return await betCmd.execute(fakeInteraction, client);
      if (cmd === 'markets')      return await marketsCmd.execute(fakeInteraction, client);
      if (cmd === 'market')       return await marketCmd.execute(fakeInteraction, client);
      if (cmd === 'market-stats') return await marketStatsCmd.execute(fakeInteraction, client);
      if (cmd === 'current')      return await currentCmd.execute(fakeInteraction, client);
    } catch (err) {
      console.error(`❌ Error in !${cmd}:`, err);
      message.reply('❌ Something went wrong.');
    }
  },
};

// ─── Fake interaction builder ─────────────────────────────────────────────────
// Maps prefix command args to the same interface slash commands use,
// so command files don't need to know they're being called from a message.
function buildFakeInteraction(message, args, cmd) {
  // Parse args into a named option map based on the command
  const optionMap = parseArgs(cmd, args);
  if (!optionMap) {
    message.reply(usageFor(cmd));
    return null;
  }

  let replied = false;
  let deferred = false;

  const reply = async (data) => {
    replied = true;
    const payload = typeof data === 'string' ? { content: data } : data;
    // Strip ephemeral flags — prefix commands are always public
    delete payload.flags;
    return message.reply(payload);
  };

  // For prefix commands deferReply just sends a typing indicator
  const deferReply = async () => {
    deferred = true;
    await message.channel.sendTyping();
    return { resource: { message } };
  };

  const editReply = async (data) => {
    // After deferReply, editReply just sends a new reply for prefix commands
    const payload = typeof data === 'string' ? { content: data } : data;
    delete payload.flags;
    return message.reply(payload);
  };

  return {
    user:      message.author,
    member:    message.member,
    guildId:   message.guildId,
    channelId: message.channelId,
    client:    message.client,
    replied,
    deferred,
    reply,
    deferReply,
    editReply,
    followUp:  reply,
    options: {
      getString:  (name) => optionMap[name] ?? null,
      getInteger: (name) => {
        const val = optionMap[name];
        return val !== undefined ? parseInt(val) : null;
      },
      getUser: async (name) => {
        const val = optionMap[name];
        if (!val) return null;
        // Accept raw user ID or <@id> mention
        const id = val.replace(/[<@!>]/g, '');
        try { return await message.client.users.fetch(id); } catch { return null; }
      },
    },
  };
}

// ─── Arg parsing per command ──────────────────────────────────────────────────
function parseArgs(cmd, args) {
  if (cmd === 'bet') {
    if (args.length < 3) return null;
    return { market: args[0], outcome: args[1], amount: args[2] };
  }
  if (cmd === 'markets') {
    return {}; // no args
  }
  if (cmd === 'market') {
    if (args.length < 1) return null;
    return { id: args[0] };
  }
  if (cmd === 'market-stats') {
    return { market: args[0] ?? null }; // optional
  }
  if (cmd === 'current') {
    return {};
  }
  return null;
}

function usageFor(cmd) {
  const usages = {
    'bet':          '**Usage:** `!bet <market id> <outcome number> <amount>`',
    'market':       '**Usage:** `!market <market id>`',
    'market-stats': '**Usage:** `!market-stats` or `!market-stats <market id>`',
  };
  return usages[cmd] ?? `**Usage:** Check command syntax with \`!help\``;
}