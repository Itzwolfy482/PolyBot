const { SlashCommandBuilder } = require('discord.js');
const db = require('../../database');
const { buildMarketEmbed } = require('../../utils/marketEmbed');
const { deductCoins, addCoins } = require('../../utils/currency');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bet')
    .setDescription('Place a bet on an open market')
    .addIntegerOption(o => o
      .setName('market')
      .setDescription('Market ID (use /markets to see open markets)')
      .setRequired(true)
      .setMinValue(1)
    )
    .addIntegerOption(o => o
      .setName('outcome')
      .setDescription('Outcome position (1 = first outcome, 2 = second, etc.)')
      .setRequired(true)
      .setMinValue(1)
    )
    .addIntegerOption(o => o
      .setName('amount')
      .setDescription('Amount of coins to bet')
      .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const marketId   = interaction.options.getInteger('market');
    const outcomePos = interaction.options.getInteger('outcome');
    const amount = interaction.options.getInteger('amount');

    if (amount === 0) {
      return interaction.editReply('❌ Amount must be different from 0.');
    }

    // ─── Validate market ──────────────────────────────────────────────────────
    const market = db.getMarket(marketId);
    if (!market) {
      return interaction.editReply(`❌ Market #${marketId} does not exist.`);
    }
    if (market.guild_id !== interaction.guildId) {
      return interaction.editReply(`❌ That market is not from this server.`);
    }
    if (market.status !== 'open') {
      return interaction.editReply(`❌ Market #${marketId} is **${market.status}** — betting is closed.`);
    }

    // ─── Validate outcome by position ─────────────────────────────────────────
    const outcomes = db.getMarketOutcomes(marketId);
    const outcome  = outcomes[outcomePos - 1];
    if (!outcome) {
      const valid = outcomes.map((o, i) => `**${i + 1}** — ${o.label}`).join('\n');
      return interaction.editReply(`❌ Invalid outcome number. This market has ${outcomes.length} outcomes:\n${valid}`);
    }

    // ─── Validate/update existing bet on this outcome ────────────────────────
    const existing = db.getUserBet(marketId, interaction.user.id, outcome.id);
    const newAmount = (existing?.amount ?? 0) + amount;
    if (newAmount < 0) {
      return interaction.editReply(
        `❌ You only have **🪙 ${(existing?.amount ?? 0).toLocaleString()}** on **${outcome.label}** in this market.`
      );
    }

    // ─── Adjust coins immediately ─────────────────────────────────────────────
    try {
      if (amount > 0) {
        await deductCoins(interaction.guildId, interaction.user.id, amount);
      } else {
        await addCoins(interaction.guildId, interaction.user.id, Math.abs(amount));
      }
    } catch (err) {
      if (amount > 0 && err.message === 'INSUFFICIENT_FUNDS') {
        return interaction.editReply(
          `❌ You don't have enough coins. You need **🪙 ${amount.toLocaleString()}** but only have **🪙 ${err.balance.toLocaleString()}**.`
        );
      }
      console.error('Currency API error on bet placement:', err);
      return interaction.editReply('❌ Could not reach the currency API. Please try again later.');
    }

    // ─── Save bet ─────────────────────────────────────────────────────────────
    db.placeBet({
      marketId,
      outcomeId: outcome.id,
      userId: interaction.user.id,
      amount,
    });

    // ─── Refresh the market embed ─────────────────────────────────────────────
    const updatedMarket = db.getMarket(marketId);
    const embed = buildMarketEmbed(updatedMarket, outcomes);
    if (market.message_id) {
      try {
        const channel = await interaction.client.channels.fetch(market.channel_id);
        const msg = await channel.messages.fetch(market.message_id);
        await msg.edit({ embeds: [embed] });
      } catch { /* original message deleted */ }
    }

    await interaction.editReply(
      newAmount === 0
        ? `✅ Bet removed. You now have no coins on **${outcome.label}** in Market #${marketId}.`
        : `✅ Bet updated! Your total on **${outcome.label}** in Market #${marketId} is now **🪙 ${newAmount.toLocaleString()}**.`
    );
  },
};
