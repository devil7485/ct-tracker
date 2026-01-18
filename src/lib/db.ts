import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DATABASE_PATH || './data/ct-tracker.db';

export function getDatabase() {
  // Ensure data directory exists
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  
  return db;
}

export function initializeDatabase() {
  const db = getDatabase();

  // Handles table
  db.exec(`
    CREATE TABLE IF NOT EXISTS handles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT,
      first_scraped INTEGER,
      last_scraped INTEGER,
      total_tweets_scraped INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
    CREATE INDEX IF NOT EXISTS idx_handles_username ON handles(username);
  `);

  // Tweets table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tweets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      handle_id INTEGER NOT NULL,
      tweet_id TEXT UNIQUE NOT NULL,
      text TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      scraped_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (handle_id) REFERENCES handles(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_tweets_handle ON tweets(handle_id);
    CREATE INDEX IF NOT EXISTS idx_tweets_timestamp ON tweets(timestamp);
    CREATE INDEX IF NOT EXISTS idx_tweets_tweet_id ON tweets(tweet_id);
  `);

  // Signals table
  db.exec(`
    CREATE TABLE IF NOT EXISTS signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tweet_id INTEGER NOT NULL,
      ca TEXT NOT NULL,
      ticker TEXT,
      signal_type TEXT NOT NULL,
      confidence TEXT NOT NULL,
      dex_link TEXT,
      extracted_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (tweet_id) REFERENCES tweets(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_signals_tweet ON signals(tweet_id);
    CREATE INDEX IF NOT EXISTS idx_signals_ca ON signals(ca);
  `);

  // Tokens table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ca TEXT UNIQUE NOT NULL,
      chain TEXT DEFAULT 'solana',
      name TEXT,
      symbol TEXT,
      first_seen INTEGER DEFAULT (strftime('%s', 'now'))
    );
    CREATE INDEX IF NOT EXISTS idx_tokens_ca ON tokens(ca);
  `);

  // Price snapshots table
  db.exec(`
    CREATE TABLE IF NOT EXISTS price_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      signal_id INTEGER NOT NULL,
      price REAL,
      market_cap REAL,
      liquidity REAL,
      volume_24h REAL,
      timestamp INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      FOREIGN KEY (signal_id) REFERENCES signals(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_snapshots_signal ON price_snapshots(signal_id);
    CREATE INDEX IF NOT EXISTS idx_snapshots_event ON price_snapshots(event_type);
  `);

  // Performance windows table
  db.exec(`
    CREATE TABLE IF NOT EXISTS performance_windows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      signal_id INTEGER UNIQUE NOT NULL,
      mention_price REAL,
      mention_market_cap REAL,
      mention_liquidity REAL,
      ath_price REAL,
      ath_timestamp INTEGER,
      ath_roi REAL,
      atl_price REAL,
      atl_timestamp INTEGER,
      atl_roi REAL,
      current_price REAL,
      current_roi REAL,
      is_dead INTEGER DEFAULT 0,
      death_timestamp INTEGER,
      death_reason TEXT,
      is_rug INTEGER DEFAULT 0,
      rug_timestamp INTEGER,
      lifecycle_complete INTEGER DEFAULT 0,
      last_updated INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (signal_id) REFERENCES signals(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_performance_signal ON performance_windows(signal_id);
    CREATE INDEX IF NOT EXISTS idx_performance_complete ON performance_windows(lifecycle_complete);
  `);

  // Handle verdicts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS handle_verdicts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      handle_id INTEGER UNIQUE NOT NULL,
      total_calls INTEGER DEFAULT 0,
      completed_calls INTEGER DEFAULT 0,
      win_rate REAL DEFAULT 0,
      median_roi REAL DEFAULT 0,
      avg_roi REAL DEFAULT 0,
      avg_time_to_ath INTEGER,
      avg_time_to_death INTEGER,
      rug_rate REAL DEFAULT 0,
      death_rate REAL DEFAULT 0,
      avg_mention_market_cap REAL,
      verdict_label TEXT,
      last_calculated INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (handle_id) REFERENCES handles(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_verdicts_handle ON handle_verdicts(handle_id);
  `);

  console.log('✅ Database initialized successfully');
  db.close();
}

export default getDatabase;
