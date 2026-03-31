const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('market-stats')
    .setDescription('Show statistics for a market or the whole server')
    .addIntegerOption(o => o
      .setName('market')
      .setDescription('Market ID for per-market stats (leave empty for server-wide stats)')
      .setMinValue(1)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const marketId = interaction.options.getInteger('market');

    if (marketId) {
      await replyMarketStats(interaction, marketId);
    } else {
      await replyServerStats(interaction);
    }
  },
};

// ─── Per-market stats ────────────────────────────────────────────────────────
async function replyMarketStats(interaction, marketId) {
  const market = db.getMarket(marketId);
  if (!market || market.guild_id !== interaction.guildId) {
    return interaction.editReply('❌ Market not found.');
  }

  const outcomes    = db.getMarketOutcomes(marketId);
  const allBets     = db.getMarketBets(marketId);
  const totalPool   = db.getTotalBetOnMarket(marketId);
  const totalBettors = new Set(allBets.map(b => b.user_id)).size;

  // Biggest bet
  const biggest = allBets.reduce((max, b) => b.amount > (max?.amount ?? 0) ? b : max, null);

  // Per-outcome breakdown
  const outcomeLines = outcomes.map((o, i) => {
    const betsOnThis = allBets.filter(b => b.outcome_id === o.id);
    const total      = betsOnThis.reduce((s, b) => s + b.amount, 0);
    const pct        = totalPool > 0 ? ((total / totalPool) * 100).toFixed(1) : '0.0';
    const avgBet     = betsOnThis.length > 0 ? Math.round(total / betsOnThis.length) : 0;
    const odds       = totalPool > 0 && total > 0 ? (totalPool / total).toFixed(2) : '—';

    const isWinner = market.winning_outcome === o.label;
    const tag = market.status === 'resolved' ? (isWinner ? ' 🏆' : ' ❌') : '';

    return `**${i + 1}. ${o.label}${tag}**\n> 👥 ${betsOnThis.length} bettors · 🪙 ${total.toLocaleString()} · avg 🪙 ${avgBet.toLocaleString()} · odds ×${odds} · ${pct}% of pool`;
  });

  // Bet distribution (how spread out are bets)
  const avgBet     = totalBettors > 0 ? Math.round(totalPool / totalBettors) : 0;
  const maxBet     = allBets.length > 0 ? Math.max(...allBets.map(b => b.amount)) : 0;
  const minBet     = allBets.length > 0 ? Math.min(...allBets.map(b => b.amount)) : 0;

  const STATUS_EMOJI = { open: '🟢', closed: '🔴', resolved: '✅', cancelled: '❌' };

  const embed = new EmbedBuilder()
    .setTitle(`📊 Stats — Market #${marketId}`)
    .setDescription(`${STATUS_EMOJI[market.status]} **${market.question}**`)
    .addFields(
      { name: 'Outcome Breakdown', value: outcomeLines.join('\n\n') || 'No bets yet.' },
      { name: '👥 Total Bettors',  value: `${totalBettors}`,                  inline: true },
      { name: '💰 Total Pool',     value: `🪙 ${totalPool.toLocaleString()}`, inline: true },
      { name: '📈 Avg Bet',        value: `🪙 ${avgBet.toLocaleString()}`,    inline: true },
      { name: '⬆️ Biggest Bet',    value: biggest ? `🪙 ${biggest.amount.toLocaleString()} by <@${biggest.user_id}>` : '—', inline: true },
      { name: '⬇️ Smallest Bet',   value: allBets.length > 0 ? `🪙 ${minBet.toLocaleString()}` : '—', inline: true },
      { name: '📊 Range',          value: allBets.length > 0 ? `🪙 ${minBet.toLocaleString()} – 🪙 ${maxBet.toLocaleString()}` : '—', inline: true },
    )
    .setColor(0x5865f2)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// ─── Server-wide stats ───────────────────────────────────────────────────────
async function replyServerStats(interaction) {
  const allMarkets = db.all(`SELECT * FROM markets WHERE guild_id = ?`, [interaction.guildId]);
  const allBets    = db.all(`
    SELECT b.* FROM bets b
    JOIN markets m ON b.market_id = m.id
    WHERE m.guild_id = ?
  `, [interaction.guildId]);

  const openCount     = allMarkets.filter(m => m.status === 'open').length;
  const closedCount   = allMarkets.filter(m => m.status === 'closed').length;
  const resolvedCount = allMarkets.filter(m => m.status === 'resolved').length;
  const cancelledCount = allMarkets.filter(m => m.status === 'cancelled').length;

  const totalPool     = allBets.reduce((s, b) => s + b.amount, 0);
  const uniqueBettors = new Set(allBets.map(b => b.user_id)).size;
  const avgBet        = allBets.length > 0 ? Math.round(totalPool / allBets.length) : 0;

  // Most active bettor
  const betsByUser = {};
  for (const bet of allBets) {
    betsByUser[bet.user_id] = (betsByUser[bet.user_id] || 0) + 1;
  }
  const topBettorId    = Object.entries(betsByUser).sort((a, b) => b[1] - a[1])[0];
  const topBettorLine  = topBettorId ? `<@${topBettorId[0]}> (${topBettorId[1]} bets)` : '—';

  // Biggest single bet ever
  const biggestBet = allBets.reduce((max, b) => b.amount > (max?.amount ?? 0) ? b : max, null);

  // Most bet-on market
  const betsByMarket = {};
  for (const bet of allBets) {
    betsByMarket[bet.market_id] = (betsByMarket[bet.market_id] || 0) + bet.amount;
  }
  const topMarketEntry = Object.entries(betsByMarket).sort((a, b) => b[1] - a[1])[0];
  const topMarket      = topMarketEntry ? db.getMarket(Number(topMarketEntry[0])) : null;
  const topMarketLine  = topMarket ? `#${topMarket.id} — ${topMarket.question} (🪙 ${Number(topMarketEntry[1]).toLocaleString()})` : '—';

  const embed = new EmbedBuilder()
    .setTitle('📊 Server-wide Betting Stats')
    .addFields(
      { name: '📋 Markets',         value: `🟢 ${openCount} open · 🔴 ${closedCount} closed · ✅ ${resolvedCount} resolved · ❌ ${cancelledCount} cancelled`, },
      { name: '🎲 Total Bets',      value: `${allBets.length}`,                   inline: true },
      { name: '👥 Unique Bettors',  value: `${uniqueBettors}`,                    inline: true },
      { name: '💰 All-time Pool',   value: `🪙 ${totalPool.toLocaleString()}`,    inline: true },
      { name: '📈 Avg Bet',         value: `🪙 ${avgBet.toLocaleString()}`,       inline: true },
      { name: '🏆 Most Active',     value: topBettorLine,                          inline: true },
      { name: '💸 Biggest Bet',     value: biggestBet ? `🪙 ${biggestBet.amount.toLocaleString()} by <@${biggestBet.user_id}>` : '—', inline: true },
      { name: '🔥 Hottest Market',  value: topMarketLine },
    )
    .setColor(0x5865f2)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
