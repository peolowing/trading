# Portfolio Analysis API

## Endpoint

**POST** `/api/portfolio/analyze/:ticker`

Analyserar en aktiv portfolioposition mot regelbaserade swing trading-principer.

## Request

### URL Parameters
- `ticker` (string, required) - Stock ticker symbol (t.ex. "ABB.ST")

### Body
```json
{
  "currentPrice": 705.50
}
```

## Response

### Success (200)
```json
{
  "analysis": "📊 Aktuell nivå: Nivå 1...\n\n💡 Stop-rekommendation: Behåll 671.89 kr...",
  "metrics": {
    "currentR": "0.82",
    "daysInTrade": 5,
    "distanceToTarget": "21.91",
    "distanceToStop": "33.61",
    "targetPrice": "727.41",
    "rValue": "18.51"
  },
  "timestamp": "2026-01-12T15:30:00.000Z"
}
```

### Error Responses

**404 Not Found** - Position finns inte
```json
{
  "error": "Position not found"
}
```

**400 Bad Request** - Current price saknas
```json
{
  "error": "Current price required"
}
```

**503 Service Unavailable** - OpenAI inte konfigurerad
```json
{
  "error": "OpenAI not configured"
}
```

## Exempel

### cURL
```bash
curl -X POST http://localhost:3002/api/portfolio/analyze/ABB.ST \
  -H "Content-Type: application/json" \
  -d '{"currentPrice": 705.50}'
```

### JavaScript
```javascript
const response = await fetch('/api/portfolio/analyze/ABB.ST', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ currentPrice: 705.50 })
});

const { analysis, metrics } = await response.json();
console.log(analysis);
```

## Regelbaserad Logik

AI:n analyserar positionen mot:

### Stop-flytt-schema (5 nivåer)
- **Nivå 0:** Initialt läge (ingen åtgärd)
- **Nivå 1:** +0.5R till +1R (observation)
- **Nivå 2:** ≥+1R (flytta till break-even)
- **Nivå 3:** Strukturell trend (trailing stop)
- **Nivå 4:** Target-zon (exit-beslut)

### Tidsgränser (time stops)
- **3-5 dagar:** Early warning
- **8-12 dagar:** Operativ time stop
- **15-20 dagar:** Absolut maxgräns

## Metrics Förklaring

| Metric | Beskrivning | Exempel |
|--------|-------------|---------|
| `currentR` | Vinst i R-enheter | "0.82" = +82% av initial risk |
| `daysInTrade` | Antal dagar sedan entry | 5 |
| `distanceToTarget` | Kr till target | "21.91" kr |
| `distanceToStop` | Kr till current stop | "33.61" kr |
| `targetPrice` | Beräknat target (2R) | "727.41" kr |
| `rValue` | Initial risk (1R) | "18.51" kr |

## AI-Konfiguration

- **Model:** gpt-4o
- **Temperature:** 0.3 (låg kreativitet, hög precision)
- **Max tokens:** 1500
- **System role:** Strikt regelbaserad rådgivare

## Dependencies

- `openai` package
- `OPENAI_API_KEY` i miljövariabler
- Supabase portfolio table med följande kolumner:
  - `ticker`, `entry_price`, `entry_date`
  - `initial_stop`, `current_stop`, `initial_target`
  - `initial_r`, `quantity`
  - `entry_setup`, `entry_rationale`

## Rate Limiting

- OpenAI API har rate limits
- Rekommenderad max: 1 analys per position per minut
- För batch-analyser: implementera queuing

## Kostnad

Varje analys:
- ~1500 input tokens
- ~800 output tokens
- ≈ $0.02 per analys (gpt-4o pricing)

## Säkerhet

⚠️ **Viktigt:**
- Validera `currentPrice` på client-side
- Rate-limit requests per user/IP
- Log alla analyser för audit trail
- Sanitize ticker input (SQL injection prevention)

## Se även

- [Full dokumentation](../docs/PORTFOLIO_AI_ANALYSIS.md)
- [Stop-flytt-regler](../docs/STOP_MANAGEMENT_RULES.md)
