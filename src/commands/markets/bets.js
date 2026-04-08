const { SlashCommandBuilder } = require('discord.js');
const db = require('../../database');
const { requireMod } = require('../../utils/permissions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bets')
        .setDescription('See someone\'s bets')
        .setDefaultMemberPermissions(0)
        .addUserOption(o => o
            .setName('user')
            .setDescription('User to check')
            .setRequired(true)
        ),
    async execute(interaction){
        if (!await requireMod(interaction)) return;
        await interaction.deferReply({ flags: 64 });
        let reply = "";
        const allBets = db.marketsWhereUserBet(interaction.user.id);
        for(let i =0;i < allBets.length; i++){
            reply += "Market : " + allBets[i].market_id;
            reply += " | Amount : " + allBets[i].amount + " | Status: "+ (db.getMarket(allBets[i].market_id)).status + "\n";
        }
        const l = reply.length;
        if(l >= 1024){
            let r= "";
            for(let i = allBets.length - 15 ;i < allBets.length; i++){
                r += "Market : " + allBets[i].market_id;
                r += " | Amount : " + allBets[i].amount + " | Status: "+ (db.getMarket(allBets[i].market_id)).status + "\n";
            }
            return interaction.editReply(r);
        }
        return interaction.editReply(reply);
    },
};