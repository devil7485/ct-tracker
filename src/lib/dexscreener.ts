import axios from 'axios';

const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex';

export interface TokenPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd: string;
  liquidity: {
    usd: number;
    base: number;
    quote: number;
  };
  fdv: number;
  marketCap: number;
  volume: {
    h24: number;
  };
  priceChange: {
    h24: number;
  };
}

export interface PriceSnapshot {
  price: number;
  marketCap: number;
  liquidity: number;
  volume24h: number;
  timestamp: number;
}

export class DexscreenerClient {
  private lastRequestTime = 0;
  private minRequestInterval = 1000; // 1 second between requests

  private async rateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      await new Promise(resolve => 
        setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
      );
    }
    
    this.lastRequestTime = Date.now();
  }

  async getTokenPairs(ca: string): Promise<TokenPair[]> {
    await this.rateLimit();

    try {
      const response = await axios.get(`${DEXSCREENER_API}/tokens/${ca}`, {
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CT-Tracker/1.0'
        }
      });

      if (response.data && response.data.pairs) {
        return response.data.pairs.filter((pair: TokenPair) => 
          pair.chainId === 'solana' && pair.liquidity?.usd > 0
        );
      }

      return [];
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log(`⚠️  Token not found on Dexscreener: ${ca}`);
        return [];
      }
      
      console.error(`❌ Dexscreener API error for ${ca}:`, error.message);
      return [];
    }
  }

  async getBestPair(ca: string): Promise<TokenPair | null> {
    const pairs = await this.getTokenPairs(ca);
    
    if (pairs.length === 0) return null;

    // Sort by liquidity (highest first)
    pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
    
    return pairs[0];
  }

  async getCurrentPrice(ca: string): Promise<PriceSnapshot | null> {
    const pair = await this.getBestPair(ca);
    
    if (!pair) return null;

    return {
      price: parseFloat(pair.priceUsd),
      marketCap: pair.marketCap || pair.fdv || 0,
      liquidity: pair.liquidity?.usd || 0,
      volume24h: pair.volume?.h24 || 0,
      timestamp: Math.floor(Date.now() / 1000)
    };
  }

  async getTokenInfo(ca: string): Promise<{ name: string; symbol: string } | null> {
    const pair = await this.getBestPair(ca);
    
    if (!pair) return null;

    return {
      name: pair.baseToken.name,
      symbol: pair.baseToken.symbol
    };
  }

  // Check if token is still tradeable
  async isTokenAlive(ca: string): Promise<boolean> {
    const snapshot = await this.getCurrentPrice(ca);
    
    if (!snapshot) return false;
    
    // Dead if liquidity < $5K
    if (snapshot.liquidity < 5000) return false;
    
    return true;
  }
}

// Singleton instance
export const dexscreener = new DexscreenerClient();
