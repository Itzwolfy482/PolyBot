const { SlashCommandBuilder } = require('discord.js');
const db = require('../../database');
const { buildMarketEmbed } = require('../../utils/marketEmbed');
const { requireMod } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('market-create')
    .setDescription('Create a new prediction market')
    .addStringOption(o => o
      .setName('question')
      .setDescription('The question to bet on (e.g. "Will X win the tournament?")')
      .setRequired(true)
    )
    .addStringOption(o => o
      .setName('outcomes')
      .setDescription('Comma-separated outcomes (e.g. "Yes, No" or "Team A, Team B, Draw")')
      .setRequired(true)
    ),

  async execute(interaction) {

    const question    = interaction.options.getString('question');
    const rawOutcomes = interaction.options.getString('outcomes');
    const outcomes    = rawOutcomes.split(',').map(s => s.trim()).filter(Boolean);

    if (outcomes.length < 2) {
      return interaction.reply({ content: '❌ You need at least **2 outcomes**, separated by commas.', flags: 64 });
    }
    if (outcomes.length > 10) {
      return interaction.reply({ content: '❌ Maximum **10 outcomes** per market.', flags: 64 });
    }

    if (db.isUserBanned(interaction.guildId, interaction.user.id)) {
      return interaction.reply('❌ You are banned from creating markets on this server.');
    }

    const marketId = db.createMarket({
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      creatorId: interaction.user.id,
      question,
      outcomes,
    });

    const market         = db.getMarket(marketId);
    const marketOutcomes = db.getMarketOutcomes(marketId);
    const embed          = buildMarketEmbed(market, marketOutcomes);

    const { resource } = await interaction.reply({ embeds: [embed], withResponse: true });
    db.setMarketMessageId(marketId, resource.message.id);

    console.log(`📊 Market #${marketId} created by ${interaction.user.tag}`);
  },
};
