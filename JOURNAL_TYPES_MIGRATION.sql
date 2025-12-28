-- Migration: Add journal entry types to trades table
-- Date: 2025-12-28
-- Purpose: Allow observation, decision, emotion, lesson, mistake as valid trade types

-- Drop existing check constraint on trades.type
ALTER TABLE trades DROP CONSTRAINT IF EXISTS trades_type_check;

-- Add new check constraint with expanded allowed values
ALTER TABLE trades ADD CONSTRAINT trades_type_check
  CHECK (type IN (
    -- Original trade types
    'long', 'short',
    -- Journal entry types
    'observation', 'decision', 'emotion', 'lesson', 'mistake'
  ));

-- Verify the constraint
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'trades'::regclass AND conname = 'trades_type_check';
