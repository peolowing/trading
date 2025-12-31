/**
 * Screener API - Combined endpoint
 * Handles all screener-related routes:
 * - GET /api/screener - Main screener (list with scores)
 * - GET /api/screener/stocks - Stock list management
 * - POST /api/screener/stocks - Add stock
 * - DELETE /api/screener/stocks/:ticker - Remove stock
 * - PATCH /api/screener/stocks/:ticker - Update stock
 */

import { supabase } from '../config/supabase.js';

export default async function handler(req, res) {
  const { method } = req;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // GET /api/screener - Main screener
  if (method === 'GET' && pathname === '/api/screener') {
    try {
      if (!supabase) {
        return res.json({ stocks: [] });
      }

      const { data: stocks, error } = await supabase
        .from('screener_stocks')
        .select('*')
        .eq('is_active', true)
        .order('edge_score', { ascending: false });

      if (error) throw error;

      const stocksWithScores = (stocks || []).map(stock => ({
        ticker: stock.ticker,
        name: stock.name,
        bucket: stock.bucket,
        edgeScore: stock.edge_score || 50,
        price: stock.price,
        ema20: stock.ema20,
        ema50: stock.ema50,
        rsi: stock.rsi,
        atr: stock.atr,
        relativeVolume: stock.relative_volume,
        regime: stock.regime,
        setup: stock.setup,
        volume: stock.volume,
        turnoverMSEK: stock.turnover_msek,
        lastCalculated: stock.last_calculated
      }));

      return res.json({
        stocks: stocksWithScores,
        lastUpdate: stocks[0]?.last_calculated || null
      });
    } catch (error) {
      console.error("Error in /api/screener:", error);
      return res.status(500).json({ error: error.message });
    }
  }

  // GET /api/screener/stocks - List stocks
  if (method === 'GET' && pathname.includes('/stocks')) {
    // Check if it's a specific ticker
    const parts = pathname.split('/');
    if (parts.length > 4) {
      // It's /api/screener/stocks/:ticker
      return res.status(405).json({ error: 'Use DELETE or PATCH for individual stocks' });
    }

    try {
      if (!supabase) return res.json({ stocks: [] });

      const { data, error } = await supabase
        .from('screener_stocks')
        .select('*')
        .order('ticker', { ascending: true });

      if (error) throw error;
      return res.json({ stocks: data || [] });
    } catch (e) {
      console.error("Get screener stocks error:", e);
      return res.status(500).json({ error: "Failed to fetch stocks" });
    }
  }

  // POST /api/screener/stocks - Add stock
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

  // DELETE /api/screener/stocks/:ticker
  if (method === 'DELETE' && pathname.includes('/stocks/')) {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase not configured" });
    }

    try {
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

  // PATCH /api/screener/stocks/:ticker
  if (method === 'PATCH' && pathname.includes('/stocks/')) {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase not configured" });
    }

    try {
      const ticker = pathname.split('/').pop();
      const { is_active } = req.body;

      const { data, error } = await supabase
        .from('screener_stocks')
        .update({ is_active })
        .eq('ticker', ticker.toUpperCase())
        .select()
        .single();

      if (error) throw error;
      return res.json({ stock: data });
    } catch (e) {
      console.error("Update stock error:", e);
      return res.status(500).json({ error: "Failed to update stock" });
    }
  }

  // Method not allowed
  return res.status(405).json({ error: `Method ${method} not allowed for ${pathname}` });
}
