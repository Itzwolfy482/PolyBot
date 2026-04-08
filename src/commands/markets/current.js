const { SlashCommandBuilder } = require('discord.js');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('current')
    .setDescription('See all your current bets'),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const ID = interaction.user.id;
    const amount = db.getTotalBetByUserActive(interaction.guildId, ID);
    const amountMarkets = db.getTotalNumberOfBetsActive(interaction.guildId, ID);
    return interaction.editReply(('You currently have '+amountMarkets+' bets, valued at '+ amount + ' 🪙 on PolyBot\'s markets.'));
  },
};