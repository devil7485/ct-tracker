// Signal extraction from tweets

export interface ExtractedSignal {
  ca?: string;
  ticker?: string;
  signalType: 'ca' | 'dex_link' | 'ticker';
  confidence: 'high' | 'medium' | 'low';
  dexLink?: string;
}

// Solana CA regex: base58, 32-44 characters, no 0OIl
const SOLANA_CA_REGEX = /\b([1-9A-HJ-NP-Za-km-z]{32,44})\b/g;

// DEX link patterns
const DEX_PATTERNS = [
  {
    pattern: /dexscreener\.com\/solana\/([1-9A-HJ-NP-Za-km-z]{32,44})/gi,
    name: 'dexscreener'
  },
  {
    pattern: /birdeye\.so\/token\/([1-9A-HJ-NP-Za-km-z]{32,44})/gi,
    name: 'birdeye'
  },
  {
    pattern: /pump\.fun\/([1-9A-HJ-NP-Za-km-z]{32,44})/gi,
    name: 'pumpfun'
  },
  {
    pattern: /jup\.ag\/swap\/[A-Z]+-([1-9A-HJ-NP-Za-km-z]{32,44})/gi,
    name: 'jupiter'
  }
];

// Ticker pattern (must start with $)
const TICKER_REGEX = /\$([A-Z]{2,10})\b/g;

// Common false positives to filter out
const FALSE_POSITIVE_CAS = new Set([
  'So11111111111111111111111111111111111111112', // Wrapped SOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
]);

// Blacklist common words that match CA pattern but aren't CAs
const WORD_BLACKLIST = new Set([
  'BREAKING', 'THREAD', 'UPDATE', 'IMPORTANT', 'ATTENTION'
]);

export function extractSignals(tweetText: string): ExtractedSignal[] {
  const signals: ExtractedSignal[] = [];
  const seenCAs = new Set<string>();

  // 1. Extract from DEX links (MEDIUM confidence)
  for (const { pattern, name } of DEX_PATTERNS) {
    const matches = [...tweetText.matchAll(pattern)];
    for (const match of matches) {
      const ca = match[1];
      if (!seenCAs.has(ca) && !FALSE_POSITIVE_CAS.has(ca)) {
        signals.push({
          ca,
          signalType: 'dex_link',
          confidence: 'medium',
          dexLink: match[0]
        });
        seenCAs.add(ca);
      }
    }
  }

  // 2. Extract standalone CAs (HIGH confidence)
  const caMatches = [...tweetText.matchAll(SOLANA_CA_REGEX)];
  for (const match of caMatches) {
    const ca = match[1];
    
    // Skip if already found, is false positive, or looks like a word
    if (seenCAs.has(ca) || FALSE_POSITIVE_CAS.has(ca) || WORD_BLACKLIST.has(ca.toUpperCase())) {
      continue;
    }

    // Additional validation: must not be all same character
    if (new Set(ca).size < 10) {
      continue;
    }

    signals.push({
      ca,
      signalType: 'ca',
      confidence: 'high'
    });
    seenCAs.add(ca);
  }

  // 3. Extract tickers (LOW confidence)
  const tickerMatches = [...tweetText.matchAll(TICKER_REGEX)];
  for (const match of tickerMatches) {
    const ticker = match[1];
    
    // Skip common words
    if (['SOL', 'USDC', 'USDT', 'BTC', 'ETH'].includes(ticker)) {
      continue;
    }

    // Only add ticker if no CA was found
    if (signals.length === 0) {
      signals.push({
        ticker,
        signalType: 'ticker',
        confidence: 'low'
      });
    }
  }

  return signals;
}

// Validate if a string looks like a valid Solana CA
export function isValidSolanaCA(ca: string): boolean {
  if (ca.length < 32 || ca.length > 44) return false;
  if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(ca)) return false;
  if (new Set(ca).size < 10) return false;
  if (FALSE_POSITIVE_CAS.has(ca)) return false;
  return true;
}

// Extract CA from various URL formats
export function extractCAFromURL(url: string): string | null {
  for (const { pattern } of DEX_PATTERNS) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}
