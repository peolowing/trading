-- Cleanup script - Kör detta INNAN testdata om du vill börja om från noll
-- Detta tar bort ENDAST testdata-positionerna (de 8 specifika tickers)

-- Ta bort events för testdata-positionerna
DELETE FROM portfolio_events
WHERE ticker IN (
  'VOLV-B.ST', 'AAPL', 'MSFT', 'TSLA', 'NVDA', 'GOOGL', 'META', 'AMZN'
);

-- Ta bort testdata-positionerna
DELETE FROM portfolio
WHERE ticker IN (
  'VOLV-B.ST', 'AAPL', 'MSFT', 'TSLA', 'NVDA', 'GOOGL', 'META', 'AMZN'
)
AND exit_status = 'EXITED';

-- Visa resultat
SELECT 'Cleanup klar!' AS status;
