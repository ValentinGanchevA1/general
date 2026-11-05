/** Keep timeout distinct from offline/network failures after Axios normalization. */
export function transportFailureCode(error: unknown): 'timeout' | 'network' {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return 'network';
  }
  const code = error.code;
  return code === 'ECONNABORTED' || code === 'ETIMEDOUT'
    ? 'timeout'
    : 'network';
}
