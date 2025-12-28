-- ========================================
-- Rensa AI-analys Cache
-- ========================================
--
-- Använd detta för att tvinga fram nya svenska AI-analyser
-- istället för att använda cachade analyser som kan vara på engelska
--
-- INSTRUKTIONER:
-- 1. Öppna Supabase Dashboard
-- 2. Gå till SQL Editor
-- 3. Kör detta script
--
-- ========================================

-- Alternativ 1: Rensa endast dagens analyser
DELETE FROM ai_analysis WHERE analysis_date = CURRENT_DATE;

-- Alternativ 2: Rensa ALLA gamla analyser (om du vill börja om)
-- DELETE FROM ai_analysis;

-- Verifiera att tabellen är tom
SELECT COUNT(*) as remaining_analyses FROM ai_analysis;
