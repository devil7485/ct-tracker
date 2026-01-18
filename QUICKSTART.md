# CT Signal Tracker - Quick Start Guide

## 🚀 Installation (5 minutes)

### Step 1: Extract the Archive
```bash
# Extract the project
tar -xzf ct-tracker.tar.gz
cd ct-tracker
```

### Step 2: Install Dependencies
```bash
npm install
```

This will install all dependencies including:
- Next.js 14
- Playwright (for scraping)
- better-sqlite3 (database)
- Axios, date-fns, recharts, lucide-react

### Step 3: Install Playwright Browsers
```bash
npx playwright install chromium
```

## 📊 First Run (10-15 minutes)

### 1. Initialize Database
```bash
npm run db:init
```
**Output**: Creates `./data/ct-tracker.db`

### 2. Scrape Historical Tweets
```bash
npm run backfill
```
**What it does**:
- Scrapes last ~1000 tweets from 5 handles
- Extracts Solana token CAs, tickers, DEX links
- Stores in database

**Time**: ~5-10 minutes (depends on network speed)

**Expected output**:
```
🔍 Scraping profile: yennii56
📊 Scraped 847/1000 tweets...
✅ Scraped 847 tweets from @yennii56
📝 Processing 847 tweets...
✅ @yennii56 complete:
   📊 New tweets: 847
   🎯 Signals extracted: 234
```

### 3. Track Performance
```bash
npm run track
```
**What it does**:
- Gets price at mention time (+1 minute)
- Tracks ATH, ATL, death, rug conditions
- Calculates verdicts (win rate, median ROI, etc.)

**Time**: ~5 minutes (API rate limiting)

**Expected output**:
```
📊 Found 234 new signals to track
✅ Initialized tracking for ABC...xyz at $0.00001234
📈 Updating 234 active signals...
✅ @yennii56:
   Verdict: Good
   Win Rate: 52.3%
   Median ROI: 45.2%
   Rug Rate: 8.5%
```

### 4. Start Frontend
```bash
npm run dev
```

**Visit**: http://localhost:3000

## 📅 Daily Workflow

Run these two commands daily (or set up a cron job):

```bash
# 1. Get new tweets since last run
npm run update

# 2. Update performance metrics
npm run track
```

**Total time**: ~2-3 minutes

## 🎯 What You'll See

### Homepage (Leaderboard)
- Ranked list of all tracked handles
- Win rate, median ROI, rug rate
- Verdict labels (God Tier, Excellent, Good, Average, Worst)
- Total calls tracked

### Handle Detail Pages
- Individual influencer stats
- Complete call history
- Tweet text, timestamp, CA
- Entry price, ROI, time to ATH
- Rug/death indicators

## 🔧 Configuration

### Add More Handles

Edit `src/scripts/backfill.ts` and `src/scripts/update.ts`:

```typescript
const HANDLES_TO_TRACK = [
  'yennii56',
  'rasmr_eth',
  'mrpunkdoteth',
  'finnbags',
  'dxrnell',
  'your_handle_here'  // Add more
];
```

Then run `npm run backfill` again for new handles.

### Adjust Scraping Speed

Edit `.env.local`:
```env
SCRAPE_DELAY_MS=3000  # Increase if rate limited
```

## 📖 Understanding the Data

### Verdict Tiers
- **God Tier**: 80-100% win rate
- **Excellent**: 60-80% win rate
- **Good**: 50-60% win rate
- **Average**: 30-50% win rate
- **Worst**: <30% win rate

### Death Conditions
Token marked as "dead" if:
1. Liquidity < $5,000, OR
2. Price dumps >70% from ATH in 48 hours

### Rug Detection
Token flagged as "rug" if:
- Price dumps >90% within 48 hours from mention

### ROI Calculation
- If token pumped: ROI = (ATH - mention price) / mention price
- If token never pumped: ROI = (ATL - mention price) / mention price

## 🐛 Common Issues

### "Database is locked"
- Don't run multiple scripts at once
- Wait for current operation to finish

### "Failed to scrape"
- Check internet connection
- X/Twitter may be rate limiting
- Wait 1-2 hours and try again

### "Token not found on Dexscreener"
- Some tokens aren't tracked yet
- Newly launched tokens take time to appear
- This is normal and expected

### Playwright errors
- Make sure you ran: `npx playwright install chromium`
- Check you have enough disk space

## 📊 Database Location

All data is stored in a single SQLite file:
```
./data/ct-tracker.db
```

**Backup**: Just copy this file to backup all data.

**Reset**: Delete this file and run `npm run db:init` to start fresh.

## 🎉 You're Done!

Your CT Signal Tracker is now running. The system will:
1. ✅ Preserve deleted tweets
2. ✅ Track real price performance
3. ✅ Calculate honest win rates
4. ✅ Expose influencer accountability

Run `npm run update && npm run track` daily to keep data fresh.

## 📚 Next Steps

- Read the full README.md for detailed documentation
- Explore the source code to customize behavior
- Add more handles to track
- Set up a cron job for automated daily updates

## 💡 Tips

1. **First run takes longer** - Be patient during backfill
2. **API rate limits** - Dexscreener is free but rate-limited
3. **Scraping delays** - Built-in delays prevent X/Twitter blocks
4. **Database grows** - Monitor disk space over time
5. **Performance tracking** - Run daily for accurate ATH/death detection

Happy tracking! 🚀
