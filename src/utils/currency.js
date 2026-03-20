const { Client } = require('unb-api');

const client = new Client(process.env.UNB_API_TOKEN);

/**
 * Get a user's current cash balance.
 * Returns the cash amount, or throws on API error.
 */
async function getBalance(guildId, userId) {
  const data = await client.getUserBalance(guildId, userId);
  return data.cash ?? 0;
}

/**
 * Deduct coins from a user's cash balance.
 * Throws if they don't have enough funds.
 */
async function deductCoins(guildId, userId, amount) {
  const balance = await getBalance(guildId, userId);

  if (balance < amount) {
    const err = new Error('INSUFFICIENT_FUNDS');
    err.balance = balance;
    err.required = amount;
    throw err;
  }

  await client.setUserBalance(guildId, userId, { cash: balance - amount });
  return balance - amount;
}

/**
 * Add coins to a user's cash balance.
 */
async function addCoins(guildId, userId, amount) {
  const balance = await getBalance(guildId, userId);
  await client.setUserBalance(guildId, userId, { cash: balance + amount });
  return balance + amount;
}

module.exports = { getBalance, deductCoins, addCoins };
