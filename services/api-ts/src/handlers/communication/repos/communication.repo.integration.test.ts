/**
 * Integration coverage for communication.repo against real Postgres.
 *
 * Covers every exported class: MessageTemplateRepository, MessageRepository,
 * SubscriptionTopicRepository, PersonSubscriptionRepository, CommunicationsRepository,
 * SavedSegmentRepository, and the notificationPreferenceRepoPort adapter (enabled,
 * explicit-disable by category and by name, fail-open on empty args). Skips when
 * Postgres unreachable.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { randomUUID } from 'node:crypto';
import {
  MessageTemplateRepository,
  MessageRepository,
  SubscriptionTopicRepository,
  PersonSubscriptionRepository,
  CommunicationsRepository,
  SavedSegmentRepository,
  notificationPreferenceRepoPort,
} from './communication.repo';

const DB_URL =
  process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase';

let pool: Pool;
let db: ReturnType<typeof drizzle>;
let dbReachable = false;

const ORG = randomUUID();
const PERSON = randomUUID();
const SENDER = randomUUID();

let tmplRepo: MessageTemplateRepository;
let msgRepo: MessageRepository;
let topicRepo: SubscriptionTopicRepository;
let subRepo: PersonSubscriptionRepository;
let commsRepo: CommunicationsRepository;
let segRepo: SavedSegmentRepository;

const createdTemplateIds: string[] = [];
const createdMessageIds: string[] = [];
const createdTopicIds: string[] = [];
const createdSubIds: string[] = [];
const createdAnnIds: string[] = [];
const createdSegIds: string[] = [];

beforeAll(async () => {
  pool = new Pool({ connectionString: DB_URL, connectionTimeoutMillis: 3000 });
  try {
    const c = await pool.connect();
    c.release();
    db = drizzle(pool);
    dbReachable = true;
  } catch (err) {
    dbReachable = false;
    // eslint-disable-next-line no-console
    console.warn(`[communication.repo integration] Postgres unreachable; skipping. ${(err as Error).message}`);
    return;
  }
  tmplRepo = new MessageTemplateRepository(db as any);
  msgRepo = new MessageRepository(db as any);
  topicRepo = new SubscriptionTopicRepository(db as any);
  subRepo = new PersonSubscriptionRepository(db as any);
  commsRepo = new CommunicationsRepository(db as any);
  segRepo = new SavedSegmentRepository(db as any);

  // announcement.author_id FK → person
  await pool.query(`INSERT INTO person (id, first_name) VALUES ($1,'Comm Author') ON CONFLICT DO NOTHING`, [PERSON]);
});

afterAll(async () => {
  if (pool) {
    if (dbReachable) {
      await pool.query(`DELETE FROM announcement_stats WHERE organization_id=$1`, [ORG]);
      await pool.query(`DELETE FROM announcement WHERE organization_id=$1`, [ORG]);
      await pool.query(`DELETE FROM person_subscription WHERE organization_id=$1`, [ORG]);
      await pool.query(`DELETE FROM subscription_topic WHERE organization_id=$1`, [ORG]);
      await pool.query(`DELETE FROM message WHERE organization_id=$1`, [ORG]);
      await pool.query(`DELETE FROM message_template WHERE organization_id=$1`, [ORG]);
      await pool.query(`DELETE FROM saved_segment WHERE organization_id=$1`, [ORG]);
      await pool.query(`DELETE FROM person WHERE id=$1`, [PERSON]);
    }
    await pool.end();
  }
});

describe('MessageTemplateRepository', () => {
  test('create / findById / findByOrg', async () => {
    if (!dbReachable) return;
    const t = await tmplRepo.create({
      organizationId: ORG, name: 'Welcome', channel: 'email',
      subject: 'Hi', body: 'Body', category: 'onboarding', status: 'active',
    } as any);
    createdTemplateIds.push(t.id);
    expect(t.name).toBe('Welcome');
    expect((await tmplRepo.findById(t.id))?.id).toBe(t.id);
    expect(await tmplRepo.findById(randomUUID())).toBeUndefined();
    expect((await tmplRepo.findByOrg(ORG)).length).toBeGreaterThanOrEqual(1);
  });

  test('search with every filter branch', async () => {
    if (!dbReachable) return;
    const t = await tmplRepo.create({
      organizationId: ORG, name: 'TxnReceipt', channel: 'sms',
      body: 'B', category: 'billing', isTransactional: true, status: 'draft',
    } as any);
    createdTemplateIds.push(t.id);

    const r = await tmplRepo.search(ORG, {
      q: 'Txn', channel: 'sms', category: 'billing', status: 'draft',
      isTransactional: true, limit: 10, offset: 0,
    });
    expect(r.some((x) => x.id === t.id)).toBe(true);
    // no filters → org-only default limit/offset
    expect((await tmplRepo.search(ORG, {})).length).toBeGreaterThanOrEqual(1);
  });

  test('update / delete', async () => {
    if (!dbReachable) return;
    const id = createdTemplateIds[0]!;
    const upd = await tmplRepo.update(id, { name: 'Welcome v2' } as any);
    expect(upd?.name).toBe('Welcome v2');
    await tmplRepo.delete(id);
    expect(await tmplRepo.findById(id)).toBeUndefined();
    createdTemplateIds.shift();
  });
});

describe('MessageRepository', () => {
  test('create / findById / findByOrg', async () => {
    if (!dbReachable) return;
    const m = await msgRepo.create({
      organizationId: ORG, channel: 'email', senderId: SENDER, body: 'Hello',
      recipients: [{ personId: PERSON, deliveryStatus: 'pending' }], status: 'draft',
    } as any);
    createdMessageIds.push(m.id);
    expect((await msgRepo.findById(m.id))?.id).toBe(m.id);
    expect(await msgRepo.findById(randomUUID())).toBeUndefined();
    expect((await msgRepo.findByOrg(ORG)).length).toBeGreaterThanOrEqual(1);
  });

  test('search with all filter branches', async () => {
    if (!dbReachable) return;
    const r = await msgRepo.search(ORG, {
      channel: 'email', senderId: SENDER, status: 'draft',
      scheduledAfter: new Date('2000-01-01'), limit: 5, offset: 0,
    });
    expect(Array.isArray(r)).toBe(true);
    expect((await msgRepo.search(ORG, {})).length).toBeGreaterThanOrEqual(1);
  });

  test('findDuplicateSentToday / findDuplicatesSentToday', async () => {
    if (!dbReachable) return;
    // A 'sent' message today to PERSON.
    const sent = await msgRepo.create({
      organizationId: ORG, channel: 'email', senderId: SENDER, body: 'X',
      recipients: [{ personId: PERSON, deliveryStatus: 'sent' }],
      status: 'sent', sentAt: new Date(),
    } as any);
    createdMessageIds.push(sent.id);

    const dup = await msgRepo.findDuplicateSentToday(ORG, 'email', PERSON);
    expect(dup?.id).toBe(sent.id);
    expect(await msgRepo.findDuplicateSentToday(ORG, 'email', randomUUID())).toBeUndefined();

    expect(await msgRepo.findDuplicatesSentToday(ORG, 'email', [])).toEqual([]);
    const batch = await msgRepo.findDuplicatesSentToday(ORG, 'email', [PERSON, randomUUID()]);
    expect(batch).toContain(PERSON);
  });

  test('update / delete', async () => {
    if (!dbReachable) return;
    const id = createdMessageIds[0]!;
    const u = await msgRepo.update(id, { status: 'cancelled' } as any);
    expect(u?.status).toBe('cancelled');
    await msgRepo.delete(id);
    expect(await msgRepo.findById(id)).toBeUndefined();
    createdMessageIds.shift();
  });
});

describe('SubscriptionTopicRepository', () => {
  test('create / findById / findByOrg / findByName', async () => {
    if (!dbReachable) return;
    const t = await topicRepo.create({
      organizationId: ORG, name: 'dues', channel: 'email', category: 'billing', defaultEnabled: true,
    } as any);
    createdTopicIds.push(t.id);
    expect((await topicRepo.findById(t.id))?.id).toBe(t.id);
    expect(await topicRepo.findById(randomUUID())).toBeUndefined();
    expect((await topicRepo.findByOrg(ORG)).length).toBeGreaterThanOrEqual(1);
    expect((await topicRepo.findByName(ORG, 'dues'))?.id).toBe(t.id);
    expect(await topicRepo.findByName(ORG, 'nope')).toBeUndefined();
  });

  test('findOrCreateByName: returns existing then creates new', async () => {
    if (!dbReachable) return;
    const existing = await topicRepo.findOrCreateByName(ORG, 'dues');
    expect(existing.name).toBe('dues');
    const created = await topicRepo.findOrCreateByName(ORG, 'announcements', { category: 'general' });
    createdTopicIds.push(created.id);
    expect(created.category).toBe('general');
    expect(created.channel).toBe('email');
  });

  test('update / delete', async () => {
    if (!dbReachable) return;
    const created = await topicRepo.create({
      organizationId: ORG, name: 'tmp-topic', channel: 'push', category: 'misc',
    } as any);
    const u = await topicRepo.update(created.id, { description: 'desc' } as any);
    expect(u?.description).toBe('desc');
    await topicRepo.delete(created.id);
    expect(await topicRepo.findById(created.id)).toBeUndefined();
  });
});

describe('PersonSubscriptionRepository', () => {
  let topicId: string;
  test('create / findById / findByPerson / findByPersonAndTopic', async () => {
    if (!dbReachable) return;
    topicId = createdTopicIds[0]!;
    const s = await subRepo.create({
      organizationId: ORG, personId: PERSON, topicId, enabled: true,
    } as any);
    createdSubIds.push(s.id);
    expect((await subRepo.findById(s.id))?.id).toBe(s.id);
    expect(await subRepo.findById(randomUUID())).toBeUndefined();
    expect((await subRepo.findByPerson(PERSON, ORG)).length).toBeGreaterThanOrEqual(1);
    expect((await subRepo.findByPersonAndTopic(PERSON, topicId))?.id).toBe(s.id);
  });

  test('findByPersonWithTopic enriches topic name', async () => {
    if (!dbReachable) return;
    const rows = await subRepo.findByPersonWithTopic(PERSON, ORG);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.some((r) => r.topicName === 'dues')).toBe(true);
  });

  test('upsert: updates existing, creates when absent', async () => {
    if (!dbReachable) return;
    const updated = await subRepo.upsert({ organizationId: ORG, personId: PERSON, topicId, enabled: false } as any);
    expect(updated.enabled).toBe(false);

    const newTopic = createdTopicIds[1]!;
    const created = await subRepo.upsert({ organizationId: ORG, personId: PERSON, topicId: newTopic, enabled: true } as any);
    createdSubIds.push(created.id);
    expect(created.enabled).toBe(true);
  });

  test('bulkUpsert: empty + conflict update path', async () => {
    if (!dbReachable) return;
    expect(await subRepo.bulkUpsert([])).toEqual([]);
    const rows = await subRepo.bulkUpsert([
      { organizationId: ORG, personId: PERSON, topicId, enabled: true } as any,
    ]);
    expect(rows[0]!.enabled).toBe(true);
  });

  test('update / delete', async () => {
    if (!dbReachable) return;
    const id = createdSubIds[0]!;
    const u = await subRepo.update(id, { enabled: true } as any);
    expect(u?.enabled).toBe(true);
    await subRepo.delete(id);
    expect(await subRepo.findById(id)).toBeUndefined();
    createdSubIds.shift();
  });
});

describe('CommunicationsRepository', () => {
  async function mkAnnouncement(over: Record<string, unknown> = {}) {
    const a = await commsRepo.create({
      organizationId: ORG, authorId: PERSON, title: 'News', content: 'Body',
      audienceType: 'all', status: 'draft', ...over,
    } as any);
    createdAnnIds.push(a.id);
    return a;
  }

  test('create / get (with + without org) / get miss', async () => {
    if (!dbReachable) return;
    const a = await mkAnnouncement();
    expect((await commsRepo.get(a.id))?.id).toBe(a.id);
    expect((await commsRepo.get(a.id, ORG))?.id).toBe(a.id);
    expect(await commsRepo.get(randomUUID(), ORG)).toBeUndefined();
  });

  test('list: org required, status + search filters, stats join', async () => {
    if (!dbReachable) return;
    await expect(commsRepo.list('')).rejects.toThrow();
    const a = await mkAnnouncement({ title: 'UniqueSearchable', status: 'sent' });
    await commsRepo.createStats(a.id, 5, ORG, { emailSent: 2, pushDelivered: 3, inappViews: 1 });

    const res = await commsRepo.list(ORG, { status: 'sent', search: 'UniqueSearch', limit: 10, offset: 0 });
    expect(res.total).toBeGreaterThanOrEqual(1);
    const found = res.data.find((d) => d.id === a.id);
    expect(found?.stats?.emailSent).toBe(2);

    const plain = await commsRepo.list(ORG);
    expect(plain.total).toBeGreaterThanOrEqual(1);
  });

  test('findScheduledDue returns due scheduled announcements', async () => {
    if (!dbReachable) return;
    await mkAnnouncement({ status: 'scheduled', scheduledAt: new Date('2000-01-01T00:00:00Z') });
    const due = await commsRepo.findScheduledDue(10);
    expect(due.some((d) => d.organizationId === ORG)).toBe(true);
  });

  test('updateStatus / update (with + without org)', async () => {
    if (!dbReachable) return;
    const a = await mkAnnouncement();
    const us = await commsRepo.updateStatus(a.id, 'sent', { publishedAt: new Date() }, ORG);
    expect(us.status).toBe('sent');
    const u = await commsRepo.update(a.id, { title: 'Edited' });
    expect(u.title).toBe('Edited');
    const u2 = await commsRepo.update(a.id, { title: 'Edited2' }, ORG);
    expect(u2.title).toBe('Edited2');
  });

  test('getStats aggregates', async () => {
    if (!dbReachable) return;
    const stats = await commsRepo.getStats(ORG);
    expect(typeof stats!.totalThisMonth).toBe('number');
    expect(typeof stats!.totalRecipients).toBe('number');
  });

  test('delete (with + without org)', async () => {
    if (!dbReachable) return;
    const a = await mkAnnouncement();
    await commsRepo.delete(a.id, ORG);
    expect(await commsRepo.get(a.id)).toBeUndefined();
    const b = await mkAnnouncement();
    await commsRepo.delete(b.id);
    expect(await commsRepo.get(b.id)).toBeUndefined();
  });
});

describe('SavedSegmentRepository', () => {
  test('create / list / delete', async () => {
    if (!dbReachable) return;
    const s = await segRepo.create({
      organizationId: ORG, name: 'Lapsed', filters: { duesStatus: 'overdue' },
    } as any);
    createdSegIds.push(s.id);
    expect((await segRepo.list(ORG)).some((x) => x.id === s.id)).toBe(true);
    await segRepo.delete(s.id, ORG);
    expect((await segRepo.list(ORG)).some((x) => x.id === s.id)).toBe(false);
    createdSegIds.shift();
  });
});

describe('notificationPreferenceRepoPort', () => {
  test('fail-open on empty args', async () => {
    if (!dbReachable) return;
    const port = notificationPreferenceRepoPort(db as any);
    expect(await port.isCategoryEnabledForPerson('', ORG, 'dues')).toBe(true);
    expect(await port.isCategoryEnabledForPerson(PERSON, '', 'dues')).toBe(true);
    expect(await port.isCategoryEnabledForPerson(PERSON, ORG, '')).toBe(true);
  });

  test('enabled when no explicit-disable row; disabled when category/name matches a disabled sub', async () => {
    if (!dbReachable) return;
    const port = notificationPreferenceRepoPort(db as any);
    const person2 = randomUUID();

    // Topic: name 'dues', category 'billing'. Disable a subscription on it.
    const topic = await topicRepo.create({
      organizationId: ORG, name: 'dues-2', channel: 'email', category: 'billing', defaultEnabled: true,
    } as any);
    createdTopicIds.push(topic.id);
    const sub = await subRepo.create({
      organizationId: ORG, personId: person2, topicId: topic.id, enabled: false,
    } as any);
    createdSubIds.push(sub.id);

    // Match by topic.category 'billing'
    expect(await port.isCategoryEnabledForPerson(person2, ORG, 'billing')).toBe(false);
    // Match by topic.name 'dues-2' (case-insensitive)
    expect(await port.isCategoryEnabledForPerson(person2, ORG, 'DUES-2')).toBe(false);
    // No matching disabled row for an unrelated category → enabled
    expect(await port.isCategoryEnabledForPerson(person2, ORG, 'events')).toBe(true);
    // A different person has no disable row → enabled
    expect(await port.isCategoryEnabledForPerson(randomUUID(), ORG, 'billing')).toBe(true);

    await pool.query(`DELETE FROM person_subscription WHERE id=$1`, [sub.id]);
  });
});
