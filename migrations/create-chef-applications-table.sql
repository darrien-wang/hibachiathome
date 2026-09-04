-- Chef / apprentice applications submitted from /jobs.
--
-- WHY a separate table instead of reusing `leads`: a lead is someone who might
-- buy an event; an applicant is someone who might cook one. They are scored on
-- different fields, worked by a different funnel, and mixing them would put
-- applicants into customer-facing follow-up sequences.
--
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS chef_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name              TEXT NOT NULL,
  phone             TEXT NOT NULL,
  email             TEXT,

  -- Proximity to the Rowland Heights pickup point is what actually drives a
  -- chef's hourly, so this is the first thing we sort on.
  city_or_zip       TEXT NOT NULL,

  has_car           BOOLEAN NOT NULL DEFAULT FALSE,
  vehicle           TEXT,

  -- Which weekend days they can work, e.g. {"fri","sat","sun"}.
  availability      TEXT[] NOT NULL DEFAULT '{}',

  experience        TEXT,
  accepts_terms     BOOLEAN NOT NULL DEFAULT FALSE,
  earliest_start    TEXT,

  -- Which language the applicant read the page in: zh | en | es. Tells us which
  -- channel is producing people, and which language to answer them in.
  locale            TEXT NOT NULL DEFAULT 'zh',
  source_page       TEXT,

  -- Set by hand once the applicant texts in the three scripted lines.
  voice_received    BOOLEAN NOT NULL DEFAULT FALSE,

  -- new | screened | shadowing | cleared | rejected
  status            TEXT NOT NULL DEFAULT 'new',
  notes             TEXT,

  raw_payload       JSONB,
  created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chef_applications_created_at ON chef_applications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chef_applications_status ON chef_applications (status);
CREATE INDEX IF NOT EXISTS idx_chef_applications_city ON chef_applications (city_or_zip);

-- Deny anon/authenticated by default. The API route writes with the service
-- role key, which bypasses RLS. Same posture as every other table here; see
-- enable-row-level-security.sql for the reasoning.
ALTER TABLE chef_applications ENABLE ROW LEVEL SECURITY;
