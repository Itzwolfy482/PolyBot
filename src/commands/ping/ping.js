const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot latency'),

  cooldown: 5, // seconds

  async execute(interaction, client) {
    const { resource: pingResource } = await interaction.deferReply({ withResponse: true });

    const apiLatency = Math.round(client.ws.ping);
    const botLatency = pingResource.message.createdTimestamp - interaction.createdTimestamp;

    const latencyColor =
      apiLatency < 100 ? 0x57f287   // green
      : apiLatency < 200 ? 0xfee75c // yellow
      : 0xff4444;                    // red

    const embed = new EmbedBuilder()
      .setColor(latencyColor)
      .setTitle('🏓 Pong!')
      .addFields(
        { name: 'Bot Latency',  value: `\`${botLatency}ms\``,  inline: true },
        { name: 'API Latency',  value: `\`${apiLatency}ms\``,  inline: true },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
