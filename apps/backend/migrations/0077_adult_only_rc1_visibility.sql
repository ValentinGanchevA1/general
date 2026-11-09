-- RC1 safety hardening. Existing accounts without a declared adult birthday
-- must not retain PUBLIC map/social visibility when NEXUS switches to 18+.
-- Runs once in the controlled migration chain, after 0076. This does not
-- erase the account or remove safe report/delete/profile-privacy controls.
-- Future OAuth accounts are created private until adult eligibility is checked.
-- Review row count and staging/rollback plan before applying to production.
UPDATE users
   SET visibility = 'private',
       open_to_dating = false,
       updated_at = clock_timestamp()
 WHERE deleted_at IS NULL
   AND (
     date_of_birth IS NULL
     OR date_of_birth > (CURRENT_DATE - INTERVAL '18 years')::date
   )
   AND (visibility IS DISTINCT FROM 'private' OR open_to_dating = true);
