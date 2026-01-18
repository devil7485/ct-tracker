import { NextResponse } from 'next/server';
import getDatabase from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { username: string } }
) {
  const db = getDatabase();

  try {
    const username = params.username;

    // Get handle info
    const handle = db.prepare('SELECT * FROM handles WHERE username = ?').get(username) as any;

    if (!handle) {
      db.close();
      return NextResponse.json({ error: 'Handle not found' }, { status: 404 });
    }

    // Get verdict
    const verdict = db.prepare(`
      SELECT * FROM handle_verdicts WHERE handle_id = ?
    `).get(handle.id);

    // Get all signals with performance
    const signals = db.prepare(`
      SELECT 
        s.*,
        t.text as tweet_text,
        t.timestamp as tweet_timestamp,
        t.tweet_id,
        pw.*,
        tok.name as token_name,
        tok.symbol as token_symbol
      FROM signals s
      JOIN tweets t ON s.tweet_id = t.id
      LEFT JOIN performance_windows pw ON s.id = pw.signal_id
      LEFT JOIN tokens tok ON s.ca = tok.ca
      WHERE t.handle_id = ?
      ORDER BY t.timestamp DESC
    `).all(handle.id);

    db.close();

    return NextResponse.json({
      handle,
      verdict,
      signals
    });
  } catch (error) {
    console.error('Error fetching handle details:', error);
    db.close();
    return NextResponse.json({ error: 'Failed to fetch handle details' }, { status: 500 });
  }
}
