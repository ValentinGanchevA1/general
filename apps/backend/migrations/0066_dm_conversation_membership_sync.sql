-- 0066_dm_conversation_membership_sync.sql
-- Keep the normalized conversation_members table complete for DMs created after
-- 0038. Current runtime authorization remains participant_ids-based; this
-- invariant prepares a trustworthy membership source for future group chat.

CREATE OR REPLACE FUNCTION sync_dm_conversation_members()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.kind <> 'dm' THEN
    RETURN NEW;
  END IF;

  IF array_length(NEW.participant_ids, 1) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'DM conversation % must contain exactly two participants', NEW.id
      USING ERRCODE = 'check_violation';
  END IF;

  -- A DM's active normalized membership must exactly mirror participant_ids.
  -- Preserve historical rows by soft-leaving any stale active member.
  UPDATE conversation_members
     SET left_at = NOW()
   WHERE conversation_id = NEW.id
     AND left_at IS NULL
     AND NOT (user_id = ANY(NEW.participant_ids));

  -- Idempotently insert/reactivate both members. Do not overwrite role, muted,
  -- joined_at or read state for rows that already exist.
  INSERT INTO conversation_members (conversation_id, user_id, role, joined_at, left_at)
  SELECT NEW.id, participant_id, 'member', NEW.created_at, NULL
    FROM unnest(NEW.participant_ids) AS participant_id
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET left_at = NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_dm_conversation_members ON conversations;
CREATE TRIGGER trg_sync_dm_conversation_members
AFTER INSERT OR UPDATE OF participant_ids, kind ON conversations
FOR EACH ROW
EXECUTE FUNCTION sync_dm_conversation_members();

-- Repair rows created after migration 0038 (or otherwise missing from the
-- normalized mirror) before the trigger existed.
UPDATE conversation_members cm
   SET left_at = NOW()
  FROM conversations c
 WHERE c.id = cm.conversation_id
   AND c.kind = 'dm'
   AND array_length(c.participant_ids, 1) = 2
   AND cm.left_at IS NULL
   AND NOT (cm.user_id = ANY(c.participant_ids));

INSERT INTO conversation_members (conversation_id, user_id, role, joined_at, left_at)
SELECT c.id, participant_id, 'member', c.created_at, NULL
  FROM conversations c
 CROSS JOIN LATERAL unnest(c.participant_ids) AS participant_id
 WHERE c.kind = 'dm'
   AND array_length(c.participant_ids, 1) = 2
ON CONFLICT (conversation_id, user_id)
DO UPDATE SET left_at = NULL;
