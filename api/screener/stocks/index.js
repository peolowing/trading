/**
 * Screener Stocks Management
 * GET /api/screener/stocks - List all stocks
 */

import { supabase } from '../../../config/supabase.js';

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

  // GET /api/screener/stocks - Get list of stocks
  if (method === 'GET') {
    try {
      const stocks = await getScreenerStocks();
      return res.json({ stocks });
    } catch (e) {
      console.error("Get screener stocks error:", e);
      return res.status(500).json({ error: "Failed to fetch stocks" });
    }
  }

  // POST /api/screener/stocks - Add stock
  if (method === 'POST') {
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

  // Method not allowed
  return res.status(405).json({ error: `Method ${method} not allowed` });
}
