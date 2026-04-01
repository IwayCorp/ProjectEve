-- Project Eve - Supabase Schema
-- Run this in your Supabase SQL Editor to set up the database

-- Trade Ideas table (persists trade setups)
CREATE TABLE IF NOT EXISTS trade_ideas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticker TEXT NOT NULL,
  name TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('long', 'short')),
  entry_low NUMERIC NOT NULL,
  entry_high NUMERIC NOT NULL,
  target NUMERIC NOT NULL,
  stop_loss NUMERIC NOT NULL,
  rsi NUMERIC,
  risk TEXT CHECK (risk IN ('LOW', 'MEDIUM', 'HIGH')),
  thesis TEXT,
  catalyst TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'triggered', 'target_hit', 'stopped', 'expired', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alerts log
CREATE TABLE IF NOT EXISTS alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trade_id UUID REFERENCES trade_ideas(id),
  ticker TEXT NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('entry_zone', 'target_hit', 'stop_hit', 'custom')),
  price NUMERIC NOT NULL,
  message TEXT,
  acknowledged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Correlation snapshots (for tracking anomalies over time)
CREATE TABLE IF NOT EXISTS correlation_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pair_label TEXT NOT NULL,
  symbol_a TEXT NOT NULL,
  symbol_b TEXT NOT NULL,
  correlation NUMERIC,
  is_anomaly BOOLEAN DEFAULT FALSE,
  snapshot_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Market notes / journal
CREATE TABLE IF NOT EXISTS market_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Risk events
CREATE TABLE IF NOT EXISTS risk_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_date DATE NOT NULL,
  event_name TEXT NOT NULL,
  impact_assets TEXT,
  volatility_estimate TEXT CHECK (volatility_estimate IN ('LOW', 'MEDIUM', 'HIGH', 'EXTREME')),
  prep_action TEXT,
  outcome TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE trade_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE correlation_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_events ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (single user)
-- In production, add proper auth-based policies
CREATE POLICY "Allow all" ON trade_ideas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON alerts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON correlation_snapshots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON market_notes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON risk_events FOR ALL USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_trade_ideas_status ON trade_ideas(status);
CREATE INDEX idx_trade_ideas_ticker ON trade_ideas(ticker);
CREATE INDEX idx_alerts_ticker ON alerts(ticker);
CREATE INDEX idx_alerts_unack ON alerts(acknowledged) WHERE acknowledged = FALSE;
CREATE INDEX idx_correlation_date ON correlation_snapshots(snapshot_date);
