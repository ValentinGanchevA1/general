# NEXA — Figma component library and design-token sync

This is a local Figma development plugin. It reads the production React Native theme and creates reusable Figma assets. It does not refactor existing mobile components or deploy to the backend.

## Canonical sources

- Colors: apps/mobile/src/theme/brand.ts and colors.ts
- Spacing, radii, font sizes and dimensions: apps/mobile/src/theme/tokens.ts
- Elevation: buildTheme().shadow in apps/mobile/src/theme/ThemeProvider.tsx, and the existing FAB token from theme/index.ts
- Avatar and verification behavior: apps/mobile/src/components/Avatar.tsx and VerificationBadge.tsx

React Native is the source of truth. Never hand-edit generated code.js or tokens.json. Figma's generated CSS code syntax names are intended as future export names, not proof of existing CSS variables in the mobile application.

## Build and run

From the repository root, with pnpm dependencies installed:

1. Run: node tools/figma/nexa-library/build.mjs
2. Check synchronization: node tools/figma/nexa-library/build.mjs --check
3. Run structural smoke tests: node --test tools/figma/nexa-library/test.mjs
4. In Figma Desktop select Plugins → Development → Import plugin from manifest.
5. Select tools/figma/nexa-library/manifest.json.
6. Open the NEXA design and execute NEXA · Component Library Sync.

Target: https://www.figma.com/design/RMlHX3o4P7tHraj0tIGeGv

Generated outputs are tokens.json (machine-readable snapshot) and code.js (ready-to-run plugin). Rebuild after mobile theme changes.

## Created foundations

| Foundation | Figma object | Source |
|---|---|---|
| Colors | NEXA / Colors collection, modes Dark, Light, Protos Nexus | colors.ts |
| Spacing | NEXA / Spacing variables | spacing |
| Typography | NEXA / Typography numeric variables and Text styles | fontSize |
| Radius | NEXA / Radius variables | radius |
| Elevation | NEXA / Elevation effect styles for Dark, Light, Protos Nexus and Fab | theme shadow |
| Layout | NEXA / Layout variables | layout |

## Component library inventory

| Component | Variants |
|---|---|
| Button | Primary / Secondary / Ghost × Default / Pressed / Disabled |
| Input | Default / Focused / Error / Disabled |
| Avatar | None / Brand / Friend / Verified rings |
| VerificationBadge | Partial / ID (none is intentionally not rendered) |
| MapPin | Person / Event / Listing × Compact (18dp) / Standard (24dp) / Selected (34dp) |
| BottomSheet | Peek / Expanded |
| Card | Person / Event / Listing |
| Tabs | Active / Inactive |
| SearchBar | Default / Focused / Filled |

Each family is a Figma Component Set. Matching sets are preserved rather than duplicated on repeated runs; variables and text/effect styles are refreshed from the codebase.

## Quality and security boundaries

- Design specimens are not production React Native components. Native gestures, animations, loading, validation and accessibility still require device QA.
- Generic initials replace avatar photos. No real user GPS, identity records, token credentials or other personal data is exported.
- The ID verification glyph is schematic; mobile uses the check-decagram icon. MapPin glyphs are representative, not production vector exports.
- Inter is used in Figma prototypes; React Native continues to use system fonts. Numerical sizes match the mobile theme.
- Figma elevation styles cannot dynamically switch modes, so there are separate named styles. Android elevation values are retained as JSON metadata.
- Existing Figma pages and nodes are never deleted. Existing component sets with the same names are skipped; visual revisions require a specific design review.
- No team library publishing or Code Connect mappings are performed.
- Acceptance: all three color modes use identical semantic keys; nine component families appear after first run; reruns add no duplicate sets; tokens are driven directly by mobile source files.

## Figma connector limitation

Direct Figma synchronization was blocked by a Starter plan MCP call limit. This plugin is a local alternative until access is available again. Do not describe the Figma canvas as already updated before the plugin runs successfully.

## Structural QA

The Node.js smoke test uses a deterministic, non-networked Figma API mock. It checks the generated JS bundle against token snapshots, creates all nine component sets, tests all three color modes, and re-runs the plugin to confirm there are no duplicate sets, collections, variables or styles. It does not prove real Figma Plugin API compatibility, legibility, accessibility, or screenshot appearance. Those remain manual Figma Desktop acceptance gates.

MapPin specimens now reflect the actual mobile map contract: person avatar circles, four-point event stars, square listings, 48dp tap stage, and compact/standard/selected visual sizes. Exact runtime icon/vector parity still needs device comparison.
