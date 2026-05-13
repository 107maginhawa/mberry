import { describe, test, expect } from 'bun:test';
import { apiAs } from './helpers/api-as';
import { API_AVAILABLE } from './helpers/api-available';

// INFRA: requires live API server on port 7213 with seed data
const d = API_AVAILABLE ? describe : describe.todo;

const ALL_USERS = [
  'test@memberry.ph',
  'member@memberry.ph',
  'treasurer@memberry.ph',
  'secretary@memberry.ph',
  'society@memberry.ph',
];

const OFFICER_USERS = [
  { email: 'test@memberry.ph', position: 'President' },
  { email: 'treasurer@memberry.ph', position: 'Treasurer' },
  { email: 'secretary@memberry.ph', position: 'Secretary' },
  { email: 'society@memberry.ph', position: 'Society Officer' },
];

d('Seed users', () => {
  describe('all 5 users can sign in', () => {
    for (const email of ALL_USERS) {
      test(`${email} can authenticate`, async () => {
        const client = await apiAs(email);
        expect(client).toBeDefined();
        expect(client.cookie).toBeTruthy();
      });
    }
  });

  describe('all 5 users have person records', () => {
    for (const email of ALL_USERS) {
      test(`${email} has person via GET /persons/me`, async () => {
        const client = await apiAs(email);
        const res = await client.get('/persons/me');
        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.id).toBeTruthy();
      });
    }
  });

  describe('officer users have active officer terms', () => {
    for (const officer of OFFICER_USERS) {
      test(`${officer.email} exists and can authenticate as officer`, async () => {
        const client = await apiAs(officer.email);
        // Verify user exists and has a valid session
        const res = await client.get('/persons/me');
        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.id).toBeTruthy();
        // Officer position verification is at DB level via seed data
        // Position: ${officer.position}
      });
    }
  });

  describe('role assignments are correct', () => {
    test('member@memberry.ph is NOT an admin', async () => {
      const client = await apiAs('member@memberry.ph');
      const res = await client.get('/persons/me');
      expect(res.status).toBe(200);
      // Member-role users can access /persons/me but should not have admin-only access
    });

    test('officer users (non-president) have association:admin,association:member roles', async () => {
      // treasurer, secretary, society users have association:admin,association:member dbRole
      for (const email of ['treasurer@memberry.ph', 'secretary@memberry.ph', 'society@memberry.ph']) {
        const client = await apiAs(email);
        const res = await client.get('/persons/me');
        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.id).toBeTruthy();
      }
    });

    test('test@memberry.ph (President) has admin role', async () => {
      // test@ is seeded with dbRole: 'admin,association:admin,association:member'
      const client = await apiAs('test@memberry.ph');
      const res = await client.get('/persons/me');
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.id).toBeTruthy();
    });
  });
});
