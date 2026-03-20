const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'polybot.db');

let db = null;

// ─── Persist to disk ────────────────────────────────────────────────────────────
function save() {
  const data = db.export();
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// ─── Initialize ─────────────────────────────────────────────────────────────────
async function init() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS markets (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id    TEXT NOT NULL,
      channel_id  TEXT NOT NULL,
      message_id  TEXT,
      creator_id  TEXT NOT NULL,
      question    TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'open',
      winning_outcome TEXT,
      created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS outcomes (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      market_id INTEGER NOT NULL REFERENCES markets(id),
      label     TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS bets (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      market_id   INTEGER NOT NULL REFERENCES markets(id),
      outcome_id  INTEGER NOT NULL REFERENCES outcomes(id),
      user_id     TEXT NOT NULL,
      amount      INTEGER NOT NULL,
      placed_at   INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      UNIQUE(market_id, user_id)
    );
  `);

  save();
  console.log('✅ Database ready');
  return db;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────
function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function get(sql, params = []) {
  return all(sql, params)[0] ?? null;
}

// run() without save — used when we need the insert ID before persisting
function runRaw(sql, params = []) {
  db.run(sql, params);
}

function run(sql, params = []) {
  db.run(sql, params);
  save();
}

// Must be called immediately after runRaw(), before any save()
function lastInsertId() {
  return db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
}

// ─── Market Operations ──────────────────────────────────────────────────────────
function createMarket({ guildId, channelId, creatorId, question, outcomes }) {
  // Use runRaw so save() doesn't reset last_insert_rowid before we read it
  runRaw(
    `INSERT INTO markets (guild_id, channel_id, creator_id, question)
     VALUES (?, ?, ?, ?)`,
    [guildId, channelId, creatorId, question]
  );

  const marketId = lastInsertId();

  for (const label of outcomes) {
    runRaw(`INSERT INTO outcomes (market_id, label) VALUES (?, ?)`, [marketId, label]);
  }

  save(); // persist everything at once
  return marketId;
}

function getMarket(marketId) {
  return get(`SELECT * FROM markets WHERE id = ?`, [marketId]);
}

function getMarketOutcomes(marketId) {
  return all(`SELECT * FROM outcomes WHERE market_id = ?`, [marketId]);
}

function getMarketBets(marketId) {
  return all(`SELECT * FROM bets WHERE market_id = ?`, [marketId]);
}

function getOpenMarkets(guildId) {
  return all(`SELECT * FROM markets WHERE guild_id = ? AND status = 'open' ORDER BY created_at DESC`, [guildId]);
}

function setMarketMessageId(marketId, messageId) {
  run(`UPDATE markets SET message_id = ? WHERE id = ?`, [messageId, marketId]);
}

function closeMarket(marketId) {
  run(`UPDATE markets SET status = 'closed' WHERE id = ?`, [marketId]);
}

function resolveMarket(marketId, winningOutcome) {
  run(
    `UPDATE markets SET status = 'resolved', winning_outcome = ? WHERE id = ?`,
    [winningOutcome, marketId]
  );
}

function cancelMarket(marketId) {
  run(`UPDATE markets SET status = 'cancelled' WHERE id = ?`, [marketId]);
}

// ─── Bet Operations ─────────────────────────────────────────────────────────────
function placeBet({ marketId, outcomeId, userId, amount }) {
  run(
    `INSERT INTO bets (market_id, outcome_id, user_id, amount) VALUES (?, ?, ?, ?)`,
    [marketId, outcomeId, userId, amount]
  );
}

function getUserBet(marketId, userId) {
  return get(`SELECT * FROM bets WHERE market_id = ? AND user_id = ?`, [marketId, userId]);
}

function getTotalBetOnOutcome(outcomeId) {
  const row = get(`SELECT SUM(amount) as total FROM bets WHERE outcome_id = ?`, [outcomeId]);
  return row?.total ?? 0;
}

function getTotalBetOnMarket(marketId) {
  const row = get(`SELECT SUM(amount) as total FROM bets WHERE market_id = ?`, [marketId]);
  return row?.total ?? 0;
}

module.exports = {
  init, save,
  all, get, run,
  createMarket, getMarket, getMarketOutcomes, getMarketBets, getOpenMarkets,
  setMarketMessageId, closeMarket, resolveMarket, cancelMarket,
  placeBet, getUserBet, getTotalBetOnOutcome, getTotalBetOnMarket,
};
