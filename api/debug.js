/**
 * Debug endpoint to check configuration
 * GET /api/debug
 */

import { supabase } from '../config/supabase.js';

export default async function handler(req, res) {
  try {
    const hasSupabase = !!supabase;

    const config = {
      hasSupabaseClient: hasSupabase,
      supabaseUrl: process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing',
      supabaseKey: (process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY) ? '✅ Set' : '❌ Missing',
      openaiKey: process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing',
    };

    // Try to fetch data if Supabase is configured
    let dataTest = {};
    if (hasSupabase) {
      try {
        const { data: screener, error: screenerError } = await supabase
          .from('screener_stocks')
          .select('ticker')
          .limit(5);

        dataTest.screener = {
          success: !screenerError,
          count: screener?.length || 0,
          error: screenerError?.message || null
        };

        const { data: portfolio, error: portfolioError } = await supabase
          .from('portfolio')
          .select('ticker')
          .limit(5);

        dataTest.portfolio = {
          success: !portfolioError,
          count: portfolio?.length || 0,
          error: portfolioError?.message || null
        };

        const { data: watchlist, error: watchlistError } = await supabase
          .from('watchlist')
          .select('ticker')
          .limit(5);

        dataTest.watchlist = {
          success: !watchlistError,
          count: watchlist?.length || 0,
          error: watchlistError?.message || null
        };
      } catch (e) {
        dataTest.error = e.message;
      }
    }

    return res.json({
      config,
      dataTest,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
