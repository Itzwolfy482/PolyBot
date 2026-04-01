const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database');

const PAGE_SIZE = 5; // markets per page

module.exports = {
  data: new SlashCommandBuilder()
    .setName('markets')
    .setDescription('List all active prediction markets (open and closed)'),

  async execute(interaction) {
    const allMarkets = db.all(
      `SELECT * FROM markets WHERE guild_id = ? AND status IN ('open', 'closed') ORDER BY status ASC, created_at DESC`,
      [interaction.guildId]
    );

    if (allMarkets.length === 0) {
      return interaction.reply({ content: '📭 No active markets right now. You can create one with `/market-create`.', flags: 64 });
    }

    const pages = buildPages(allMarkets);
    let page = 0;

    const { embed, row } = buildMessage(pages, page);
    const reply = await interaction.reply({ embeds: [embed], components: row ? [row] : [], withResponse: true });
    const msg = reply.resource.message;

    if (pages.length === 1) return;

    const collector = msg.createMessageComponentCollector({ time: 120_000 });

    collector.on('collect', async btn => {
      if (btn.user.id !== interaction.user.id) {
        return btn.reply({ content: '❌ These buttons are not for you.', flags: 64 });
      }

      if (btn.customId === 'prev') page = Math.max(0, page - 1);
      if (btn.customId === 'next') page = Math.min(pages.length - 1, page + 1);

      const { embed, row } = buildMessage(pages, page);
      await btn.update({ embeds: [embed], components: row ? [row] : [] });
    });

    collector.on('end', async () => {
      try {
        const { embed } = buildMessage(pages, page);
        await msg.edit({ embeds: [embed], components: [] });
      } catch { /* message deleted */ }
    });
  },
};

function buildPages(markets) {
  const pages = [];
  for (let i = 0; i < markets.length; i += PAGE_SIZE) {
    pages.push(markets.slice(i, i + PAGE_SIZE));
  }
  return pages;
}

function buildMessage(pages, page) {
  const markets = pages[page];

  const lines = markets.map(m => {
    const pool     = db.getTotalBetOnMarket(m.id);
    const outcomes = db.getMarketOutcomes(m.id);
    const status   = m.status === 'open' ? '🟢' : '🔴';
    const outcomeList = outcomes.map((o, i) => `${i + 1}. ${o.label}`).join(' · ');
    return `${status} **#${m.id} — ${m.question}**\n> ${outcomeList}\n> 🪙 ${pool.toLocaleString()} in pool`;
  });

  const embed = new EmbedBuilder()
    .setTitle('📊 Prediction Markets')
    .setDescription(lines.join('\n\n'))
    .setColor(0x5865f2)
    .setFooter({ text: `Page ${page + 1}/${pages.length} · /bet <id> <outcome> <amount> · /market <id> for full odds` })
    .setTimestamp();

  if (pages.length === 1) return { embed, row: null };

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('prev')
      .setLabel('◀ Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId('next')
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === pages.length - 1),
  );

  return { embed, row };
}
