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

CREATE POLICY "Strict isolation mapping for Goals" ON goals
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Strict isolation mapping for Subscriptions" ON subscriptions
    FOR ALL USING (auth.uid() = user_id);
