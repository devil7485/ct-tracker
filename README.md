# CT Signal Tracker

A comprehensive system for tracking crypto Twitter influencers and analyzing their token call performance with real market data.

## Features

- 🔍 **Tweet Scraping**: Playwright-based scraping of X/Twitter profiles (last 1000 tweets + real-time updates)
- 🎯 **Signal Extraction**: Automatic detection of Solana token CAs, tickers, and DEX links
- 📊 **Performance Tracking**: Real-time price tracking with ATH, death detection, and rug detection
- 🏆 **Verdict Engine**: Automated rating system based on win rate, ROI, and rug rate
- 💾 **Efficient Storage**: SQLite database with minimal tweet storage (preserves deleted tweets)
- 🎨 **Next.js Dashboard**: Beautiful leaderboard and detailed handle analytics

## Tech Stack

- **Backend**: Node.js/TypeScript, better-sqlite3
- **Scraper**: Playwright (headless browser automation)
- **Price Data**: Dexscreener API (primary), Birdeye (secondary)
- **Frontend**: Next.js 14, Tailwind CSS, React
- **Database**: SQLite (single file, ACID compliant)

## Quick Start

### 1. Installation

```bash
npm install
```

### 2. Initialize Database

```bash
npm run db:init
```

This creates the SQLite database at `./data/ct-tracker.db` with all required tables.

### 3. Run Historical Backfill

```bash
npm run backfill
```

This scrapes the last ~1000 tweets from each tracked handle and extracts signals. The default handles are:
- @yennii56
- @rasmr_eth
- @mrpunkdoteth
- @finnbags
- @dxrnell

### 4. Track Performance

```bash
npm run track
```

This:
- Initializes performance tracking for new signals (gets price at mention time + 1min)
- Updates active signals with current prices
- Detects death/rug conditions
- Calculates verdicts for all handles

Run this daily or as needed to update performance metrics.

### 5. Start Frontend

```bash
npm run dev
```

Visit `http://localhost:3000` to view the dashboard.

## Project Structure

```
ct-tracker/
├── src/
│   ├── app/                    # Next.js 14 app router
│   │   ├── api/                # API routes
│   │   │   ├── verdicts/       # Leaderboard data
│   │   │   └── handle/         # Handle details
│   │   ├── handle/[username]/  # Handle detail page
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Homepage (leaderboard)
│   │   └── globals.css         # Global styles
│   ├── lib/
│   │   ├── db.ts               # Database setup & schema
│   │   ├── scraper.ts          # Playwright X scraper
│   │   ├── extractor.ts        # Signal extraction (CA/ticker)
│   │   ├── dexscreener.ts      # Price data API client
│   │   ├── tracker.ts          # Performance tracking logic
│   │   └── verdict.ts          # Verdict calculation engine
│   └── scripts/
│       ├── init-db.ts          # Initialize database
│       ├── backfill.ts         # Historical tweet scraping
│       ├── update.ts           # Incremental updates
│       └── track-performance.ts # Performance tracking
├── data/
│   └── ct-tracker.db           # SQLite database (created on init)
├── package.json
├── tsconfig.json
├── next.config.js
└── tailwind.config.js
```

## Database Schema

### Tables

- **handles**: Tracked X usernames
- **tweets**: Scraped tweets (minimal storage)
- **signals**: Extracted token mentions (CA, ticker, DEX link)
- **tokens**: Token metadata (name, symbol, chain)
- **price_snapshots**: Historical price data points
- **performance_windows**: Aggregate performance metrics per signal
- **handle_verdicts**: Calculated verdicts per handle

## Performance Tracking Logic

### Price Timing
- Initial price captured at `mention_time + 1 minute`
- This prevents pump-after-post inflation

### ROI Calculation
- **If ATH > mention price**: ROI = (ATH - mention) / mention × 100%
- **If no pump**: ROI = (ATL - mention) / mention × 100%

### Death Detection
A token is marked as "dead" if either:
1. Liquidity drops below $5,000
2. Price dumps >70% from ATH within 48 hours

### Rug Detection
A token is flagged as "rug" if:
- Price dumps >90% within 48 hours from mention

## Verdict Tiers

| Win Rate | Label |
|----------|-------|
| 80-100% | God Tier |
| 60-80% | Excellent |
| 50-60% | Good |
| 30-50% | Average |
| <30% | Worst |

Special labels:
- **Serial Rugger Promoter**: Rug rate >50%
- **High Risk - Many Rugs**: Rug rate >25%
- **God Tier - Ultra Early**: 80%+ win rate + avg time to ATH <1h
- **Excellent - Early Signals**: 60%+ win rate + avg time to ATH <2h

## Workflows

### Daily Workflow (Recommended)

1. **Update tweets** (get new tweets since last run):
   ```bash
   npm run update
   ```

2. **Track performance** (update prices, calculate verdicts):
   ```bash
   npm run track
   ```

3. **View results**:
   ```bash
   npm run dev
   ```

### One-Time Setup

1. Initialize database
2. Run backfill for historical data
3. Run performance tracking
4. Start frontend

## Configuration

### Environment Variables

Create a `.env.local` file:

```env
DATABASE_PATH=./data/ct-tracker.db
PLAYWRIGHT_HEADLESS=true
SCRAPE_DELAY_MS=2000
```

### Adding More Handles

Edit `src/scripts/backfill.ts` and `src/scripts/update.ts`:

```typescript
const HANDLES_TO_TRACK = [
  'yennii56',
  'rasmr_eth',
  'mrpunkdoteth',
  'finnbags',
  'dxrnell',
  'your_new_handle'  // Add here
];
```

## API Endpoints

### GET /api/verdicts
Returns all handle verdicts (leaderboard data).

### GET /api/handle/[username]
Returns detailed data for a specific handle including:
- Handle info
- Verdict
- All signals with performance data

## Troubleshooting

### Scraper Issues
- Ensure you have a stable internet connection
- X/Twitter may rate limit - adjust `SCRAPE_DELAY_MS` if needed
- If blocked, wait a few hours before retrying

### Database Locked
- SQLite only allows one writer at a time
- Don't run multiple scripts simultaneously
- If locked, wait for the current operation to complete

### Missing Price Data
- Some tokens may not be on Dexscreener
- Recently launched tokens may take time to appear
- Check Birdeye as fallback (requires API key)

## Performance Notes

- SQLite handles millions of rows efficiently
- Indexed queries are fast (<10ms)
- Backfill takes ~5-10 min for 5 handles (1000 tweets each)
- Daily updates are fast (~1-2 min)
- Performance tracking depends on number of active signals

## Compliance

This tool:
- ✅ Analyzes public data only
- ✅ Presents historical facts
- ✅ Does NOT provide financial advice
- ✅ Does NOT auto-trade
- ✅ Does NOT make predictions

Purpose: **Accountability and transparency** for crypto Twitter influencers.

## License

MIT

## Support

For issues or questions, please check:
1. This README
2. Source code comments
3. Create an issue on GitHub
