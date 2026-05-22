/**
 * Check if the API server is reachable for integration tests.
 * Returns a boolean synchronously after the module-level check completes.
 *
 * Usage:
 *   import { API_AVAILABLE } from '@/tests/helpers/api-available';
 *   const d = API_AVAILABLE ? describe : describe.skip;
 */

const API_URL = process.env['API_URL'] || 'http://localhost:7213';

function checkApi(): boolean {
  try {
    // Synchronous check using Bun's fetch (top-level await)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = Bun.spawnSync(['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', '--max-time', '2', `${API_URL}/auth/ok`]);
    clearTimeout(timeout);
    return res.exitCode === 0;
  } catch {
    return false;
  }
}

export const API_AVAILABLE = checkApi();
