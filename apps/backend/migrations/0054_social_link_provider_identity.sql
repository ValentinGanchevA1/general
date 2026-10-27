-- 0054_social_link_provider_identity.sql
-- Bind OAuth-linked profiles to the provider's stable account id.
-- Existing links remain valid and receive provider_user_id on the next successful relink.

ALTER TABLE social_links
  ADD COLUMN IF NOT EXISTS provider_user_id text;

-- A single external account may support only one NEXA identity per provider.
-- Partial index keeps legacy rows with no provider id migratable without blocking deploys.
CREATE UNIQUE INDEX IF NOT EXISTS social_links_provider_identity_uidx
  ON social_links (provider, provider_user_id)
  WHERE provider_user_id IS NOT NULL;
