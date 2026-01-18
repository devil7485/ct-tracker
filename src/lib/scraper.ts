import { chromium, Browser, Page } from 'playwright';

export interface ScrapedTweet {
  tweetId: string;
  text: string;
  timestamp: number; // Unix timestamp
  username: string;
}

export class XScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize() {
    this.browser = await chromium.launch({
      headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    this.page = await this.browser.newPage();
    
    // Set realistic user agent
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
  }

  async scrapeProfile(username: string, maxTweets: number = 1000): Promise<ScrapedTweet[]> {
    if (!this.page) {
      throw new Error('Scraper not initialized. Call initialize() first.');
    }

    const cleanUsername = username.replace('@', '');
    const url = `https://twitter.com/${cleanUsername}`;
    
    console.log(`🔍 Scraping profile: ${cleanUsername}`);
    
    try {
      await this.page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await this.delay(3000);

      const tweets: ScrapedTweet[] = [];
      const seenTweetIds = new Set<string>();
      let scrollAttempts = 0;
      const maxScrollAttempts = 50;
      let noNewTweetsCount = 0;

      while (tweets.length < maxTweets && scrollAttempts < maxScrollAttempts) {
        const previousCount = tweets.length;

        // Extract tweets from current viewport
        const newTweets = await this.page.evaluate(() => {
          const articles = document.querySelectorAll('article[data-testid="tweet"]');
          const results: any[] = [];

          articles.forEach((article) => {
            try {
              // Get tweet ID from link
              const timeLink = article.querySelector('a[href*="/status/"]');
              if (!timeLink) return;
              
              const href = timeLink.getAttribute('href') || '';
              const tweetIdMatch = href.match(/\/status\/(\d+)/);
              if (!tweetIdMatch) return;
              
              const tweetId = tweetIdMatch[1];

              // Get tweet text
              const tweetTextElement = article.querySelector('[data-testid="tweetText"]');
              const text = tweetTextElement?.textContent || '';

              // Get timestamp
              const timeElement = article.querySelector('time');
              const datetime = timeElement?.getAttribute('datetime');
              let timestamp = Math.floor(Date.now() / 1000);
              
              if (datetime) {
                timestamp = Math.floor(new Date(datetime).getTime() / 1000);
              }

              // Get username from link
              const userLink = article.querySelector('a[role="link"][href^="/"]');
              const usernameMatch = userLink?.getAttribute('href')?.match(/^\/([^\/]+)/);
              const username = usernameMatch ? usernameMatch[1] : '';

              if (tweetId && text && username) {
                results.push({ tweetId, text, timestamp, username });
              }
            } catch (e) {
              // Skip malformed tweets
            }
          });

          return results;
        });

        // Add new unique tweets
        for (const tweet of newTweets) {
          if (!seenTweetIds.has(tweet.tweetId)) {
            tweets.push(tweet);
            seenTweetIds.add(tweet.tweetId);
          }
        }

        // Check if we got new tweets
        if (tweets.length === previousCount) {
          noNewTweetsCount++;
          if (noNewTweetsCount >= 3) {
            console.log('⚠️  No new tweets found after 3 scrolls, stopping...');
            break;
          }
        } else {
          noNewTweetsCount = 0;
        }

        console.log(`📊 Scraped ${tweets.length}/${maxTweets} tweets...`);

        // Scroll down
        await this.page.evaluate(() => {
          window.scrollBy(0, window.innerHeight);
        });

        await this.delay(2000);
        scrollAttempts++;
      }

      console.log(`✅ Scraped ${tweets.length} tweets from @${cleanUsername}`);
      return tweets;

    } catch (error) {
      console.error(`❌ Error scraping @${cleanUsername}:`, error);
      throw error;
    }
  }

  async scrapeSinceLastTweet(username: string, lastTweetId: string, maxTweets: number = 100): Promise<ScrapedTweet[]> {
    if (!this.page) {
      throw new Error('Scraper not initialized. Call initialize() first.');
    }

    const cleanUsername = username.replace('@', '');
    const url = `https://twitter.com/${cleanUsername}`;
    
    console.log(`🔄 Scraping new tweets from @${cleanUsername} since ${lastTweetId}`);
    
    try {
      await this.page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await this.delay(3000);

      const tweets: ScrapedTweet[] = [];
      const seenTweetIds = new Set<string>();
      let foundLastTweet = false;
      let scrollAttempts = 0;
      const maxScrollAttempts = 20;

      while (!foundLastTweet && tweets.length < maxTweets && scrollAttempts < maxScrollAttempts) {
        // Extract tweets
        const newTweets = await this.page.evaluate(() => {
          const articles = document.querySelectorAll('article[data-testid="tweet"]');
          const results: any[] = [];

          articles.forEach((article) => {
            try {
              const timeLink = article.querySelector('a[href*="/status/"]');
              if (!timeLink) return;
              
              const href = timeLink.getAttribute('href') || '';
              const tweetIdMatch = href.match(/\/status\/(\d+)/);
              if (!tweetIdMatch) return;
              
              const tweetId = tweetIdMatch[1];
              const tweetTextElement = article.querySelector('[data-testid="tweetText"]');
              const text = tweetTextElement?.textContent || '';
              const timeElement = article.querySelector('time');
              const datetime = timeElement?.getAttribute('datetime');
              let timestamp = Math.floor(Date.now() / 1000);
              
              if (datetime) {
                timestamp = Math.floor(new Date(datetime).getTime() / 1000);
              }

              const userLink = article.querySelector('a[role="link"][href^="/"]');
              const usernameMatch = userLink?.getAttribute('href')?.match(/^\/([^\/]+)/);
              const username = usernameMatch ? usernameMatch[1] : '';

              if (tweetId && text && username) {
                results.push({ tweetId, text, timestamp, username });
              }
            } catch (e) {
              // Skip
            }
          });

          return results;
        });

        for (const tweet of newTweets) {
          if (tweet.tweetId === lastTweetId) {
            foundLastTweet = true;
            break;
          }
          
          if (!seenTweetIds.has(tweet.tweetId)) {
            tweets.push(tweet);
            seenTweetIds.add(tweet.tweetId);
          }
        }

        if (foundLastTweet) break;

        await this.page.evaluate(() => {
          window.scrollBy(0, window.innerHeight);
        });

        await this.delay(2000);
        scrollAttempts++;
      }

      console.log(`✅ Scraped ${tweets.length} new tweets from @${cleanUsername}`);
      return tweets;

    } catch (error) {
      console.error(`❌ Error scraping @${cleanUsername}:`, error);
      return [];
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}
