/** Returns the default DB URL, or a separately configured PR preview DB URL. */
export function resolveDatabaseUrl(
  env: Readonly<Record<string, string | undefined>>,
): string | undefined;
