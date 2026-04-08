const { SlashCommandBuilder } = require('discord.js');
const db = require('../../database');
const { requireMod } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bet-ban')
    .setDescription('Ban a user from placing bets')
    .setDefaultMemberPermissions(0)
    .addUserOption(o => o
      .setName('user')
      .setDescription('User to ban')
      .setRequired(true)
    ),

  async execute(interaction) {
    if (!await requireMod(interaction)) return;
    const target = interaction.options.getUser('user');
    db.banUser(interaction.guildId, target.id);
    await interaction.reply(`🚫 <@${target.id}> is now banned from betting.`);
  },
};