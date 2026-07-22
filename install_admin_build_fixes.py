#!/usr/bin/env py
"""
install_admin_build_fixes.py

Fixes 4 build-blocking issues in apps/admin:
  1. packages/shared/src/index.ts missing -> barrel export doesn't exist
  2. apps/admin Vite/TS '@' alias not configured
  3. VerificationTable.tsx missing imports/component wrapper
  4. import.meta.env typed as `any` (no vite-env.d.ts / not picked up)

Run from repo root:  py install_admin_build_fixes.py

Safe by design:
  - packages/shared/src/index.ts: created fresh (confirmed missing), barrel
    exports are discovered dynamically via glob, not hardcoded, so it's
    correct regardless of what's actually in that folder.
  - vite.config.ts: only patched if a resolve.alias isn't already present;
    original is backed up to vite.config.ts.bak before touching it.
  - tsconfig.json: parsed as JSON and merged (baseUrl/paths added without
    touching anything else you have in there); backed up first.
  - vite-env.d.ts: created only if missing or missing the vite/client ref.
  - VerificationTable.tsx: full rewrite (the current file is a non-compiling
    fragment), original backed up to .bak.

ASSUMPTIONS (grep your codebase to confirm, adjust if wrong):
  - PendingVerificationSummaryDto / AdminVerificationDetailDto live in
    apps/admin/src/features/verification/types.ts
  - Toast lib is `sonner`
  - List data comes from usePendingVerifications() as react-query result
    with `.data.items: PendingVerificationSummaryDto[]`
  - PendingVerificationSummaryDto has userId / displayName / submittedAt / status
    -> adjust field names in the .map() if these don't match your actual DTO.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def backup(path: Path) -> None:
    if path.exists():
        bak = path.with_suffix(path.suffix + ".bak")
        bak.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
        print(f"  backed up -> {bak.relative_to(ROOT)}")


def write(path: Path, content: str, label: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8", newline="\n")
    print(f"[ok] {label}: {path.relative_to(ROOT)}")


# ---------------------------------------------------------------------------
# FIX 1: packages/shared/src/index.ts (barrel, dynamically discovered)
# ---------------------------------------------------------------------------
def fix_shared_barrel() -> None:
    src_dir = ROOT / "packages" / "shared" / "src"
    index_path = src_dir / "index.ts"

    if not src_dir.exists():
        print(f"[skip] {src_dir.relative_to(ROOT)} does not exist — check the path.")
        return

    if index_path.exists():
        print(f"[skip] {index_path.relative_to(ROOT)} already exists, not touching it.")
        return

    modules = sorted(
        p.stem
        for p in src_dir.glob("*.ts")
        if p.stem != "index"
        and not p.stem.endswith(".spec")
        and not p.stem.endswith(".test")
        and not p.stem.endswith(".d")
    )

    if not modules:
        print(f"[warn] No .ts modules found under {src_dir.relative_to(ROOT)} — nothing to export.")
        return

    lines = [f"export * from './{m}';" for m in modules]
    content = "// Auto-generated barrel — re-run this script if you add/remove files here.\n" + "\n".join(lines) + "\n"
    write(index_path, content, "created shared barrel")

    print(f"  exported modules: {', '.join(modules)}")
    if "event" in modules and "events" in modules:
        print(
            "  [check] both event.ts and events.ts exist — if they export the same "
            "symbol name, `tsc` will throw TS2308 (ambiguous export). Rename the "
            "colliding export or switch one to a named re-export."
        )


# ---------------------------------------------------------------------------
# FIX 2a: apps/admin/vite.config.ts — add '@' and '@g88/shared' aliases
# ---------------------------------------------------------------------------
def fix_vite_config() -> None:
    vite_path = ROOT / "apps" / "admin" / "vite.config.ts"

    alias_block = (
        "  resolve: {\n"
        "    alias: {\n"
        "      '@': fileURLToPath(new URL('./src', import.meta.url)),\n"
        "      '@g88/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),\n"
        "    },\n"
        "  },\n"
    )

    if not vite_path.exists():
        content = (
            "import { defineConfig } from 'vite';\n"
            "import react from '@vitejs/plugin-react';\n"
            "import { fileURLToPath } from 'node:url';\n\n"
            "export default defineConfig({\n"
            "  plugins: [react()],\n"
            f"{alias_block}"
            "});\n"
        )
        write(vite_path, content, "created vite.config.ts")
        return

    text = vite_path.read_text(encoding="utf-8")

    if re.search(r"resolve\s*:\s*{", text):
        print(f"[skip] {vite_path.relative_to(ROOT)} already has a resolve block — verify aliases manually:")
        print("       '@' -> ./src, '@g88/shared' -> ../../packages/shared/src/index.ts")
        return

    backup(vite_path)

    if "fileURLToPath" not in text:
        # insert the import right after the last existing import line
        import_lines = list(re.finditer(r"^import .+;$", text, flags=re.MULTILINE))
        if import_lines:
            insert_at = import_lines[-1].end()
            text = (
                text[:insert_at]
                + "\nimport { fileURLToPath } from 'node:url';"
                + text[insert_at:]
            )
        else:
            text = "import { fileURLToPath } from 'node:url';\n" + text

    # inject alias block right after defineConfig({
    new_text, n = re.subn(
        r"(defineConfig\(\s*\{)",
        r"\1\n" + alias_block.rstrip("\n"),
        text,
        count=1,
    )
    if n == 0:
        print(f"[warn] Could not find `defineConfig({{` in {vite_path.relative_to(ROOT)} — add this manually:")
        print(alias_block)
        return

    write(vite_path, new_text, "patched vite.config.ts (added resolve.alias)")


# ---------------------------------------------------------------------------
# FIX 2b: apps/admin/tsconfig.json — add baseUrl + paths (JSON merge)
# ---------------------------------------------------------------------------
def fix_tsconfig() -> None:
    ts_path = ROOT / "apps" / "admin" / "tsconfig.json"

    if not ts_path.exists():
        print(f"[skip] {ts_path.relative_to(ROOT)} not found — check the path.")
        return

    raw = ts_path.read_text(encoding="utf-8")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        print(f"[warn] {ts_path.relative_to(ROOT)} has comments/trailing commas, couldn't auto-merge.")
        print("       Add this manually inside compilerOptions:")
        print('       "baseUrl": ".", "paths": { "@/*": ["./src/*"], "@g88/shared": ["../../packages/shared/src/index.ts"] }')
        return

    compiler_options = data.setdefault("compilerOptions", {})
    compiler_options["baseUrl"] = compiler_options.get("baseUrl", ".")
    paths = compiler_options.setdefault("paths", {})
    paths["@/*"] = paths.get("@/*", ["./src/*"])
    paths["@g88/shared"] = paths.get("@g88/shared", ["../../packages/shared/src/index.ts"])

    backup(ts_path)
    write(ts_path, json.dumps(data, indent=2) + "\n", "patched tsconfig.json (baseUrl/paths)")


# ---------------------------------------------------------------------------
# FIX 4: apps/admin/src/vite-env.d.ts
# ---------------------------------------------------------------------------
def fix_vite_env() -> None:
    env_path = ROOT / "apps" / "admin" / "src" / "vite-env.d.ts"

    if env_path.exists():
        text = env_path.read_text(encoding="utf-8")
        if 'reference types="vite/client"' in text:
            print(f"[skip] {env_path.relative_to(ROOT)} already references vite/client.")
            return
        backup(env_path)
        text = '/// <reference types="vite/client" />\n' + text
        write(env_path, text, "patched vite-env.d.ts (added vite/client reference)")
        return

    content = (
        '/// <reference types="vite/client" />\n\n'
        "interface ImportMetaEnv {\n"
        "  readonly VITE_API_BASE_URL: string;\n"
        "  // add other VITE_* vars used by apps/admin here\n"
        "}\n\n"
        "interface ImportMeta {\n"
        "  readonly env: ImportMetaEnv;\n"
        "}\n"
    )
    write(env_path, content, "created vite-env.d.ts")


# ---------------------------------------------------------------------------
# FIX 3: VerificationTable.tsx — full rewrite (current file is a fragment)
# ---------------------------------------------------------------------------
def fix_verification_table() -> None:
    table_path = (
        ROOT / "apps" / "admin" / "src" / "features" / "verification"
        / "components" / "VerificationTable.tsx"
    )

    content = """import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { usePendingVerifications } from '../hooks/usePendingVerifications';
import { adminApi } from '../api';
import { VerificationDetailModal } from './VerificationDetailModal';
import type { AdminVerificationDetailDto, PendingVerificationSummaryDto } from '../types';

interface VerificationTableProps {
  onRowClick?: (summary: PendingVerificationSummaryDto) => void;
}

export function VerificationTable({ onRowClick }: VerificationTableProps) {
  const [selectedVerification, setSelectedVerification] = useState<AdminVerificationDetailDto | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const queryClient = useQueryClient();
  const { data, isLoading, isError } = usePendingVerifications();
  // TODO: confirm field name — some list DTOs return `.items`, others return the array directly
  const rows: PendingVerificationSummaryDto[] = data?.items ?? [];

  const openDetail = async (summary: PendingVerificationSummaryDto) => {
    try {
      const detail = await adminApi.getDetail(summary.userId);
      setSelectedVerification(detail);
      setModalOpen(true);
      onRowClick?.(summary);
    } catch (err) {
      toast.error('Failed to load verification details');
    }
  };

  if (isLoading) {
    return <div className="p-6 text-sm text-slate-400">Loading pending verifications…</div>;
  }

  if (isError) {
    return <div className="p-6 text-sm text-red-400">Failed to load verification queue.</div>;
  }

  if (rows.length === 0) {
    return <div className="p-6 text-sm text-slate-400">No pending verifications.</div>;
  }

  return (
    <>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-700 text-slate-400">
            <th className="py-2 pr-4 font-medium">User</th>
            <th className="py-2 pr-4 font-medium">Submitted</th>
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="py-2 pr-4 font-medium" />
          </tr>
        </thead>
        <tbody>
          {rows.map((summary) => (
            // TODO: adjust displayName / submittedAt / status to match your actual DTO fields
            <tr
              key={summary.userId}
              className="cursor-pointer border-b border-slate-800 hover:bg-slate-800/50"
              onClick={() => openDetail(summary)}
            >
              <td className="py-2 pr-4">{summary.displayName ?? summary.userId}</td>
              <td className="py-2 pr-4">{new Date(summary.submittedAt).toLocaleString()}</td>
              <td className="py-2 pr-4">{summary.status}</td>
              <td className="py-2 pr-4 text-right">
                <button
                  type="button"
                  className="text-cyan-400 hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    openDetail(summary);
                  }}
                >
                  Review
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <VerificationDetailModal
        verification={selectedVerification}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onDecisionMade={() => {
          queryClient.invalidateQueries({ queryKey: ['verifications', 'pending'] });
        }}
      />
    </>
  );
}
"""

    backup(table_path)
    write(table_path, content, "rewrote VerificationTable.tsx")


def main() -> None:
    print(f"repo root: {ROOT}\n")

    print("[1/4] packages/shared barrel")
    fix_shared_barrel()

    print("\n[2/4] vite alias + tsconfig paths")
    fix_vite_config()
    fix_tsconfig()

    print("\n[3/4] vite-env.d.ts")
    fix_vite_env()

    print("\n[4/4] VerificationTable.tsx")
    fix_verification_table()

    print(
        "\nDone. Next:\n"
        "  1. pnpm install -w                      (relink @g88/shared if package.json needs the workspace dep)\n"
        "  2. pnpm --filter admin exec tsc --noEmit (surfaces any remaining type mismatches, e.g. DTO field names)\n"
        "  3. grep for PendingVerificationSummaryDto/AdminVerificationDetailDto to confirm they're actually in\n"
        "     apps/admin/src/features/verification/types.ts — if they're meant to come from @g88/shared instead,\n"
        "     move them there and update the import line in VerificationTable.tsx.\n"
    )


if __name__ == "__main__":
    sys.exit(main())
