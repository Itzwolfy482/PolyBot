const { SlashCommandBuilder } = require('discord.js');
const db = require('../../database');
const { requireMod } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bet-unban')
    .setDescription('Unban a user from placing bets')
    .addUserOption(o => o
      .setName('user')
      .setDescription('User to unban')
      .setRequired(true)
    ),

  async execute(interaction) {
    if (!await requireMod(interaction)) return;

    const target = interaction.options.getUser('user');
    db.unbanUser(interaction.guildId, target.id);
    await interaction.reply(`✅ <@${target.id}> can now place bets again.`);
  },
};