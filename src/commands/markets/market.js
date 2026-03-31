const { SlashCommandBuilder } = require('discord.js');
const db = require('../../database');
const { buildMarketEmbed } = require('../../utils/marketEmbed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('market')
    .setDescription('View details and current odds for a market')
    .addIntegerOption(o => o
      .setName('id')
      .setDescription('Market ID')
      .setRequired(true)
      .setMinValue(1)
    ),

  async execute(interaction) {
    const marketId = interaction.options.getInteger('id');
    const market = db.getMarket(marketId);

    if (!market || market.guild_id !== interaction.guildId) {
      return interaction.reply({ content: `❌ Market #${marketId} not found.`, flags: 64 });
    }

    const outcomes = db.getMarketOutcomes(marketId);
    const userBets = db.getUserBet(marketId, interaction.user.id);
    const embed = buildMarketEmbed(market, outcomes);

    let content = '';
    if (userBets && userBets.length > 0) {
      const lines = userBets.map(b => {
        const betOutcome = outcomes.find(o => o.id === b.outcome_id);
        return `> 🎯 You bet **🪙 ${b.amount.toLocaleString()}** on **${betOutcome?.label}**`;
      });
      content = lines.join('\n');
    }

    await interaction.reply({ content: content || undefined, embeds: [embed] });
  },
};
