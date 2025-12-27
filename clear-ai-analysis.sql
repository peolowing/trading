-- Script to clear old AI analyses so new ones with improved format will be generated
-- Run this in your Supabase SQL editor

DELETE FROM ai_analysis;

-- This will force the system to regenerate all AI analyses with the new format
-- featuring clear headers and better structure
