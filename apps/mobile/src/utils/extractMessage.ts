export function extractMessage(e: unknown, fallback: string): string {
  if (e !== null && typeof e === 'object' && 'message' in e) {
    return String((e as { message: unknown }).message);
  }
  if (e instanceof Error) return e.message;
  return fallback;
}
