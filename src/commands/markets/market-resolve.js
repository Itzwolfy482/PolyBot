const { SlashCommandBuilder } = require('discord.js');
const db = require('../../database');
const { buildMarketEmbed } = require('../../utils/marketEmbed');
const { addCoins } = require('../../utils/currency');
const { requireMod } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('market-resolve')
    .setDescription('Resolve a market and pay out winners')
    .setDefaultMemberPermissions(0)
    .addIntegerOption(o => o
      .setName('market')
      .setDescription('Market ID to resolve')
      .setRequired(true)
      .setMinValue(1)
    )
    .addIntegerOption(o => o
      .setName('outcome')
      .setDescription('Winning outcome position (1 = first, 2 = second, etc.)')
      .setRequired(true)
      .setMinValue(1)
    ),

  async execute(interaction) {
    if (!await requireMod(interaction)) return;

    await interaction.deferReply();

    const marketId   = interaction.options.getInteger('market');
    const outcomePos = interaction.options.getInteger('outcome');

    const market = db.getMarket(marketId);
    if (!market || market.guild_id !== interaction.guildId) {
      return interaction.editReply('❌ Market not found.');
    }
    if (market.status === 'resolved')  return interaction.editReply(`❌ Market #${marketId} is already resolved.`);
    if (market.status === 'cancelled') return interaction.editReply(`❌ Market #${marketId} was cancelled.`);

    const outcomes       = db.getMarketOutcomes(marketId);
    const winningOutcome = outcomes[outcomePos - 1];

    if (!winningOutcome) {
      const valid = outcomes.map((o, i) => `**${i + 1}** — ${o.label}`).join('\n');
      return interaction.editReply(`❌ Invalid outcome number. This market has ${outcomes.length} outcomes:\n${valid}`);
    }

    const totalPool    = db.getTotalBetOnMarket(marketId);
    const winningTotal = db.getTotalBetOnOutcome(winningOutcome.id);
    const allBets      = db.getMarketBets(marketId);
    const winningBets  = allBets.filter(b => b.outcome_id === winningOutcome.id);

    db.resolveMarket(marketId, winningOutcome.label);

    const payouts = [];
    const errors  = [];

    for (const bet of winningBets) {
      const share    = bet.amount / winningTotal;
      const winnings = Math.floor(share * totalPool);
      try {
        await addCoins(interaction.guildId, bet.user_id, winnings);
        payouts.push({ userId: bet.user_id, bet: bet.amount, winnings });
      } catch (err) {
        console.error(`Failed to pay out user ${bet.user_id}:`, err);
        errors.push({ userId: bet.user_id, winnings });
      }
    }

    const resolvedMarket = db.getMarket(marketId);
    const embed          = buildMarketEmbed(resolvedMarket, outcomes);

    if (market.message_id) {
      try {
        const channel = await interaction.client.channels.fetch(market.channel_id);
        const msg     = await channel.messages.fetch(market.message_id);
        await msg.edit({ embeds: [embed] });
      } catch { /* deleted */ }
    }

    const payoutLines = payouts.length > 0
      ? payouts.map(p => `<@${p.userId}> bet 🪙 ${p.bet.toLocaleString()} → **won 🪙 ${p.winnings.toLocaleString()}** ✅`).join('\n')
      : '_No bets on the winning outcome._';

    const errorLines = errors.length > 0
      ? `\n\n⚠️ **Failed to pay (manual action needed):**\n` +
        errors.map(e => `<@${e.userId}> — 🪙 ${e.winnings.toLocaleString()}`).join('\n')
      : '';

    await interaction.editReply([
      `## ✅ Market #${marketId} Resolved`,
      `**Question:** ${market.question}`,
      `**Winner:** 🏆 ${winningOutcome.label}`,
      `**Total Pool:** 🪙 ${totalPool.toLocaleString()}`,
      '',
      '**Payouts:**',
      payoutLines,
      errorLines,
    ].join('\n'));
  },
};
