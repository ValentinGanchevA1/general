-- 0067_group_conversation_legacy_participant_isolation.sql
-- Group membership is authoritative only in conversation_members. The legacy
-- conversations.participant_ids array remains a DM compatibility key and must
-- never carry group membership, because older DM-only flows still inspect it.

-- Normalize any prep/test group rows created before this invariant existed.
UPDATE conversations
   SET participant_ids = ARRAY[]::uuid[]
 WHERE kind = 'group'
   AND cardinality(participant_ids) <> 0;

ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS conversations_group_participant_ids_empty_check;

ALTER TABLE conversations
  ADD CONSTRAINT conversations_group_participant_ids_empty_check
  CHECK (kind <> 'group' OR cardinality(participant_ids) = 0);
