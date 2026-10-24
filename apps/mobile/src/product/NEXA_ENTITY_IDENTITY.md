# NEXA Entity Identity v1

`nexaEntityIdentity.ts` is the canonical source for NEXA entity-family identity.

| Family | Shape | Tone |
| --- | --- | --- |
| Person | Circle | Action / violet |
| Event | Four-point star | Discovery / cyan |
| Listing | Square | Neutral |
| Opportunity / other | Diamond | Opportunity / violet |

## Rules

- Consumers must resolve shape through `resolveNexaEntityIdentity` instead of declaring local shape maps.
- Shared discovery DTOs currently expose `user`, `event`, and `listing`; `nexaEntityIdentityKindFromEntityKind` maps those to the product identity kinds.
- `opportunity` remains a product/presentational identity until the shared API contract introduces that family.
- Functional icons may remain contextual icons. This contract applies when a visual represents the entity family itself.
- The eye mark is the NEXA core brand symbol and is not an entity-family shape.
