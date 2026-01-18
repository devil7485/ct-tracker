import getDatabase from './db';

export interface HandleMetrics {
  handleId: number;
  username: string;
  totalCalls: number;
  completedCalls: number;
  winRate: number;
  medianRoi: number;
  avgRoi: number;
  avgTimeToAth: number | null;
  avgTimeToDeath: number | null;
  rugRate: number;
  deathRate: number;
  avgMentionMarketCap: number;
  verdictLabel: string;
}

export class VerdictEngine {
  private db = getDatabase();

  async calculateVerdictForHandle(handleId: number): Promise<HandleMetrics | null> {
    // Get all completed signals for this handle
    const completedSignals = this.db.prepare(`
      SELECT 
        s.id as signal_id,
        pw.*,
        t.timestamp as mention_timestamp
      FROM signals s
      JOIN performance_windows pw ON s.id = pw.signal_id
      JOIN tweets t ON s.tweet_id = t.id
      WHERE t.handle_id = ?
        AND pw.mention_price IS NOT NULL
    `).all(handleId) as any[];

    if (completedSignals.length === 0) {
      return null;
    }

    const totalCalls = completedSignals.length;
    const lifecycleComplete = completedSignals.filter(s => s.lifecycle_complete === 1);
    const completedCalls = lifecycleComplete.length;

    // Calculate win rate (ROI > 0 from mention to ATH)
    const wins = completedSignals.filter(s => s.ath_roi > 0).length;
    const winRate = (wins / totalCalls) * 100;

    // Calculate median ROI
    const rois = completedSignals.map(s => {
      // Use ATH ROI if positive, otherwise ATL ROI
      return s.ath_roi > 0 ? s.ath_roi : s.atl_roi;
    }).sort((a, b) => a - b);

    const medianRoi = this.calculateMedian(rois);
    const avgRoi = rois.reduce((sum, roi) => sum + roi, 0) / rois.length;

    // Calculate average time to ATH (only for signals that had ATH > mention)
    const signalsWithAth = completedSignals.filter(s => s.ath_timestamp && s.ath_roi > 0);
    let avgTimeToAth: number | null = null;
    
    if (signalsWithAth.length > 0) {
      const timesToAth = signalsWithAth.map(s => s.ath_timestamp - s.mention_timestamp);
      avgTimeToAth = timesToAth.reduce((sum, t) => sum + t, 0) / timesToAth.length;
    }

    // Calculate average time to death
    const deadSignals = lifecycleComplete.filter(s => s.is_dead === 1 && s.death_timestamp);
    let avgTimeToDeath: number | null = null;
    
    if (deadSignals.length > 0) {
      const timesToDeath = deadSignals.map(s => s.death_timestamp - s.mention_timestamp);
      avgTimeToDeath = timesToDeath.reduce((sum, t) => sum + t, 0) / timesToDeath.length;
    }

    // Calculate rug rate
    const rugs = completedSignals.filter(s => s.is_rug === 1).length;
    const rugRate = (rugs / totalCalls) * 100;

    // Calculate death rate
    const deaths = completedSignals.filter(s => s.is_dead === 1).length;
    const deathRate = (deaths / totalCalls) * 100;

    // Calculate average mention market cap
    const marketCaps = completedSignals.map(s => s.mention_market_cap || 0).filter(mc => mc > 0);
    const avgMentionMarketCap = marketCaps.length > 0
      ? marketCaps.reduce((sum, mc) => sum + mc, 0) / marketCaps.length
      : 0;

    // Determine verdict label
    const verdictLabel = this.determineVerdict(winRate, rugRate, medianRoi, avgTimeToAth);

    // Store verdict
    this.db.prepare(`
      INSERT OR REPLACE INTO handle_verdicts (
        handle_id, total_calls, completed_calls, win_rate, median_roi, avg_roi,
        avg_time_to_ath, avg_time_to_death, rug_rate, death_rate,
        avg_mention_market_cap, verdict_label, last_calculated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      handleId,
      totalCalls,
      completedCalls,
      winRate,
      medianRoi,
      avgRoi,
      avgTimeToAth,
      avgTimeToDeath,
      rugRate,
      deathRate,
      avgMentionMarketCap,
      verdictLabel,
      Math.floor(Date.now() / 1000)
    );

    // Get handle username
    const handle = this.db.prepare('SELECT username FROM handles WHERE id = ?').get(handleId) as any;

    return {
      handleId,
      username: handle?.username || 'unknown',
      totalCalls,
      completedCalls,
      winRate,
      medianRoi,
      avgRoi,
      avgTimeToAth,
      avgTimeToDeath,
      rugRate,
      deathRate,
      avgMentionMarketCap,
      verdictLabel
    };
  }

  private calculateMedian(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    
    return sorted[mid];
  }

  private determineVerdict(
    winRate: number,
    rugRate: number,
    medianRoi: number,
    avgTimeToAth: number | null
  ): string {
    // Rug promoter
    if (rugRate > 50) {
      return 'Serial Rugger Promoter';
    }

    // High rug rate
    if (rugRate > 25) {
      return 'High Risk - Many Rugs';
    }

    // Win rate tiers
    if (winRate >= 80) {
      if (avgTimeToAth && avgTimeToAth < 3600) { // < 1 hour
        return 'God Tier - Ultra Early';
      }
      return 'God Tier';
    }

    if (winRate >= 60) {
      if (avgTimeToAth && avgTimeToAth < 7200) { // < 2 hours
        return 'Excellent - Early Signals';
      }
      return 'Excellent';
    }

    if (winRate >= 50) {
      if (medianRoi > 100) {
        return 'Good - High Upside';
      }
      return 'Good';
    }

    if (winRate >= 30) {
      if (avgTimeToAth && avgTimeToAth > 24 * 3600) { // > 24 hours
        return 'Average - Late Signals';
      }
      return 'Average';
    }

    // Low win rate
    if (medianRoi < -50) {
      return 'Worst - Heavy Losses';
    }

    return 'Worst';
  }

  async getAllVerdicts(): Promise<HandleMetrics[]> {
    const verdicts = this.db.prepare(`
      SELECT 
        hv.*,
        h.username
      FROM handle_verdicts hv
      JOIN handles h ON hv.handle_id = h.id
      ORDER BY hv.win_rate DESC
    `).all() as any[];

    return verdicts.map(v => ({
      handleId: v.handle_id,
      username: v.username,
      totalCalls: v.total_calls,
      completedCalls: v.completed_calls,
      winRate: v.win_rate,
      medianRoi: v.median_roi,
      avgRoi: v.avg_roi,
      avgTimeToAth: v.avg_time_to_ath,
      avgTimeToDeath: v.avg_time_to_death,
      rugRate: v.rug_rate,
      deathRate: v.death_rate,
      avgMentionMarketCap: v.avg_mention_market_cap,
      verdictLabel: v.verdict_label
    }));
  }

  async getVerdictForHandle(handleId: number): Promise<HandleMetrics | null> {
    const verdict = this.db.prepare(`
      SELECT 
        hv.*,
        h.username
      FROM handle_verdicts hv
      JOIN handles h ON hv.handle_id = h.id
      WHERE hv.handle_id = ?
    `).get(handleId) as any;

    if (!verdict) return null;

    return {
      handleId: verdict.handle_id,
      username: verdict.username,
      totalCalls: verdict.total_calls,
      completedCalls: verdict.completed_calls,
      winRate: verdict.win_rate,
      medianRoi: verdict.median_roi,
      avgRoi: verdict.avg_roi,
      avgTimeToAth: verdict.avg_time_to_ath,
      avgTimeToDeath: verdict.avg_time_to_death,
      rugRate: verdict.rug_rate,
      deathRate: verdict.death_rate,
      avgMentionMarketCap: verdict.avg_mention_market_cap,
      verdictLabel: verdict.verdict_label
    };
  }
}

export const verdictEngine = new VerdictEngine();
