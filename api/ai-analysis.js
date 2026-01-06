import OpenAI from "openai";
import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';

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
  // POST /api/ai-analysis - Generate new AI analysis
  if (req.method !== 'POST') {
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const data = req.body;
    const ticker = data.ticker;
    const forceRefresh = data.force === true;
    const today = dayjs().format('YYYY-MM-DD');

    if (!ticker) {
      return res.status(400).json({ error: "Missing ticker" });
    }

    const cacheKey = `ai-${ticker}-${today}`;

    // Skip cache if force refresh is requested
    if (!forceRefresh) {
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
    }

    console.log(`[AI Cache MISS] ${ticker}${forceRefresh ? ' (forced refresh)' : ''} - calling OpenAI...`);

    // Generate AI analysis
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Du är en erfaren svensk swing trader som analyserar veckotrading-möjligheter.

KRITISKT VIKTIGT:
- Svara ENDAST på svenska
- ALLA rubriker ska börja med ##
- ALDRIG på engelska
- Använd exakt denna struktur:

Ge ditt svar i exakt följande format:

## MARKNADSLÄGE
[2-3 meningar om trenden, nuvarande prisnivå och om aktien är i en uppåt-, nedåt- eller sidledes trend]

## TEKNISKA SIGNALER
• **RSI:** [Nuvarande RSI-värde och vad det betyder - överköpt/översålt/neutralt]
• **EMAs:** [Relation mellan pris, EMA20 och EMA50 - är det bullish/bearish crossover?]
• **Volym:** [Jämför senaste volymen med genomsnittet - stigande/fallande aktivitet]
• **Volatilitet (ATR):** [Kommentera nuvarande volatilitet och vad det betyder för risk]

## STRATEGI & RESONEMANG
[Förklara VILKEN strategi som passar bäst för nuvarande setup och VARFÖR. Diskutera om det är läge för pullback, breakout, reversal, trendföljning etc. Motivera med de tekniska signalerna.]

## HANDELSBESLUT
**Rekommendation:** [KÖP / INVÄNTA / UNDVIK]
**Motivering:** [1-2 meningar om varför detta beslut]
**Entry-nivå:** [Använd EXAKT värdet från data.trade.entry om det finns]

## RISK & POSITIONSSTORLEK
**Stop Loss:** [Använd EXAKT värdet från data.trade.stop om det finns - ange även i SEK med valutan]
**Target:** [Använd EXAKT värdet från data.trade.target om det finns - ange även i SEK med valutan]
**Risk/Reward:** [Använd EXAKT värdet från data.trade.rr, formaterat som 1:X.XX]
**Position Size:** [Förslag baserat på data.trade.atr och risk - t.ex. "Med 2% kontorisk och stop på X SEK motsvarar detta Y aktier"]

## BACKTEST-INSIKTER
[2-3 meningar om vad backtestet visar - vinstprocent, genomsnittlig vinst/förlust, antal signaler]

## SAMMANFATTNING
[1-2 meningar med tydlig konklusion - finns setup eller inte, vad är nästa steg]`
        },
        { role: "user", content: JSON.stringify(data) }
      ]
    });

    const analysis = completion.choices[0].message.content;

    // Save to Supabase cache
    if (supabase) {
      try {
        // Try to update existing record first
        const { data: existing } = await supabase
          .from('ai_analysis')
          .select('id')
          .eq('ticker', ticker)
          .eq('analysis_date', today)
          .maybeSingle();

        if (existing) {
          // Update existing record
          const { error: updateError } = await supabase
            .from('ai_analysis')
            .update({ analysis_text: analysis })
            .eq('id', existing.id);

          if (updateError) {
            console.error(`[AI Cache UPDATE ERROR] ${ticker}:`, updateError);
          } else {
            console.log(`[AI Cache UPDATED] ${ticker} for ${today}`);
          }
        } else {
          // Insert new record
          const { error: insertError } = await supabase
            .from('ai_analysis')
            .insert({
              ticker,
              analysis_date: today,
              analysis_text: analysis
            });

          if (insertError) {
            console.error(`[AI Cache INSERT ERROR] ${ticker}:`, insertError);
          } else {
            console.log(`[AI Cache INSERTED] ${ticker} for ${today}`);
          }
        }
      } catch (e) {
        console.error(`[AI Cache Save Exception] ${ticker}:`, e.message, e.stack);
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