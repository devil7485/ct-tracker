# CT Signal Tracker - System Architecture

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER WORKFLOW                                  │
└─────────────────────────────────────────────────────────────────────────┘

1. npm run backfill     →  Scrape historical tweets (1000 per handle)
2. npm run track        →  Track performance & calculate verdicts  
3. npm run dev          →  View dashboard at localhost:3000
4. npm run update       →  Daily: Get new tweets (incremental)
5. npm run track        →  Daily: Update performance


┌─────────────────────────────────────────────────────────────────────────┐
│                         SYSTEM COMPONENTS                                │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────┐
│  X/Twitter   │  (Public profiles)
└──────┬───────┘
       │
       │ Playwright scraper (headless browser)
       │
       ▼
┌──────────────────────────────────────────────────────────────────┐
│                          TWEET INGESTION                          │
│  • Scrape last 1000 tweets (backfill)                           │
│  • Scrape new tweets since last run (update)                    │
│  • Store: tweet_id, text, timestamp, username                   │
│  • Minimal storage (no images/videos)                           │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       │ Extract signals
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                       SIGNAL EXTRACTION                           │
│  • Regex for Solana CAs (base58, 32-44 chars)                   │
│  • Parse DEX links (Dexscreener, Birdeye, Pump, Jupiter)        │
│  • Extract tickers ($SYMBOL)                                     │
│  • Assign confidence: CA > DEX link > Ticker                     │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       │ Resolve CAs
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                      PRICE DATA (APIs)                            │
│  • Dexscreener (primary, free)                                   │
│  • Birdeye (secondary, optional)                                 │
│  • Get: price, market cap, liquidity, volume                     │
│  • Timing: Mention time + 1 minute window                        │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       │ Track lifecycle
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                    PERFORMANCE TRACKING                           │
│  • Mention price (at tweet time + 1min)                          │
│  • ATH (all-time high) & timestamp                               │
│  • ATL (all-time low) & timestamp                                │
│  • Death detection (liq < $5K OR -70% in 48h)                    │
│  • Rug detection (-90% in 48h)                                   │
│  • Lifecycle status (active/complete)                            │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       │ Aggregate per handle
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                      VERDICT ENGINE                               │
│  • Win rate (% calls with positive ROI)                          │
│  • Median ROI (middle value of all ROIs)                         │
│  • Rug rate (% calls that rugged)                                │
│  • Avg time to ATH                                               │
│  • Avg time to death                                             │
│  • Verdict labels:                                               │
│    - God Tier (80-100%)                                          │
│    - Excellent (60-80%)                                          │
│    - Good (50-60%)                                               │
│    - Average (30-50%)                                            │
│    - Worst (<30%)                                                │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       │ Store in SQLite
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                      DATABASE (SQLite)                            │
│  • handles (username, stats)                                     │
│  • tweets (minimal storage)                                      │
│  • signals (CA, ticker, confidence)                              │
│  • tokens (metadata)                                             │
│  • price_snapshots (historical data)                             │
│  • performance_windows (aggregated metrics)                      │
│  • handle_verdicts (final scores)                                │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       │ Next.js API routes
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js 14)                          │
│                                                                   │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  HOMEPAGE (Leaderboard)                                 │     │
│  │  • Ranked list of influencers                          │     │
│  │  • Win rate, ROI, rug rate                             │     │
│  │  • Verdict labels                                       │     │
│  │  • Total calls                                          │     │
│  │  • Click handle → Detail page                          │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                   │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  HANDLE DETAIL PAGE                                     │     │
│  │  • Individual stats (win rate, ROI, rug rate)          │     │
│  │  • Call history with performance                        │     │
│  │  • Tweet text, timestamp                                │     │
│  │  • Entry price, ATH, ROI                                │     │
│  │  • Rug/death indicators                                 │     │
│  └────────────────────────────────────────────────────────┘     │
└───────────────────────────────────────────────────────────────────┘
```

## ROI Calculation Logic

```
┌─────────────────────────────────────────────────────────────┐
│                    ROI DECISION TREE                         │
└─────────────────────────────────────────────────────────────┘

Token mentioned at price X
         │
         │ Wait 1 minute
         │
         ▼
    Get price (X)
         │
         │ Track over time
         │
         ▼
    Did ATH > X?
         │
    ┌────┴────┐
   YES       NO
    │         │
    ▼         ▼
ATH ROI    ATL ROI
= (ATH-X)  = (ATL-X)
  ────────   ────────
    X          X

Win if     Loss
ROI > 0    (negative)
```

## Death Detection Logic

```
┌─────────────────────────────────────────────────────────────┐
│                  DEATH CONDITIONS                            │
└─────────────────────────────────────────────────────────────┘

Check every update:
    │
    ├─► Liquidity < $5,000?  ──YES──► DEAD (reason: low_liquidity)
    │                          NO
    │                          │
    └─► Price drop > 70%    ──YES──► DEAD (reason: price_dump_70)
        from ATH in 48h?      NO
                              │
                              ▼
                         Still alive
```

## Rug Detection Logic

```
┌─────────────────────────────────────────────────────────────┐
│                    RUG DETECTION                             │
└─────────────────────────────────────────────────────────────┘

Within 48 hours of mention:
    │
    ▼
Price drop > 90%  ──YES──► RUG DETECTED
from mention?      NO      (is_rug = 1, lifecycle_complete = 1)
    │
    ▼
Not a rug
```

## File Structure

```
ct-tracker/
│
├── src/
│   ├── app/                          # Next.js frontend
│   │   ├── api/
│   │   │   ├── verdicts/route.ts    # GET all verdicts
│   │   │   └── handle/[username]/   # GET handle details
│   │   ├── handle/[username]/
│   │   │   └── page.tsx             # Handle detail page
│   │   ├── layout.tsx                # Root layout
│   │   ├── page.tsx                  # Homepage (leaderboard)
│   │   └── globals.css               # Tailwind styles
│   │
│   ├── lib/                          # Core logic
│   │   ├── db.ts                     # SQLite setup & schema
│   │   ├── scraper.ts                # Playwright X scraper
│   │   ├── extractor.ts              # CA/ticker extraction
│   │   ├── dexscreener.ts            # Price API client
│   │   ├── tracker.ts                # Performance tracking
│   │   └── verdict.ts                # Verdict calculation
│   │
│   └── scripts/                      # CLI tools
│       ├── init-db.ts                # Initialize database
│       ├── backfill.ts               # Historical scraping
│       ├── update.ts                 # Incremental updates
│       └── track-performance.ts      # Track prices
│
├── data/
│   └── ct-tracker.db                 # SQLite database
│
├── package.json                      # Dependencies
├── tsconfig.json                     # TypeScript config
├── next.config.js                    # Next.js config
├── tailwind.config.js                # Tailwind CSS config
├── README.md                         # Full documentation
└── QUICKSTART.md                     # Quick start guide
```

## Technology Choices - Why?

| Technology | Reason |
|------------|--------|
| **SQLite** | Single file, ACID, fast reads, easy migration, works locally + server |
| **Playwright** | Headless browser, handles dynamic content, no API limits |
| **Dexscreener** | Free tier, comprehensive Solana data, no API key needed |
| **Next.js 14** | React Server Components, API routes, great DX |
| **TypeScript** | Type safety, better IDE support, fewer bugs |
| **Tailwind CSS** | Fast styling, utility-first, responsive by default |

## Performance Characteristics

| Operation | Time | Notes |
|-----------|------|-------|
| Database init | <1s | Creates schema |
| Backfill (5 handles) | 5-10min | Network dependent |
| Update (daily) | 1-2min | Only new tweets |
| Track performance | 3-5min | API rate limiting |
| Page load | <100ms | SQLite indexed queries |
| Full rebuild | 10-15min | Backfill + track |

## Data Preservation Strategy

**Problem**: Influencers delete tweets after failed calls

**Solution**: 
1. Store tweet text locally in SQLite
2. Minimal storage (ID, text, timestamp only)
3. No images/videos (save space)
4. Immutable once scraped
5. Survives even if tweet deleted on X

**Result**: Complete, auditable history of all calls
