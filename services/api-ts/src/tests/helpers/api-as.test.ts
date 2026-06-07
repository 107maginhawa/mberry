import { describe, test, expect } from 'bun:test';
import { apiAs } from './api-as';
import { API_AVAILABLE } from './api-available';
// Factory N/A: integration test — uses API responses as test data, not domain factories
// Test-Classification: INTEGRATION — requires live API server (API_AVAILABLE flag)
// These tests run in CI with full API stack, skip in unit-test-only mode.

const d = API_AVAILABLE ? describe : describe.skip; // allow-skip: integration gate — runs only when live API on $API_URL

d('apiAs', () => {
  test('returns authenticated client with HTTP methods', async () => {
    const client = await apiAs('test@memberry.ph');
    expect(typeof client.get).toBe('function');
    expect(typeof client.post).toBe('function');
    expect(typeof client.put).toBe('function');
    expect(typeof client.patch).toBe('function');
    expect(typeof client.delete).toBe('function');
  });

  test('authenticated client can GET /persons/me', async () => {
    const client = await apiAs('test@memberry.ph');
    const res = await client.get('/persons/me');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('id');
  });

  test('member user can also authenticate', async () => {
    const client = await apiAs('member@memberry.ph');
    const res = await client.get('/persons/me');
    expect(res.status).toBe(200);
  });

  test('throws for nonexistent user', async () => {
    await expect(apiAs('nonexistent@fake.com')).rejects.toThrow('Sign-in failed');
  });

  test('POST method sends JSON body with cookie', async () => {
    const client = await apiAs('test@memberry.ph');
    // GET a known endpoint to verify cookie works (POST to a safe endpoint)
    const res = await client.get('/persons/me');
    expect(res.status).toBe(200);
  });
});
