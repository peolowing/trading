import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY
);

// Definiera aktier med deras bucket-klassificering
const STOCKS = [
  // Large-cap (~20) - Typiskt >50M SEK/dag i omsättning
  { ticker: "VOLV-B.ST", bucket: "LARGE_CAP" },
  { ticker: "ATCO-A.ST", bucket: "LARGE_CAP" },
  { ticker: "ATCO-B.ST", bucket: "LARGE_CAP" },
  { ticker: "SAND.ST", bucket: "LARGE_CAP" },
  { ticker: "ABB.ST", bucket: "LARGE_CAP" },
  { ticker: "ASSA-B.ST", bucket: "LARGE_CAP" },
  { ticker: "ERIC-B.ST", bucket: "LARGE_CAP" },
  { ticker: "HM-B.ST", bucket: "LARGE_CAP" },
  { ticker: "ALIV-SDB.ST", bucket: "LARGE_CAP" },
  { ticker: "SEB-A.ST", bucket: "LARGE_CAP" },
  { ticker: "SWED-A.ST", bucket: "LARGE_CAP" },
  { ticker: "SHB-A.ST", bucket: "LARGE_CAP" },
  { ticker: "NDA-SE.ST", bucket: "LARGE_CAP" },
  { ticker: "INVE-A.ST", bucket: "LARGE_CAP" },
  { ticker: "INVE-B.ST", bucket: "LARGE_CAP" },
  { ticker: "KINV-B.ST", bucket: "LARGE_CAP" },
  { ticker: "SKF-B.ST", bucket: "LARGE_CAP" },
  { ticker: "SSAB-A.ST", bucket: "LARGE_CAP" },
  { ticker: "BOL.ST", bucket: "LARGE_CAP" },
  { ticker: "TELIA.ST", bucket: "LARGE_CAP" },

  // Mid-cap (~20) - Typiskt 15-50M SEK/dag i omsättning
  { ticker: "ESSITY-B.ST", bucket: "MID_CAP" },
  { ticker: "ELUX-B.ST", bucket: "MID_CAP" },
  { ticker: "NIBE-B.ST", bucket: "MID_CAP" },
  { ticker: "ALFA.ST", bucket: "MID_CAP" },
  { ticker: "GETI-B.ST", bucket: "MID_CAP" },
  { ticker: "EPI-B.ST", bucket: "MID_CAP" },
  { ticker: "HUSQ-B.ST", bucket: "MID_CAP" },
  { ticker: "INDU-A.ST", bucket: "MID_CAP" },
  { ticker: "LUND-B.ST", bucket: "MID_CAP" },
  { ticker: "SECU-B.ST", bucket: "MID_CAP" },
  { ticker: "AXFO.ST", bucket: "MID_CAP" },
  { ticker: "CAST.ST", bucket: "MID_CAP" },
  { ticker: "FABG.ST", bucket: "MID_CAP" },
  { ticker: "HEBA-B.ST", bucket: "MID_CAP" },
  { ticker: "LIFCO-B.ST", bucket: "MID_CAP" },
  { ticker: "LOOMIS.ST", bucket: "MID_CAP" },
  { ticker: "NCC-B.ST", bucket: "MID_CAP" },
  { ticker: "PEAB-B.ST", bucket: "MID_CAP" },
  { ticker: "SWEC-B.ST", bucket: "MID_CAP" },
  { ticker: "TREL-B.ST", bucket: "MID_CAP" }
];

async function updateScreener() {
  console.log(`Uppdaterar screener med ${STOCKS.length} aktier...`);

  // Rensa gamla
  const { error: deleteError } = await supabase
    .from('screener_stocks')
    .delete()
    .neq('ticker', '');

  if (deleteError) {
    console.error('❌ Delete error:', deleteError);
    return;
  }

  console.log('✓ Rensade gamla aktier');

  // Lägg till nya med bucket-klassificering
  const rows = STOCKS.map(stock => ({
    ticker: stock.ticker,
    bucket: stock.bucket
  }));

  const { data, error } = await supabase
    .from('screener_stocks')
    .insert(rows);

  if (error) {
    console.error('❌ Insert error:', error);
    console.error('   Om kolumnen "bucket" inte finns, kör först:');
    console.log('   ALTER TABLE screener_stocks ADD COLUMN bucket TEXT;');
    return;
  }

  const largeCap = STOCKS.filter(s => s.bucket === 'LARGE_CAP').length;
  const midCap = STOCKS.filter(s => s.bucket === 'MID_CAP').length;

  console.log(`✓ Lade till ${STOCKS.length} aktier i screener`);
  console.log('\n📊 Fördelning:');
  console.log(`  Large-cap: ${largeCap}`);
  console.log(`  Mid-cap:   ${midCap}`);
  console.log(`  Totalt:    ${STOCKS.length}`);
}

updateScreener()
  .then(() => {
    console.log('\n✅ Klart!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Fel:', err);
    process.exit(1);
  });
