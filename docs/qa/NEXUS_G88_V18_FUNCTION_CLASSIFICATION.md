# NEXUS G88 v18 — public function EXECUTE classification (read-only)

**Decision: production NO-GO.** Supplemental evidence for Draft PR #1116. No grants, role changes, credentials, Render settings, migrations or production deployments are authorized by this document.

## Confirmed G88 catalog observation — 2026-11-17

The `public` schema contains 52 entries in `pg_proc` with effective `EXECUTE` privileges for both `anon` and `authenticated`. Classification by PostgreSQL catalog ownership and return type:

| Class | Count | Interpretation |
| --- | ---: | --- |
| Extension-owned routines (including 2 aggregates) | 47 | Supplied by a PostgreSQL extension; review extension compatibility before altering ACLs |
| Application trigger functions returning `trigger` | 4 | Trigger routines; not ordinary SQL/RPC callable functions |
| Application `g88_slugify(input text)` returning `text` | 1 | Invoker-security immutable helper; inspect source, schema usage and intended RPC access |
| **Total** | **52** | Effective `EXECUTE` does not establish externally reachable RPC endpoints |

All five non-extension routines have `SECURITY DEFINER = false`. The four trigger-only routines are:

- `clear_event_attendee_pulse_share_on_non_going()`
- `enforce_event_review_update()`
- `queue_posthog_subject_deletion()`
- `sync_dm_conversation_members()`

The application helper is `g88_slugify(input text)`, returning `text`, volatility `IMMUTABLE`, `SECURITY INVOKER` (not security definer).

## Reproducible SELECT-only catalog classification

```sql
SELECT
  CASE
    WHEN ext.oid IS NOT NULL THEN 'extension-owned'
    WHEN p.prorettype = 'pg_catalog.trigger'::regtype THEN 'trigger-only'
    ELSE 'application'
  END AS function_class,
  p.prokind AS routine_kind,
  COUNT(*) AS total,
  COUNT(*) FILTER (
    WHERE has_function_privilege('anon', p.oid, 'EXECUTE')
  ) AS anon_execute,
  COUNT(*) FILTER (
    WHERE has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ) AS authenticated_execute
FROM pg_catalog.pg_proc AS p
JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
LEFT JOIN pg_catalog.pg_depend AS dep
  ON dep.classid = 'pg_catalog.pg_proc'::regclass
 AND dep.objid = p.oid
 AND dep.deptype = 'e'
LEFT JOIN pg_catalog.pg_extension AS ext ON ext.oid = dep.refobjid
WHERE n.nspname = 'public'
GROUP BY 1, 2
ORDER BY 1, 2;
```

This reads PostgreSQL metadata only. It does not execute any application function, fetch application rows or modify permissions.

## Additional effective-access and body review (read-only)

- `anon` and `authenticated` both have effective `USAGE` on schema `public`, but neither has `CREATE` there.
- Both have effective `EXECUTE` on `public.g88_slugify(text)`. This is a SQL-language `IMMUTABLE PARALLEL SAFE` text transformation that lowercases/trims and normalizes a maximum 30-character input using regular expressions. Its inspected definition contains no table reads or writes.
- This narrows the observed risk for this helper, but **does not verify whether Supabase Data API exposes `public` or allows external RPC calls**. Do not claim the API is unreachable or reachable without a separate authorized test.
- Extension-owned routines and trigger behavior have not been exhaustively code-reviewed; staging compatibility tests remain mandatory.

## Security interpretation and remaining evidence

1. **Do not infer external exposure from `EXECUTE` alone.** Supabase Data API must expose the schema, the caller must have schema `USAGE`, and API routing/function support and request permissions must be assessed. These have not been independently verified.
2. **Do not revoke all function EXECUTE rights.** The extension-owned functions may support `citext` indexes, comparisons, operators and casts; changes can break application behavior.
3. **Do not treat trigger routines as ordinary RPCs.** They require trigger invocation context, although the underlying trigger operations still warrant a code review.
4. **Review `g88_slugify` separately.** Confirm its implementation and intended callers; if unnecessary for public API roles, test narrow ACL changes in isolated staging only.
5. **Runtime role isolation remains unproven.** The application still uses production `postgres`; the Render production build still runs `migration:run`; 15 historical migration names remain unresolved.
6. **Staging validation has not run.** No runtime role has been created and no credential rotation is authorized.

This is supplemental, sanitized evidence. It is not a vulnerability confirmation, production release sign-off, or permission to merge or deploy.
