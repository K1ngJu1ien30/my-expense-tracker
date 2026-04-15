-- Supabase Schema Generation for Universal Tracker
-- Setup securely enforcing RLS boundaries against native UUIDs.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Transactions Tracker
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    type VARCHAR(50) NOT NULL,
    category VARCHAR(255),
    sub_category VARCHAR(255),
    account VARCHAR(255),
    to_account VARCHAR(255),
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Goals Tracking Loop
CREATE TABLE goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    current_amount DECIMAL(12,2) DEFAULT 0,
    target_amount DECIMAL(12,2) NOT NULL,
    is_pinned BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Advanced Subscription Matrices
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    billing_day INTEGER,
    source_account VARCHAR(255),
    auto_deduct BOOLEAN DEFAULT true,
    type VARCHAR(50) NOT NULL, -- 'subscription' vs 'utility'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Secure Row Level Security Bounds
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Native UUID Verification Policies
CREATE POLICY "Strict isolation mapping for Transactions" ON transactions
    FOR ALL USING (auth.uid() = user_id);

-- Add status column for pending/cleared income tracking
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'cleared' CHECK (status IN ('cleared', 'pending'));

-- Add claimable/split bill columns
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_claimable BOOLEAN DEFAULT false;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS claim_status TEXT DEFAULT 'none' CHECK (claim_status IN ('none', 'pending', 'cleared'));

CREATE POLICY "Strict isolation mapping for Goals" ON goals
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Strict isolation mapping for Subscriptions" ON subscriptions
    FOR ALL USING (auth.uid() = user_id);

-- 4. Salary Planner
CREATE TABLE salary_planner (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    category VARCHAR(255),
    item_name VARCHAR(255) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE salary_planner ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Strict isolation mapping for Salary Planner" ON salary_planner
    FOR ALL USING (auth.uid() = user_id);

-- 5. Asset Vault
CREATE TABLE asset_vault (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(255),
    emoji_icon TEXT DEFAULT '📦',
    purchase_date DATE,
    purchase_price DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE asset_vault ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Strict isolation mapping for Asset Vault" ON asset_vault
    FOR ALL USING (auth.uid() = user_id);

-- 6. Asset Maintenance Logs
CREATE TABLE asset_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID REFERENCES asset_vault(id) ON DELETE CASCADE,
    log_date DATE DEFAULT CURRENT_DATE,
    description TEXT NOT NULL,
    cost DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE asset_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Strict isolation mapping for Asset Logs" ON asset_logs
    FOR ALL USING (
        EXISTS (SELECT 1 FROM asset_vault WHERE asset_vault.id = asset_logs.asset_id AND asset_vault.user_id = auth.uid())
    );

-- 7. Radar Sources
CREATE TABLE radar_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL CHECK (source_type IN ('rss', 'tmdb_cinema', 'tmdb_streaming')),
    name VARCHAR(255) NOT NULL,
    url TEXT,
    keywords TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE radar_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Strict isolation mapping for Radar Sources" ON radar_sources
    FOR ALL USING (auth.uid() = user_id);

-- 8. Trade Items (Flipping/Trading Module)
CREATE TABLE trade_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    buy_price DECIMAL(12,2) NOT NULL,
    sell_price DECIMAL(12,2),
    status TEXT NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'sold')),
    date_acquired TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    date_sold TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE trade_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Strict isolation mapping for Trade Items" ON trade_items
    FOR ALL USING (auth.uid() = user_id);
