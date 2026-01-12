/**
 * Portfolio Position Analysis API
 * AI-driven analysis for stop management and time-based decisions
 */

import OpenAI from 'openai';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const STOP_MANAGEMENT_RULES = `
# STOP-FLYTT-SCHEMA (regelbok)

## 🔒 Nivå 0 – INITIALT LÄGE
**Villkor:** Priset mellan initial stop och ~entry + 0.5R, ingen ny struktur
**Åtgärd:** Stop = initial stop, INGEN flytt, INGEN delvinst

## 🟡 Nivå 1 – Tidig rörelse (+0.5R till +1R)
**Villkor:** Pris når +0.5R till +1R
**Åtgärd:** Stop FLYTTAS INTE, ingen vinst tas, endast observation

## 🟢 Nivå 2 – Första BEKRÄFTADE styrkan
**Trigger:** Dagstängning ≥ Entry + 1R ELLER högre high + tydlig rekyl + ny högre botten
**Åtgärd:** Flytta stop till break-even (entry-pris) eller entry + liten buffert

## 🔵 Nivå 3 – Strukturell trend etablerad
**Trigger:** Nytt högre high + kontrollerad rekyl + nytt högre swing-low
**Åtgärd:** Flytta stop till under senaste swing-low

## 🟣 Nivå 4 – Target-zon (≥2R)
**Trigger:** Pris ≥ target
**Åtgärd:** Mekanisk exit ELLER ta 50% + trailing stop

# TIDSGRÄNSER (time stops)

## 🟡 Nivå 1 – Early warning (3-5 dagar)
**Fråga:** Har aktien gjort något som bekräftar idén?
**Åtgärd:** Markera som svag i journal om NEJ

## 🟠 Nivå 2 – Operativ time stop (8-12 dagar)
**Villkor:** Priset har INTE nått ≥ +1R eller skapat ny struktur
**Åtgärd:** Exit vid nästa rimliga tillfälle

## 🔴 Nivå 3 – Absolut maxgräns (15-20 dagar)
**Åtgärd:** Exit oavsett P/L

# KÄRNREGEL
❌ Flytta ALDRIG stop uppåt utan: ny struktur ELLER tydlig regel (1R, BE, swing-low)
`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!openai) {
    return res.status(503).json({ error: 'OpenAI not configured' });
  }

  try {
    const { position, currentPrice, daysInTrade } = req.body;

    if (!position || !currentPrice) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Calculate key metrics
    const rValue = position.initial_r || (position.entry_price - position.initial_stop);
    const currentR = (currentPrice - position.entry_price) / rValue;
    const targetPrice = position.initial_target || (position.entry_price + (2 * rValue));
    const distanceToTarget = targetPrice - currentPrice;
    const distanceToStop = currentPrice - position.current_stop;

    // Build analysis prompt
    const prompt = `Du är en professionell swing trading-rådgivare. Analysera följande position och ge KONKRET vägledning enligt reglerna.

# POSITION
- Ticker: ${position.ticker}
- Entry: ${position.entry_price.toFixed(2)} kr
- Entry-datum: ${position.entry_date}
- Dagar i trade: ${daysInTrade || 0}
- Initial stop: ${position.initial_stop.toFixed(2)} kr
- Current stop: ${position.current_stop.toFixed(2)} kr
- Target: ${targetPrice.toFixed(2)} kr
- 1R (risk): ${rValue.toFixed(2)} kr
- Nuvarande pris: ${currentPrice.toFixed(2)} kr
- Nuvarande P/L: ${currentR.toFixed(2)}R (${((currentR * rValue) * position.quantity).toFixed(0)} kr)
- Entry setup: ${position.entry_setup || 'N/A'}
- Entry rationale: ${position.entry_rationale || 'N/A'}

# REGLER
${STOP_MANAGEMENT_RULES}

# UPPGIFT
Analysera positionen och ge:
1. **Aktuell nivå** (0-4) enligt stop-schemat
2. **Stop-rekommendation** (exakt pris eller "behåll")
3. **Time stop-status** (grön/gul/röd baserat på dagar + framsteg)
4. **Konkret åtgärd** (gör detta NU)
5. **Nästa trigger** (när ska du ompröva?)
6. **Riskbedömning** (vad kan gå fel?)

Var MEKANISK och SPECIFIK. Ingen fluff. Ge exakta priser och datum.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Du är en strikt, regelbaserad swing trading-rådgivare som ger konkreta, testbara rekommendationer. Använd BARA reglerna som ges. Ingen subjektiv tolkning.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 1500
    });

    const analysis = completion.choices[0].message.content;

    return res.json({
      analysis,
      metrics: {
        currentR: currentR.toFixed(2),
        daysInTrade: daysInTrade || 0,
        distanceToTarget: distanceToTarget.toFixed(2),
        distanceToStop: distanceToStop.toFixed(2),
        targetPrice: targetPrice.toFixed(2)
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Portfolio analysis error:', error);
    return res.status(500).json({ error: 'Analysis failed' });
  }
}
