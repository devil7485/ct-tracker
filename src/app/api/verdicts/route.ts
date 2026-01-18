import { NextResponse } from 'next/server';
import getDatabase from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getDatabase();

  try {
    const verdicts = db.prepare(`
      SELECT 
        hv.*,
        h.username
      FROM handle_verdicts hv
      JOIN handles h ON hv.handle_id = h.id
      ORDER BY hv.win_rate DESC
    `).all();

    db.close();

    return NextResponse.json(verdicts);
  } catch (error) {
    console.error('Error fetching verdicts:', error);
    db.close();
    return NextResponse.json({ error: 'Failed to fetch verdicts' }, { status: 500 });
  }
}
