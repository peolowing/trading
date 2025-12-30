/**
 * Main Screener Endpoint
 * GET /api/screener - Run screener and return ranked stocks
 * 
 * Note: This is a simplified version that returns stocks from the screener_stocks table
 * with basic indicators. Full screener logic (from api/utils/index.js) is too complex
 * for serverless and should be run via cron job or background task.
 */

import { supabase } from '../../config/supabase.js';

export default async function handler(req, res) {
  const { method } = req;

  if (method !== 'GET') {
    return res.status(405).json({ error: `Method ${method} not allowed` });
  }

  try {
    // For now, return the stock list from screener_stocks
    // In production, this should return cached results from a background screener job
    
    if (!supabase) {
      return res.json({ stocks: [] });
    }

    const { data: stocks, error } = await supabase
      .from('screener_stocks')
      .select('*')
      .eq('is_active', true)
      .order('ticker', { ascending: true });

    if (error) throw error;

    // Return stocks with placeholder edge scores
    // In production, these should come from a screener_results table
    const stocksWithScores = (stocks || []).map(stock => ({
      ticker: stock.ticker,
      name: stock.name,
      bucket: stock.bucket,
      edgeScore: 50, // Placeholder - should come from actual analysis
      price: null,
      ema20: null,
      ema50: null,
      rsi: null,
      atr: null,
      relativeVolume: null,
      regime: null,
      setup: null
    }));

    return res.json({
      stocks: stocksWithScores,
      note: "This is a simplified screener. Run full screener via background job for accurate scores."
    });
  } catch (error) {
    console.error("Error in /api/screener:", error);
    return res.status(500).json({ error: error.message });
  }
}
