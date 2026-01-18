import getDatabase from './db';
import { dexscreener, PriceSnapshot } from './dexscreener';

export interface PerformanceMetrics {
  signalId: number;
  ca: string;
  mentionPrice: number;
  athPrice: number;
  athTimestamp: number | null;
  athRoi: number;
  atlPrice: number;
  atlTimestamp: number | null;
  atlRoi: number;
  currentPrice: number;
  currentRoi: number;
  isDead: boolean;
  deathTimestamp: number | null;
  deathReason: string | null;
  isRug: boolean;
  rugTimestamp: number | null;
  lifecycleComplete: boolean;
}

export class PerformanceTracker {
  private db = getDatabase();

  async trackSignal(signalId: number, ca: string, mentionTimestamp: number) {
    console.log(`📊 Tracking signal ${signalId} for CA: ${ca}`);

    // Wait 1 minute after mention to get initial price
    const targetTimestamp = mentionTimestamp + 60;
    const now = Math.floor(Date.now() / 1000);
    
    if (now < targetTimestamp) {
      const waitTime = (targetTimestamp - now) * 1000;
      console.log(`⏳ Waiting ${waitTime / 1000}s for 1-minute window...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Get mention price
    const mentionSnapshot = await dexscreener.getCurrentPrice(ca);
    
    if (!mentionSnapshot) {
      console.log(`⚠️  Could not get price for ${ca}, skipping...`);
      return;
    }

    // Initialize performance record
    this.db.prepare(`
      INSERT INTO performance_windows (
        signal_id, mention_price, mention_market_cap, mention_liquidity,
        ath_price, atl_price, current_price, ath_roi, atl_roi, current_roi
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0)
    `).run(
      signalId,
      mentionSnapshot.price,
      mentionSnapshot.marketCap,
      mentionSnapshot.liquidity,
      mentionSnapshot.price, // ATH starts at mention price
      mentionSnapshot.price, // ATL starts at mention price
      mentionSnapshot.price
    );

    // Store mention snapshot
    this.db.prepare(`
      INSERT INTO price_snapshots (signal_id, price, market_cap, liquidity, volume_24h, timestamp, event_type)
      VALUES (?, ?, ?, ?, ?, ?, 'mention')
    `).run(
      signalId,
      mentionSnapshot.price,
      mentionSnapshot.marketCap,
      mentionSnapshot.liquidity,
      mentionSnapshot.volume24h,
      mentionSnapshot.timestamp
    );

    console.log(`✅ Initialized tracking for ${ca} at $${mentionSnapshot.price}`);
  }

  async updatePerformance(signalId: number, ca: string) {
    const perf = this.db.prepare(`
      SELECT * FROM performance_windows WHERE signal_id = ?
    `).get(signalId) as any;

    if (!perf) {
      console.log(`⚠️  No performance record for signal ${signalId}`);
      return;
    }

    if (perf.lifecycle_complete) {
      return; // Already marked as complete
    }

    // Get current price
    const currentSnapshot = await dexscreener.getCurrentPrice(ca);
    
    if (!currentSnapshot) {
      console.log(`⚠️  Could not get current price for ${ca}`);
      return;
    }

    const currentPrice = currentSnapshot.price;
    const currentLiquidity = currentSnapshot.liquidity;
    const mentionPrice = perf.mention_price;
    const athPrice = perf.ath_price;
    const atlPrice = perf.atl_price;
    const now = Math.floor(Date.now() / 1000);

    let updates: any = {
      current_price: currentPrice,
      current_roi: ((currentPrice - mentionPrice) / mentionPrice) * 100,
      last_updated: now
    };

    // Update ATH if new high
    if (currentPrice > athPrice) {
      updates.ath_price = currentPrice;
      updates.ath_timestamp = now;
      updates.ath_roi = ((currentPrice - mentionPrice) / mentionPrice) * 100;

      // Store ATH snapshot
      this.db.prepare(`
        INSERT INTO price_snapshots (signal_id, price, market_cap, liquidity, volume_24h, timestamp, event_type)
        VALUES (?, ?, ?, ?, ?, ?, 'ath')
      `).run(signalId, currentPrice, currentSnapshot.marketCap, currentLiquidity, currentSnapshot.volume24h, now);
    }

    // Update ATL if new low
    if (currentPrice < atlPrice) {
      updates.atl_price = currentPrice;
      updates.atl_timestamp = now;
      updates.atl_roi = ((currentPrice - mentionPrice) / mentionPrice) * 100;
    }

    // Check for death conditions
    const isDead = await this.checkDeathConditions(
      signalId, 
      mentionPrice, 
      athPrice, 
      currentPrice, 
      currentLiquidity,
      perf.mention_timestamp || now
    );

    if (isDead && !perf.is_dead) {
      updates.is_dead = 1;
      updates.death_timestamp = now;
      updates.lifecycle_complete = 1;

      // Store death snapshot
      this.db.prepare(`
        INSERT INTO price_snapshots (signal_id, price, market_cap, liquidity, volume_24h, timestamp, event_type)
        VALUES (?, ?, ?, ?, ?, ?, 'death')
      `).run(signalId, currentPrice, currentSnapshot.marketCap, currentLiquidity, currentSnapshot.volume24h, now);
    }

    // Check for rug
    const isRug = await this.checkRugConditions(
      signalId,
      mentionPrice,
      currentPrice,
      perf.mention_timestamp || now
    );

    if (isRug && !perf.is_rug) {
      updates.is_rug = 1;
      updates.rug_timestamp = now;
      updates.is_dead = 1;
      updates.death_timestamp = now;
      updates.death_reason = 'rug';
      updates.lifecycle_complete = 1;
    }

    // Build UPDATE query
    const keys = Object.keys(updates);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => updates[k]);

    this.db.prepare(`
      UPDATE performance_windows SET ${setClause} WHERE signal_id = ?
    `).run(...values, signalId);

    console.log(`📈 Updated performance for signal ${signalId}: $${currentPrice.toFixed(8)} (${updates.current_roi.toFixed(2)}%)`);
  }

  private async checkDeathConditions(
    signalId: number,
    mentionPrice: number,
    athPrice: number,
    currentPrice: number,
    currentLiquidity: number,
    mentionTimestamp: number
  ): Promise<boolean> {
    const now = Math.floor(Date.now() / 1000);
    const timeSinceMention = now - mentionTimestamp;

    // Death condition 1: Liquidity < $5K
    if (currentLiquidity < 5000) {
      this.db.prepare(`
        UPDATE performance_windows SET death_reason = 'low_liquidity' WHERE signal_id = ?
      `).run(signalId);
      return true;
    }

    // Death condition 2: Price dumps >70% from ATH within 48 hours
    if (timeSinceMention <= 48 * 3600) {
      const dropFromAth = ((athPrice - currentPrice) / athPrice) * 100;
      
      if (dropFromAth > 70) {
        this.db.prepare(`
          UPDATE performance_windows SET death_reason = 'price_dump_70' WHERE signal_id = ?
        `).run(signalId);
        return true;
      }
    }

    return false;
  }

  private async checkRugConditions(
    signalId: number,
    mentionPrice: number,
    currentPrice: number,
    mentionTimestamp: number
  ): Promise<boolean> {
    const now = Math.floor(Date.now() / 1000);
    const timeSinceMention = now - mentionTimestamp;

    // Rug condition: Price dumps >90% within 48 hours
    if (timeSinceMention <= 48 * 3600) {
      const dropFromMention = ((mentionPrice - currentPrice) / mentionPrice) * 100;
      
      if (dropFromMention > 90) {
        return true;
      }
    }

    return false;
  }

  async getActiveSignals(): Promise<number[]> {
    const signals = this.db.prepare(`
      SELECT id FROM signals
      WHERE id IN (
        SELECT signal_id FROM performance_windows
        WHERE lifecycle_complete = 0
      )
    `).all() as any[];

    return signals.map(s => s.id);
  }

  async getSignalCA(signalId: number): Promise<string | null> {
    const signal = this.db.prepare(`
      SELECT ca FROM signals WHERE id = ?
    `).get(signalId) as any;

    return signal?.ca || null;
  }
}

export const performanceTracker = new PerformanceTracker();
