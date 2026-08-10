-- ============================================================================
-- MIGRATION 004: Schema Synchronization & Dead Table Cleanup
-- Universal Expense Tracker
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. DROP DEAD TABLES (From removed modules: Cookmate, Trading, Radar, AI Assistant)
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS radar_sources CASCADE;
DROP TABLE IF EXISTS trade_items CASCADE;
DROP TABLE IF EXISTS trading_logs CASCADE;
DROP TABLE IF EXISTS cookmate_pantry CASCADE;
DROP TABLE IF EXISTS cookmate_recipes CASCADE;
DROP TABLE IF EXISTS ai_assistant_chats CASCADE;
DROP TABLE IF EXISTS ai_assistant_messages CASCADE;

-- ----------------------------------------------------------------------------
-- 2. UPDATE RECURRING COSTS TABLE (subscriptions)
-- Supports Paid/Pending monthly tracking ('last_paid_month') and groupings ('subscription', 'fixed_bill', 'utility')
-- ----------------------------------------------------------------------------
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS last_paid_month VARCHAR(10) DEFAULT NULL;

-- Ensure type column exists and has sufficient length for all grouping types
ALTER TABLE subscriptions 
ALTER COLUMN type TYPE VARCHAR(50);

-- ----------------------------------------------------------------------------
-- 3. VALIDATE TRANSACTIONS TABLE SCHEMA
-- Ensure all columns expected by Statement Import parser & velocity calculations exist
-- ----------------------------------------------------------------------------
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS note TEXT;

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'cleared';

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS is_claimable BOOLEAN DEFAULT false;

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS claim_status VARCHAR(50) DEFAULT 'none';

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS exclude_from_velocity BOOLEAN DEFAULT NULL;

-- ----------------------------------------------------------------------------
-- 4. PERFORMANCE INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_type ON subscriptions (user_id, type);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions (user_id, date DESC);
