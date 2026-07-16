-- Migration 0005: Add onboarding lifecycle and category protection columns to preferences table

ALTER TABLE preferences ADD COLUMN IF NOT EXISTS onboarding_step TEXT DEFAULT 'welcome';
ALTER TABLE preferences ADD COLUMN IF NOT EXISTS has_completed_onboarding BOOLEAN DEFAULT FALSE;
ALTER TABLE preferences ADD COLUMN IF NOT EXISTS protected_categories JSONB DEFAULT '[]'::jsonb;
