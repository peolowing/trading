/**
 * Screener API endpoint
 * Handles GET, POST, DELETE for screener
 * Also handles /stocks sub-route for managing screener stock list
 *
 * Note: Main screener logic is complex and shared with api/index.js
 * This is a placeholder that routes to the main implementation
 */

import { supabase } from '../config/supabase.js';

// Helper to get screener stocks from database
async function getScreenerStocks() {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('screener_stocks')
      .select('*')
      .order('ticker', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error("getScreenerStocks error:", e);
    return [];
  }
}

export default async function handler(req, res) {
  const { method } = req;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // GET /api/screener/stocks - Get list of stocks to screen
  if (method === 'GET' && pathname.includes('/stocks')) {
    try {
      const stocks = await getScreenerStocks();
      return res.json({ stocks });
    } catch (e) {
      console.error("Get screener stocks error:", e);
      return res.status(500).json({ error: "Failed to fetch stocks" });
    }
  }

  // POST /api/screener/stocks - Add stock to screener list
  if (method === 'POST' && pathname.includes('/stocks')) {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase not configured" });
    }

    try {
      const { ticker, name, bucket } = req.body;

      if (!ticker) {
        return res.status(400).json({ error: "Ticker is required" });
      }

      const { data, error } = await supabase
        .from('screener_stocks')
        .insert([{
          ticker: ticker.toUpperCase(),
          name: name || null,
          bucket: bucket || 'UNKNOWN'
        }])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({ error: "Ticker already exists" });
        }
        throw error;
      }

      return res.status(201).json({ stock: data });
    } catch (e) {
      console.error("Add stock error:", e);
      return res.status(500).json({ error: "Failed to add stock" });
    }
  }

  // DELETE /api/screener/stocks/:ticker - Remove stock from screener list
  if (method === 'DELETE' && pathname.includes('/stocks')) {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase not configured" });
    }

    try {
      // Extract ticker from URL
      const ticker = pathname.split('/').pop();

      const { error } = await supabase
        .from('screener_stocks')
        .delete()
        .eq('ticker', ticker.toUpperCase());

      if (error) throw error;
      return res.json({ success: true });
    } catch (e) {
      console.error("Delete stock error:", e);
      return res.status(500).json({ error: "Failed to delete stock" });
    }
  }

  // GET /api/screener - Run the screener
  // This is complex and would require duplicating lots of code from api/index.js
  // For now, return a not implemented error with suggestion
  if (method === 'GET') {
    return res.status(501).json({
      error: "Screener endpoint not yet implemented in serverless mode",
      note: "Use local development server (npm run server) for full screener functionality"
    });
  }

  // Method not allowed
  return res.status(405).json({ error: `Method ${method} not allowed` });
}
