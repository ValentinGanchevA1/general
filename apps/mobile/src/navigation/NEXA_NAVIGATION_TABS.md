# NEXA map-first navigation v3

The five visible controls are **Map / Experiences / Opportunities / Connections / Identity**.

Map owns the single live geospatial viewport. Experiences and Opportunities are spatial **lenses**, not separate feeds or map instances: their tab presses update the session-only `nexaSpatialLensStore` and navigate back to Map. Their events/listings filters use the existing discovery infrastructure. The map state stays mounted.

- **Map**: primary local world, people, events, listings, places and live signals.
- **Experiences**: Map event lens. RSVP, detail and check-in routes remain existing features.
- **Opportunities**: Map listing lens. Buy/sell and offers remain existing commerce features.
- **Connections**: actionable relationships and conversations, badge capped at 99+.
- **Identity**: profile, verification, safety, achievements and settings.

`Discover`, `Pulse` and `You` are hidden compatibility routes. Old Pulse notifications continue to open the actual Pulse activity surface; do not redirect them to listings. Legacy `Interactions` re-enters Connections. No backend data model or REST/WS changes are introduced.

The two map lenses are selected through explicit tab actions; direct navigation to either route redirects to the Map route with the intended lens. Map layer chip changes are treated as a custom lens. On small screens use visible labels with adaptive text and 44dp minimum tap targets. Privacy, block, verification and server-side exact-location policies remain authoritative.
