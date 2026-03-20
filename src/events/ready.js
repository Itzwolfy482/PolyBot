module.exports = {
  name: 'clientReady',
  once: true,
  execute(client) {
    console.log(`\n🤖 Logged in as ${client.user.tag}`);
    console.log(`📡 Serving ${client.guilds.cache.size} server(s)\n`);

    // Set a presence/status
    client.user.setPresence({
      activities: [{ name: '/help | discord.js' }],
      status: 'online',
    });
  },
};
