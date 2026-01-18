import getDatabase from '../lib/db';
import { performanceTracker } from '../lib/tracker';
import { verdictEngine } from '../lib/verdict';

async function trackPerformance() {
  console.log('🚀 Starting performance tracking...\n');
  
  const db = getDatabase();

  try {
    // Get all signals that need initial tracking (no performance record yet)
    const newSignals = db.prepare(`
      SELECT s.id, s.ca, t.timestamp as mention_timestamp
      FROM signals s
      JOIN tweets t ON s.tweet_id = t.id
      WHERE s.id NOT IN (SELECT signal_id FROM performance_windows)
      ORDER BY t.timestamp DESC
    `).all() as any[];

    console.log(`📊 Found ${newSignals.length} new signals to track\n`);

    // Initialize tracking for new signals
    for (const signal of newSignals) {
      try {
        await performanceTracker.trackSignal(
          signal.id,
          signal.ca,
          signal.mention_timestamp
        );
      } catch (error) {
        console.error(`❌ Failed to track signal ${signal.id}:`, error);
      }
    }

    // Get all active signals (not dead/complete)
    const activeSignals = await performanceTracker.getActiveSignals();
    
    console.log(`\n📈 Updating ${activeSignals.length} active signals...\n`);

    for (const signalId of activeSignals) {
      try {
        const ca = await performanceTracker.getSignalCA(signalId);
        if (ca) {
          await performanceTracker.updatePerformance(signalId, ca);
        }
      } catch (error) {
        console.error(`❌ Failed to update signal ${signalId}:`, error);
      }
    }

    // Calculate verdicts for all handles
    console.log('\n🎯 Calculating verdicts...\n');
    
    const handles = db.prepare('SELECT id, username FROM handles').all() as any[];
    
    for (const handle of handles) {
      try {
        const verdict = await verdictEngine.calculateVerdictForHandle(handle.id);
        
        if (verdict) {
          console.log(`✅ @${handle.username}:`);
          console.log(`   Verdict: ${verdict.verdictLabel}`);
          console.log(`   Win Rate: ${verdict.winRate.toFixed(1)}%`);
          console.log(`   Median ROI: ${verdict.medianRoi.toFixed(1)}%`);
          console.log(`   Rug Rate: ${verdict.rugRate.toFixed(1)}%`);
          console.log('');
        }
      } catch (error) {
        console.error(`❌ Failed to calculate verdict for ${handle.username}:`, error);
      }
    }

    console.log('\n✅ Performance tracking complete!');

  } catch (error) {
    console.error('\n❌ Performance tracking failed:', error);
  } finally {
    db.close();
  }
}

// Run tracking
trackPerformance().catch(console.error);
