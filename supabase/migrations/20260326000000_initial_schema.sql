-- Initial schema for hacky-hours-bot
-- Creates open_ideas and closed_ideas tables with Row Level Security

-- Create open_ideas table
CREATE TABLE open_ideas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    submitter_id text NOT NULL,
    description text NOT NULL,
    features text DEFAULT '',
    submitted_at timestamptz NOT NULL DEFAULT now()
);

-- Create closed_ideas table
CREATE TABLE closed_ideas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    submitter_id text NOT NULL,
    description text NOT NULL,
    features text DEFAULT '',
    submitted_at timestamptz NOT NULL,
    picked_by text NOT NULL,
    picked_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security on both tables
-- No policies = default deny for the anon key.
-- The service_role key (used by Edge Functions) bypasses RLS by design.
ALTER TABLE open_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE closed_ideas ENABLE ROW LEVEL SECURITY;
