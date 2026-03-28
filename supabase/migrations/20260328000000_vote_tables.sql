-- Vote system tables for v0.4.0
-- Creates votes and vote_ideas tables with Row Level Security

-- Create votes table
CREATE TABLE votes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    caller_id text NOT NULL,
    channel_id text NOT NULL,
    message_ts text NOT NULL,
    emoji text NOT NULL DEFAULT 'white_check_mark',
    max_winners integer NOT NULL DEFAULT 1,
    expires_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Create vote_ideas junction table
CREATE TABLE vote_ideas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vote_id uuid NOT NULL REFERENCES votes(id) ON DELETE CASCADE,
    idea_id uuid NOT NULL REFERENCES open_ideas(id),
    UNIQUE(vote_id, idea_id)
);

-- Enable Row Level Security on both tables
-- No policies = default deny for the anon key.
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vote_ideas ENABLE ROW LEVEL SECURITY;
