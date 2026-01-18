'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TrendingUp, TrendingDown, AlertTriangle, Trophy } from 'lucide-react';

interface Verdict {
  handle_id: number;
  username: string;
  total_calls: number;
  completed_calls: number;
  win_rate: number;
  median_roi: number;
  avg_roi: number;
  avg_time_to_ath: number | null;
  avg_time_to_death: number | null;
  rug_rate: number;
  death_rate: number;
  avg_mention_market_cap: number;
  verdict_label: string;
  last_calculated: number;
}

export default function Home() {
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/verdicts')
      .then(res => res.json())
      .then(data => {
        setVerdicts(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching verdicts:', err);
        setLoading(false);
      });
  }, []);

  const getVerdictColor = (label: string) => {
    if (label.includes('God')) return 'text-yellow-400';
    if (label.includes('Excellent')) return 'text-green-400';
    if (label.includes('Good')) return 'text-blue-400';
    if (label.includes('Average')) return 'text-gray-400';
    if (label.includes('Rug')) return 'text-red-500';
    return 'text-red-400';
  };

  const getVerdictIcon = (label: string) => {
    if (label.includes('God')) return <Trophy className="w-5 h-5" />;
    if (label.includes('Excellent')) return <TrendingUp className="w-5 h-5" />;
    if (label.includes('Good')) return <TrendingUp className="w-5 h-5" />;
    if (label.includes('Rug')) return <AlertTriangle className="w-5 h-5" />;
    return <TrendingDown className="w-5 h-5" />;
  };

  const formatTime = (seconds: number | null) => {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 24) return `${Math.floor(hours / 24)}d`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center text-gray-400">Loading...</div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">CT Signal Tracker</h1>
        <p className="text-gray-400 text-lg">
          Exposing the truth behind crypto Twitter influencers with real performance data
        </p>
      </div>

      {verdicts.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-400">
            No data yet. Run the backfill script to start tracking influencers.
          </p>
          <code className="block mt-4 text-sm text-gray-500">
            npm run backfill
          </code>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Handle
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Verdict
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Win Rate
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Median ROI
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Rug Rate
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Avg Time to ATH
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Total Calls
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {verdicts.map((verdict, index) => (
                  <tr key={verdict.handle_id} className="hover:bg-gray-750 transition">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      #{index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link 
                        href={`/handle/${verdict.username}`}
                        className="text-blue-400 hover:text-blue-300 font-medium transition"
                      >
                        @{verdict.username}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`flex items-center gap-2 ${getVerdictColor(verdict.verdict_label)}`}>
                        {getVerdictIcon(verdict.verdict_label)}
                        <span className="font-medium">{verdict.verdict_label}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className={verdict.win_rate >= 50 ? 'text-green-400' : 'text-red-400'}>
                        {verdict.win_rate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className={verdict.median_roi >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {verdict.median_roi >= 0 ? '+' : ''}{verdict.median_roi.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className={verdict.rug_rate > 25 ? 'text-red-400' : 'text-gray-400'}>
                        {verdict.rug_rate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-400">
                      {formatTime(verdict.avg_time_to_ath)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-400">
                      {verdict.total_calls}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-8 bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">How It Works</h2>
        <div className="grid md:grid-cols-2 gap-6 text-gray-300">
          <div>
            <h3 className="font-semibold text-white mb-2">Data Collection</h3>
            <p className="text-sm">
              We scrape public tweets from crypto influencers, extract coin mentions (CAs, tickers, DEX links),
              and preserve them even if deleted later.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-2">Performance Tracking</h3>
            <p className="text-sm">
              For each mentioned token, we track price at mention time (+1min), ATH, lifespan, rug detection,
              and calculate real ROI metrics.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-2">Verdict System</h3>
            <p className="text-sm">
              Based on win rate, median ROI, rug rate, and timing, we assign labels from "God Tier" (80%+ wins)
              to "Worst" (&lt;30% wins).
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-2">Accountability</h3>
            <p className="text-sm">
              No predictions, no financial advice. Just historical facts about what happened after influencers
              posted about tokens.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
