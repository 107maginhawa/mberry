/**
 * Stateful fake DatabaseInstance for association:operations repo tests.
 *
 * Models the exact drizzle query-builder chains the repos issue, keyed by the
 * *table object identity* passed to .insert()/.select().from()/.update()/.delete().
 * Mirrors the in-codebase pattern from dues/repos/dues-payments.repo.test.ts —
 * Drizzle column/SQL refs are opaque, so each chain identifies its target table
 * by identity and we exercise the repo's own logic against an in-memory store.
 *
 * Filtering predicates (eq/and SQL) are opaque to us, so .where() is recorded
 * but not interpreted: tests seed exactly the rows a given call should see. This
 * still drives every branch of buildWhereConditions + the override methods.
 */

let idCounter = 0;
const nextId = () => `fake-id-${++idCounter}`;

export interface FakeDb {
  db: any;
  /** rows currently stored for a given table object */
  rows(table: any): any[];
  /** seed rows for a table */
  seed(table: any, rows: any[]): void;
  /** reset all state */
  reset(): void;
  /** last .where() arg recorded for a table (chain-type keyed) */
  whereCalls: Array<{ kind: string; table: any }>;
}

export function makeFakeDb(): FakeDb {
  const store = new Map<any, any[]>();
  const whereCalls: Array<{ kind: string; table: any }> = [];

  function tableRows(table: any): any[] {
    let r = store.get(table);
    if (!r) {
      r = [];
      store.set(table, r);
    }
    return r;
  }

  // SELECT chain: select(proj?).from(table).where().orderBy().limit().offset()
  // Awaitable at any point after .from(). For count projections returns [{count}].
  function makeSelect(projection?: any) {
    let target: any[] = [];
    let table: any;
    let isCount = false;

    const chain: any = {
      from(t: any) {
        table = t;
        target = tableRows(t);
        if (projection && typeof projection === 'object' && 'count' in projection) {
          isCount = true;
        }
        return chain;
      },
      where() {
        whereCalls.push({ kind: 'select', table });
        return chain;
      },
      orderBy() {
        return chain;
      },
      limit() {
        return chain;
      },
      offset() {
        return chain;
      },
      then(resolve: (v: any) => any, reject?: (e: any) => any) {
        try {
          const result = isCount ? [{ count: target.length }] : [...target];
          return Promise.resolve(result).then(resolve, reject);
        } catch (e) {
          return reject ? reject(e) : Promise.reject(e);
        }
      },
    };
    return chain;
  }

  const db: any = {
    select(projection?: any) {
      return makeSelect(projection);
    },
    insert(table: any) {
      return {
        values(data: any) {
          return {
            returning: async () => {
              const arr = Array.isArray(data) ? data : [data];
              const inserted = arr.map((d) => ({
                id: d.id ?? nextId(),
                createdAt: d.createdAt ?? new Date(),
                updatedAt: d.updatedAt ?? new Date(),
                version: d.version ?? 1,
                ...d,
              }));
              tableRows(table).push(...inserted);
              return inserted;
            },
          };
        },
      };
    },
    update(table: any) {
      return {
        set(patch: any) {
          return {
            where() {
              whereCalls.push({ kind: 'update', table });
              return {
                returning: async () => {
                  const arr = tableRows(table);
                  // Apply patch to all stored rows (tests keep a single target row
                  // so the .where() opacity is harmless), return the mutated rows.
                  for (const row of arr) Object.assign(row, patch);
                  return [...arr];
                },
              };
            },
          };
        },
      };
    },
    delete(table: any) {
      return {
        where() {
          whereCalls.push({ kind: 'delete', table });
          // Clear the table to model a matching delete.
          store.set(table, []);
          return Promise.resolve();
        },
      };
    },
  };

  return {
    db,
    rows: tableRows,
    seed(table, rows) {
      store.set(table, [...rows]);
    },
    reset() {
      store.clear();
      whereCalls.length = 0;
    },
    whereCalls,
  };
}
