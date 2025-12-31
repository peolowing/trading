/**
 * Watchlist DELETE endpoint
 * DELETE /api/watchlist/:ticker
 */

import { supabase } from '../../config/supabase.js';

export default async function handler(req, res) {
  const { method } = req;
  const { ticker } = req.query;

  // Only allow DELETE
  if (method !== 'DELETE') {
    return res.status(405).json({ error: `Method ${method} not allowed` });
  }

  if (!supabase) {
    return res.status(503).json({ error: "Supabase not configured" });
  }

  try {
    if (!ticker) {
      return res.status(400).json({ error: "Ticker is required" });
    }

    const { error } = await supabase
      .from('watchlist')
      .delete()
      .eq('ticker', ticker.toUpperCase());

    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error("Delete from watchlist error:", e);
    return res.status(500).json({ error: "Failed to delete from watchlist" });
  }
}
