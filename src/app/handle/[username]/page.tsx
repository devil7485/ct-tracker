'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, TrendingDown, Skull, AlertCircle } from 'lucide-react';

interface HandleData {
  handle: any;
  verdict: any;
  signals: any[];
}

export default function HandlePage() {
  const params = useParams();
  const username = params.username as string;
  
  const [data, setData] = useState<HandleData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/handle/${username}`)
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching handle:', err);
        setLoading(false);
      });
  }, [username]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTime = (seconds: number | null) => {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 24) return `${Math.floor(hours / 24)}d`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getROIColor = (roi: number) => {
    if (roi >= 100) return 'text-green-400';
    if (roi >= 50) return 'text-green-500';
    if (roi > 0) return 'text-green-600';
    if (roi > -50) return 'text-red-600';
    return 'text-red-500';
  };

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center text-gray-400">Loading...</div>
      </main>
    );
  }

  if (!data || !data.handle) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center text-gray-400">Handle not found</div>
      </main>
    );
  }

  const { handle, verdict, signals } = data;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Link 
        href="/"
        className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-6 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Leaderboard
      </Link>

      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">@{handle.username}</h1>
        {verdict && (
          <p className="text-2xl text-gray-400">{verdict.verdict_label}</p>
        )}
      </div>

      {verdict && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-1">Win Rate</div>
            <div className={`text-2xl font-bold ${verdict.win_rate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
              {verdict.win_rate.toFixed(1)}%
            </div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-1">Median ROI</div>
            <div className={`text-2xl font-bold ${verdict.median_roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {verdict.median_roi >= 0 ? '+' : ''}{verdict.median_roi.toFixed(1)}%
            </div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-1">Rug Rate</div>
            <div className={`text-2xl font-bold ${verdict.rug_rate > 25 ? 'text-red-400' : 'text-gray-400'}`}>
              {verdict.rug_rate.toFixed(1)}%
            </div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-1">Avg Time to ATH</div>
            <div className="text-2xl font-bold text-gray-300">
              {formatTime(verdict.avg_time_to_ath)}
            </div>
          </div>
        </div>
      )}

      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Call History ({signals.length})</h2>
        
        {signals.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            No signals tracked yet
          </div>
        ) : (
          <div className="space-y-4">
            {signals.map((signal) => (
              <div key={signal.id} className="bg-gray-900 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-gray-400">
                        {formatDate(signal.tweet_timestamp)}
                      </span>
                      {signal.is_rug === 1 && (
                        <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">
                          RUG
                        </span>
                      )}
                      {signal.is_dead === 1 && !signal.is_rug && (
                        <span className="px-2 py-0.5 bg-gray-600/20 text-gray-400 text-xs rounded">
                          DEAD
                        </span>
                      )}
                    </div>
                    <div className="text-gray-300 text-sm mb-2">
                      {signal.tweet_text.length > 150 
                        ? signal.tweet_text.substring(0, 150) + '...'
                        : signal.tweet_text}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">CA:</span>{' '}
                    <code className="text-blue-400">{signal.ca.substring(0, 8)}...</code>
                  </div>
                  
                  {signal.token_symbol && (
                    <div>
                      <span className="text-gray-400">Token:</span>{' '}
                      <span className="text-white">${signal.token_symbol}</span>
                    </div>
                  )}

                  {signal.mention_price && (
                    <>
                      <div>
                        <span className="text-gray-400">Entry:</span>{' '}
                        <span className="text-white">${signal.mention_price.toFixed(8)}</span>
                      </div>

                      {signal.ath_roi !== null && (
                        <div>
                          <span className="text-gray-400">ROI:</span>{' '}
                          <span className={getROIColor(signal.ath_roi > 0 ? signal.ath_roi : signal.atl_roi)}>
                            {signal.ath_roi > 0 ? '+' : ''}{(signal.ath_roi > 0 ? signal.ath_roi : signal.atl_roi).toFixed(1)}%
                          </span>
                        </div>
                      )}

                      {signal.ath_timestamp && signal.ath_roi > 0 && (
                        <div>
                          <span className="text-gray-400">Time to ATH:</span>{' '}
                          <span className="text-white">
                            {formatTime(signal.ath_timestamp - signal.tweet_timestamp)}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
