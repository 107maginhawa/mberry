/**
 * Recording chainable fake Drizzle DB for repository unit tests.
 *
 * The association:member repos issue raw drizzle chains in several shapes:
 *   - db.insert(t).values(v).returning()
 *   - db.select().from(t).where(c).limit(n)            (terminal: awaited)
 *   - db.select(cols).from(t).innerJoin(...).where(c).limit(n)
 *   - db.select().from(t).where(c).orderBy(...)        (terminal: awaited)
 *   - db.update(t).set(d).where(c).returning()
 *   - db.update(t).set(d).where(c)                     (terminal: awaited, no returning)
 *   - db.delete(t).where(c)                            (terminal: awaited)
 *   - db.execute(sql)                                  (raw SQL)
 *
 * Every chain node is BOTH chainable (every method returns the same node)
 * AND thenable (so `await` resolves at any terminal point). Each terminal
 * dequeues the next result-set from a per-operation queue, so a test can
 * script exactly what each query returns and assert which chain methods ran.
 *
 * This is a pure mock — no Postgres required. It mirrors the existing
 * mock-DB testing convention in this codebase (see test-utils/make-ctx.ts),
 * extended to record the chain so query-building branches are observable.
 */

export interface ChainCall {
  method: string;
  args: unknown[];
}

export interface FakeDbOptions {
  /** FIFO queues of result-sets keyed by leading op (select/insert/update/delete/execute). */
  selectResults?: unknown[][];
  insertResults?: unknown[][];
  updateResults?: unknown[][];
  deleteResults?: unknown[][];
  executeResults?: unknown[];
}

export interface FakeDb {
  select: (...a: unknown[]) => any;
  insert: (...a: unknown[]) => any;
  update: (...a: unknown[]) => any;
  delete: (...a: unknown[]) => any;
  execute: (...a: unknown[]) => Promise<unknown>;
  /** All chain method calls, in order, across every operation. */
  calls: ChainCall[];
  /** Per-operation call logs. */
  ops: { select: ChainCall[][]; insert: ChainCall[][]; update: ChainCall[][]; delete: ChainCall[][] };
}

export function makeFakeDb(opts: FakeDbOptions = {}): FakeDb {
  const selectQ = [...(opts.selectResults ?? [])];
  const insertQ = [...(opts.insertResults ?? [])];
  const updateQ = [...(opts.updateResults ?? [])];
  const deleteQ = [...(opts.deleteResults ?? [])];
  const executeQ = [...(opts.executeResults ?? [])];

  const calls: ChainCall[] = [];
  const ops: FakeDb['ops'] = { select: [], insert: [], update: [], delete: [] };

  function makeChain(queue: unknown[][], opLog: ChainCall[]) {
    const result = () => (queue.length > 0 ? queue.shift()! : []);
    const chain: any = new Proxy(
      {},
      {
        get(_t, prop: string | symbol) {
          if (prop === 'then') {
            return (resolve: any, reject?: any) =>
              Promise.resolve(result()).then(resolve, reject);
          }
          if (typeof prop === 'symbol') return undefined;
          // Any chain method records the call and returns the same chain.
          return (...args: unknown[]) => {
            const call = { method: prop, args };
            calls.push(call);
            opLog.push(call);
            return chain;
          };
        },
      },
    );
    return chain;
  }

  return {
    calls,
    ops,
    select: (...a: unknown[]) => {
      const opLog: ChainCall[] = [{ method: 'select', args: a }];
      calls.push(opLog[0]!);
      ops.select.push(opLog);
      return makeChain(selectQ, opLog);
    },
    insert: (...a: unknown[]) => {
      const opLog: ChainCall[] = [{ method: 'insert', args: a }];
      calls.push(opLog[0]!);
      ops.insert.push(opLog);
      return makeChain(insertQ, opLog);
    },
    update: (...a: unknown[]) => {
      const opLog: ChainCall[] = [{ method: 'update', args: a }];
      calls.push(opLog[0]!);
      ops.update.push(opLog);
      return makeChain(updateQ, opLog);
    },
    delete: (...a: unknown[]) => {
      const opLog: ChainCall[] = [{ method: 'delete', args: a }];
      calls.push(opLog[0]!);
      ops.delete.push(opLog);
      return makeChain(deleteQ, opLog);
    },
    execute: (..._a: unknown[]) =>
      Promise.resolve(executeQ.length > 0 ? executeQ.shift() : []),
  };
}

/** Names of chain methods invoked on the Nth (default last) operation of a kind. */
export function methodsOf(opLog: ChainCall[]): string[] {
  return opLog.map((c) => c.method);
}
