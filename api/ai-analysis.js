import OpenAI from "openai";
import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import { aiAnalysisRepo } from '../repositories/index.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Supabase for caching AI analysis
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// In-memory cache as fallback
const aiCache = new Map();

export default async function handler(req, res) {
  const { method } = req;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // GET /api/ai-analysis/history/:ticker - Get analysis history
  if (method === 'GET' && pathname.includes('/history/')) {
    try {
      const ticker = pathname.split('/').pop();
      const analyses = await aiAnalysisRepo.getRecentAnalyses(ticker, 3);

      let comparison = null;
      if (analyses.length >= 2) {
        comparison = aiAnalysisRepo.compareAnalyses(analyses[0], analyses[1]);
      }

      return res.json({
        analyses,
        comparison,
        count: analyses.length
      });
    } catch (error) {
      console.error("Error in /api/ai-analysis/history:", error);
      return res.status(500).json({ error: error.message });
    }
  }

  // POST /api/ai-analysis - Generate new AI analysis
  if (method !== 'POST') {
    return res.status(405).json({ error: `Method ${method} not allowed` });
  }

  try {
    const data = req.body;
    const ticker = data.ticker;
    const today = dayjs().format('YYYY-MM-DD');

    if (!ticker) {
      return res.status(400).json({ error: "Missing ticker" });
    }

    const cacheKey = `ai-${ticker}-${today}`;

    // Try Supabase cache first
    if (supabase) {
      try {
        const { data: cached } = await supabase
          .from('ai_analysis')
          .select('analysis_text')
          .eq('ticker', ticker)
          .eq('analysis_date', today)
          .maybeSingle();

        if (cached && cached.analysis_text) {
          console.log(`[AI Cache HIT] ${ticker}`);
          return res.json({ analysis: cached.analysis_text });
        }
      } catch (e) {
        console.warn(`[AI Cache Check] ${e.message}`);
      }
    }

    // Try in-memory cache
    const memCached = aiCache.get(cacheKey);
    if (memCached) {
      console.log(`[AI Memory Cache HIT] ${ticker}`);
      return res.json({ analysis: memCached });
    }

    console.log(`[AI Cache MISS] ${ticker} - calling OpenAI...`);

    // Generate AI analysis
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a disciplined weekly swing trader." },
        { role: "user", content: JSON.stringify(data) }
      ]
    });

    const analysis = completion.choices[0].message.content;

    // Save to Supabase cache
    if (supabase) {
      try {
        await supabase
          .from('ai_analysis')
          .upsert({
            ticker,
            analysis_date: today,
            analysis_text: analysis
          }, { onConflict: 'ticker,analysis_date' });
        console.log(`[AI Cache SAVED] ${ticker}`);
      } catch (e) {
        console.warn(`[AI Cache Save Failed] ${e.message}`);
      }
    }

    // Save to in-memory cache
    aiCache.set(cacheKey, analysis);

    // Clean old cache entries
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [key, value] of aiCache.entries()) {
      if (typeof value === 'object' && value.timestamp < oneHourAgo) {
        aiCache.delete(key);
      }
    }

    res.json({ analysis });
  } catch (error) {
    console.error("AI Analysis error:", error);
    res.status(500).json({
      error: "AI analysis failed",
      analysis: "AI-analys kunde inte genereras. Försök igen senare."
    });
  }
}