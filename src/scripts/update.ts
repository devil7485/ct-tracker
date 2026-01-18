import getDatabase from '../lib/db';
import { XScraper } from '../lib/scraper';
import { extractSignals } from '../lib/extractor';
import { dexscreener } from '../lib/dexscreener';

async function update() {
  console.log('🔄 Starting incremental update...\n');
  
  const db = getDatabase();
  const scraper = new XScraper();
  
  try {
    await scraper.initialize();
    console.log('✅ Scraper initialized\n');

    const handles = db.prepare('SELECT * FROM handles WHERE status = ?').all('active') as any[];

    for (const handle of handles) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🔄 Updating @${handle.username}`);
      console.log('='.repeat(60));

      // Get the most recent tweet for this handle
      const lastTweet = db.prepare(`
        SELECT tweet_id FROM tweets 
        WHERE handle_id = ? 
        ORDER BY timestamp DESC 
        LIMIT 1
      `).get(handle.id) as any;

      let tweets;
      
      if (lastTweet) {
        // Scrape only new tweets since last known tweet
        console.log(`📡 Fetching tweets since ${lastTweet.tweet_id}...`);
        tweets = await scraper.scrapeSinceLastTweet(handle.username, lastTweet.tweet_id, 100);
      } else {
        // No tweets yet, do full scrape
        console.log('📡 No previous tweets, doing full scrape...');
        tweets = await scraper.scrapeProfile(handle.username, 1000);
      }

      if (tweets.length === 0) {
        console.log('✅ No new tweets found');
        continue;
      }

      console.log(`\n📝 Processing ${tweets.length} new tweets...`);
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

          // Try to get token info
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

      console.log(`\n✅ @${handle.username} complete:`);
      console.log(`   📊 New tweets: ${newTweets}`);
      console.log(`   🎯 Signals extracted: ${totalSignals}`);
      console.log('');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Update complete!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Update failed:', error);
  } finally {
    await scraper.close();
    db.close();
  }
}

// Run update
update().catch(console.error);
