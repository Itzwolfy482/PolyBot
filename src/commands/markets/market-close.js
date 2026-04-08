const { SlashCommandBuilder } = require('discord.js');
const db = require('../../database');
const { buildMarketEmbed } = require('../../utils/marketEmbed');
const { requireMod } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('market-close')
    .setDescription('Stop accepting new bets on a market')
    .setDefaultMemberPermissions(0)
    .addIntegerOption(o => o
      .setName('market')
      .setDescription('Market ID to close')
      .setRequired(true)
      .setMinValue(1)
    ),

  async execute(interaction) {
    if (!await requireMod(interaction)) return;

    const marketId = interaction.options.getInteger('market');
    const market   = db.getMarket(marketId);

    if (!market || market.guild_id !== interaction.guildId) {
      return interaction.reply({ content: '❌ Market not found.', flags: 64 });
    }
    if (market.status !== 'open') {
      return interaction.reply({ content: `❌ Market #${marketId} is already **${market.status}**.`, flags: 64 });
    }

    db.closeMarket(marketId);

    const outcomes      = db.getMarketOutcomes(marketId);
    const updatedMarket = db.getMarket(marketId);
    const embed         = buildMarketEmbed(updatedMarket, outcomes);

    if (market.message_id) {
      try {
        const channel = await interaction.client.channels.fetch(market.channel_id);
        const msg     = await channel.messages.fetch(market.message_id);
        await msg.edit({ embeds: [embed] });
      } catch { /* deleted */ }
    }

    await interaction.reply(`🔴 Market #${marketId} is now **closed** — no new bets accepted.`);
  },
};
