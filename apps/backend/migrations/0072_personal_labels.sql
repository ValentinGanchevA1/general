-- Feature-gated Personal Labels. No user profile, interests, or discovery tables modified.
-- Safe to apply with NEXA_PERSONAL_LABELS_ENABLED unset / false.
CREATE TABLE IF NOT EXISTS personal_labels (
  key text PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9_]{2,30}$'),
  label_bg text NOT NULL CHECK (char_length(label_bg) BETWEEN 2 AND 40),
  label_en text NOT NULL CHECK (char_length(label_en) BETWEEN 2 AND 40),
  category text NOT NULL CHECK (category IN ('character','social_style','vibe','humor','rhythm','values')),
  emoji text CHECK (char_length(emoji) <= 8),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS personal_labels_bg_unique ON personal_labels (lower(label_bg));
CREATE UNIQUE INDEX IF NOT EXISTS personal_labels_en_unique ON personal_labels (lower(label_en));

CREATE TABLE IF NOT EXISTS user_personal_labels (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label_key text NOT NULL REFERENCES personal_labels(key) ON DELETE RESTRICT,
  position smallint NOT NULL CHECK (position BETWEEN 0 AND 4),
  PRIMARY KEY (user_id, label_key),
  UNIQUE (user_id, position)
);
CREATE INDEX IF NOT EXISTS user_personal_labels_key_idx ON user_personal_labels (label_key);

CREATE TABLE IF NOT EXISTS personal_label_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  proposed_text text NOT NULL CHECK (char_length(proposed_text) BETWEEN 3 AND 40),
  normalized_text text NOT NULL CHECK (char_length(normalized_text) BETWEEN 3 AND 40),
  locale text NOT NULL CHECK (locale IN ('bg','en')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','merged')),
  resulting_key text REFERENCES personal_labels(key) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text CHECK (char_length(review_note) <= 300),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX IF NOT EXISTS personal_label_proposals_pending_unique
  ON personal_label_proposals (locale, normalized_text) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS personal_label_proposals_queue_idx
  ON personal_label_proposals (status, created_at, id);
CREATE INDEX IF NOT EXISTS personal_label_proposals_user_idx
  ON personal_label_proposals (user_id, created_at DESC);

INSERT INTO personal_labels(key,label_bg,label_en,category,emoji) VALUES
 ('night_owl','Нощна сова','Night owl','rhythm','🌙'),
 ('sarcastic','Саркастичен','Sarcastic','humor','😏'),
 ('good_listener','Добър слушател','Good listener','social_style','💬'),
 ('spontaneous','Спонтанен','Spontaneous','character','⚡')
ON CONFLICT (key) DO NOTHING;
