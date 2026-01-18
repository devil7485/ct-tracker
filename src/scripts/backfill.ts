import getDatabase from '../lib/db';
import { XScraper } from '../lib/scraper';
import { extractSignals } from '../lib/extractor';
import { dexscreener } from '../lib/dexscreener';

const HANDLES_TO_TRACK = [
  'yennii56',
  'rasmr_eth',
  'mrpunkdoteth',
  'finnbags',
  'dxrnell'
];

const MAX_TWEETS_PER_HANDLE = 1000;

async function backfill() {
  console.log('🚀 Starting historical backfill...\n');
  
  const db = getDatabase();
  const scraper = new XScraper();
  
  try {
    await scraper.initialize();
    console.log('✅ Scraper initialized\n');

    for (const username of HANDLES_TO_TRACK) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📱 Processing @${username}`);
      console.log('='.repeat(60));

      // Check if handle exists
      let handle = db.prepare('SELECT * FROM handles WHERE username = ?').get(username) as any;
      
      if (!handle) {
        // Create handle
        const result = db.prepare(`
          INSERT INTO handles (username, first_scraped, last_scraped)
          VALUES (?, ?, ?)
        `).run(username, Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000));
        
        handle = { id: result.lastInsertRowid, username };
        console.log(`✅ Created handle record (ID: ${handle.id})`);
      }

      // Scrape tweets
      console.log(`\n🔍 Scraping last ${MAX_TWEETS_PER_HANDLE} tweets...`);
      const tweets = await scraper.scrapeProfile(username, MAX_TWEETS_PER_HANDLE);
      
      console.log(`\n📝 Processing ${tweets.length} tweets...`);
      let newTweets = 0;
      let totalSignals = 0;

      for (const tweet of tweets) {
        // Check if tweet already exists
        const existing = db.prepare('SELECT id FROM tweets WHERE tweet_id = ?').get(tweet.tweetId);
        
        if (existing) continue;

        // Insert tweet
        const tweetResult = db.prepare(`
          INSERT INTO tweets (handle_id, tweet_id, text, timestamp)
          VALUES (?, ?, ?, ?)
        `).run(handle.id, tweet.tweetId, tweet.text, tweet.timestamp);

        newTweets++;

        // Extract signals
        const signals = extractSignals(tweet.text);
        
        for (const signal of signals) {
          if (!signal.ca) continue;

          // Insert signal
          db.prepare(`
            INSERT INTO signals (tweet_id, ca, ticker, signal_type, confidence, dex_link)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            tweetResult.lastInsertRowid,
            signal.ca,
            signal.ticker || null,
            signal.signalType,
            signal.confidence,
            signal.dexLink || null
          );

          totalSignals++;

          // Try to get token info and store it
          const tokenInfo = await dexscreener.getTokenInfo(signal.ca);
          
          if (tokenInfo) {
            db.prepare(`
              INSERT OR IGNORE INTO tokens (ca, chain, name, symbol)
              VALUES (?, 'solana', ?, ?)
            `).run(signal.ca, tokenInfo.name, tokenInfo.symbol);
          }
        }
      }

      // Update handle stats
      db.prepare(`
        UPDATE handles 
        SET total_tweets_scraped = total_tweets_scraped + ?,
            last_scraped = ?
        WHERE id = ?
      `).run(newTweets, Math.floor(Date.now() / 1000), handle.id);

      console.log(`\n✅ @${username} complete:`);
      console.log(`   📊 New tweets: ${newTweets}`);
      console.log(`   🎯 Signals extracted: ${totalSignals}`);
      console.log('');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Backfill complete!');
    console.log('='.repeat(60));

    // Summary
    const stats = db.prepare(`
      SELECT 
        COUNT(DISTINCT h.id) as total_handles,
        COUNT(DISTINCT t.id) as total_tweets,
        COUNT(DISTINCT s.id) as total_signals
      FROM handles h
      LEFT JOIN tweets t ON h.id = t.handle_id
      LEFT JOIN signals s ON t.id = s.tweet_id
    `).get() as any;

    console.log('\n📊 Database Summary:');
    console.log(`   Handles: ${stats.total_handles}`);
    console.log(`   Tweets: ${stats.total_tweets}`);
    console.log(`   Signals: ${stats.total_signals}`);
    console.log('');

  } catch (error) {
    console.error('\n❌ Backfill failed:', error);
  } finally {
    await scraper.close();
    db.close();
  }
}

// Run backfill
backfill().catch(console.error);
