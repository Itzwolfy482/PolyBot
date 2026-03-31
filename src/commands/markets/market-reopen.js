// Ecrit par un humain

const { SlashCommandBuilder } = require('discord.js');
const db = require('../../database');
const { buildMarketEmbed } = require('../../utils/marketEmbed');
const { requireMod } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('market-reopen')
    .setDescription('Reopen a closed a prediction market')
    .addIntegerOption(o => o
      .setName('market')
      .setDescription('Market ID")')
      .setRequired(true)
    ),

  async execute(interaction) {
    if (!await requireMod(interaction)) return;

    const marketId    = interaction.options.getInteger('market');
    const market = db.getMarket(marketId);

    if (!market || market.guild_id !== interaction.guildId) {
      return interaction.reply({ content: '❌ Market not found.', flags: 64 });
    }
    if (market.status !== 'closed') {
      return interaction.reply({ content: `❌ Market #${marketId} is **${market.status}** — only closed markets can be reopened.`, flags: 64 });
    }
    db.reopenMarket(marketId)
    console.log(`📊 Market #${marketId} was reopened by ${interaction.user.tag}`);
    await interaction.reply(`🟢 Market #${marketId} is now **open** again — bets are accepted.`);
  },
};