const { Collection, EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    // ─── Cooldown check ──────────────────────────────────────────────────────
    const { cooldowns } = client;
    if (!cooldowns.has(command.data.name)) {
      cooldowns.set(command.data.name, new Collection());
    }

    const now = Date.now();
    const timestamps = cooldowns.get(command.data.name);
    const cooldownAmount = (command.cooldown ?? 3) * 1000;

    if (timestamps.has(interaction.user.id)) {
      const expiresAt = timestamps.get(interaction.user.id) + cooldownAmount;
      if (now < expiresAt) {
        const remaining = ((expiresAt - now) / 1000).toFixed(1);
        return interaction.reply({
          content: `⏳ Please wait **${remaining}s** before using \`/${command.data.name}\` again.`,
          flags: 64,
        });
      }
    }

    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

    // ─── Execute command ─────────────────────────────────────────────────────
    try {
      await command.execute(interaction, client);
    } catch (error) {
      console.error(`❌ Error in /${command.data.name}:`, error);

      const errorEmbed = new EmbedBuilder()
        .setColor(0xff4444)
        .setDescription('❌ Something went wrong while running that command.');

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [errorEmbed], flags: 64 });
      } else {
        await interaction.reply({ embeds: [errorEmbed], flags: 64 });
      }
    }
  },
};
