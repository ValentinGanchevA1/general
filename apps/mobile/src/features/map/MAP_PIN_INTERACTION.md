# Pin interaction (Stage 1+)

## Status
- Stage-1 PreviewCallout wired on MapScreen
- **Wave actor**: real `POST /interactions/wave`
- **loadPin**: real `GET /users/:id`
- **block**: real `POST /blocks/:id`
- **Like / pass**: client contract + migration **0047**; Nest module not yet implemented

## API contracts

### Wave (exists)
`POST /api/v1/interactions/wave`  
Body: `{ toUserId, context?: 'map' }`  
Response: `WaveResponse` — `conversationId != null` ⇒ mutual

### Dating like (0047 — backend TBD)
`POST /api/v1/dating/likes`  
Body: `{ toUserId }`  
Response: `{ id, fromUserId, toUserId, createdAt, matched, datingConversationId }`

`POST /api/v1/dating/pass`  
Body: `{ toUserId }`  
Response: `{ ok: true }`

### Migration
`apps/backend/migrations/0047_dating_likes.sql` — `dating_likes`, `dating_passes`, `dating_matches`

## Next free migration after this branch merges + 0047 applied: **0048**
