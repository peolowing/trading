# AI-Analys Uppdatering och Tidzon

## Nuvarande Beteende

### När uppdateras AI-analysen?

AI-analysen uppdateras **on-demand** (när användaren begär den), INTE enligt ett schema.

**Uppdateringsprocess:**
1. Användaren klickar på en aktie i Dashboard
2. Frontend anropar `POST /api/ai-analysis` med ticker + indicators
3. Backend kollar om det finns en cached analys för `today`:
   ```javascript
   const today = dayjs().format('YYYY-MM-DD');
   const cached = await supabase
     .from('ai_analysis')
     .select('*')
     .eq('ticker', ticker)
     .eq('analysis_date', today)
     .maybeSingle();
   ```
4. **OM cached finns** → Returnera cached analys (snabbt, gratis)
5. **OM cached INTE finns** → Anropa OpenAI, spara ny analys, returnera

### Vilket datum/tidzon används?

**Vercel Serverless Functions:**
- Körs i **UTC-tidzon** som standard
- `dayjs()` utan timezone-plugin använder server-tid (UTC)
- **PROBLEM:** När klockan är 01:00 svensk tid (00:00 UTC) får du en ny analys, men svenska börsen har inte öppnat än!

**Exempel:**
```
Svensk tid: 2025-12-31 01:00 (tisdag morgon)
UTC tid:     2025-12-31 00:00 (tisdag morgon)
AI datum:    2025-12-31 (nytt datum!)

Men svenska börsen stänger inte förrän 17:30 måndag (2025-12-30)!
```

## Problem

1. **Analysen uppdateras mitt i natten svensk tid** (00:00 UTC = 01:00 svensk vintertid)
2. **Ingen automatisk uppdatering** - användaren måste själv begära analysen
3. **Ingen scheduler** - ingen background job som uppdaterar alla aktier automatiskt

## Lösningar

### Alternativ 1: Använd Svensk Tidzon (Enklast)

Uppdatera `api/ai-analysis.js` för att använda svensk tid:

```javascript
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

// I handler-funktionen:
const today = dayjs().tz('Europe/Stockholm').format('YYYY-MM-DD');
```

**Resultat:**
- Ny analys genereras efter midnatt svensk tid
- Analyserar data från rätt handelsdag

### Alternativ 2: Använd Börsdatum Istället

Använd "senaste handelsdagen" istället för kalenderdag:

```javascript
function getTradingDate() {
  const now = dayjs().tz('Europe/Stockholm');
  const hour = now.hour();
  
  // Om före 09:00, använd gårdagens datum
  if (hour < 9) {
    return now.subtract(1, 'day').format('YYYY-MM-DD');
  }
  
  return now.format('YYYY-MM-DD');
}
```

**Resultat:**
- Analysen väntar till börsen öppnar (09:00)
- Mer korrekt för trading

### Alternativ 3: Scheduled Background Job (Bäst men mer komplext)

Använd Vercel Cron Jobs för att uppdatera analyser automatiskt:

**vercel.json:**
```json
{
  "crons": [{
    "path": "/api/cron/update-analyses",
    "schedule": "0 18 * * 1-5"
  }]
}
```

**api/cron/update-analyses.js:**
```javascript
export default async function handler(req, res) {
  // Verify cron secret
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Hämta alla aktier från screener_stocks
  const { data: stocks } = await supabase
    .from('screener_stocks')
    .select('ticker')
    .eq('is_active', true);

  // Uppdatera analys för varje aktie
  for (const stock of stocks) {
    // Anropa /api/analyze och /api/ai-analysis
    // ...
  }

  return res.json({ updated: stocks.length });
}
```

**Körs:**
- Kl 18:00 UTC = 19:00 svensk vintertid / 20:00 sommartid
- Måndag-Fredag
- Efter börsens stängning (17:30)

## Nuvarande Situation

**Tidzon:** UTC (Vercel default)
**Uppdatering:** On-demand när användare klickar
**Cache:** Per datum (`YYYY-MM-DD`)
**Problem:** Ny analys skapas 00:00 UTC (01:00 svensk tid) trots att börsen inte öppnat

## Rekommendation

**För bästa användarupplevelse:**

1. **Kortsiktig fix:** Lägg till svensk tidzon (Alternativ 1)
2. **Långsiktig lösning:** Implementera cron job (Alternativ 3)

**Implementera:**
```bash
npm install dayjs
```

Uppdatera `api/ai-analysis.js` och `repositories/ai-analysis.repository.js` för att använda `Europe/Stockholm` tidzon.
