import { randomUUID } from 'node:crypto';

// Minimal in-memory stand-in for the Supabase admin client. Supports exactly the
// chain the codebase uses: from().select()/insert()/update()/delete()/upsert(),
// eq()/gte()/order()/range(), maybeSingle()/single(), {count,head}, and rpc().

type Row = Record<string, any>;
type Op = 'select' | 'insert' | 'update' | 'delete' | 'upsert';

export interface DbError {
  message: string;
}

export class MockDb {
  tables = new Map<string, Row[]>();
  rpcCalls: Array<{ name: string; args: unknown }> = [];
  rpcHandlers = new Map<string, (args: any) => { data?: unknown; error?: DbError | null }>();
  // Force the next/any operation on a table to return an error.
  errors = new Map<string, DbError>();

  seed(table: string, rows: Row[]) {
    this.tables.set(table, rows.map((r) => ({ ...r })));
    return this;
  }
  get(table: string): Row[] {
    if (!this.tables.has(table)) this.tables.set(table, []);
    return this.tables.get(table)!;
  }
  failTable(table: string, message = 'db error') {
    this.errors.set(table, { message });
    return this;
  }
  onRpc(name: string, handler: (args: any) => { data?: unknown; error?: DbError | null }) {
    this.rpcHandlers.set(name, handler);
    return this;
  }

  client() {
    const db = this;
    return {
      from(table: string) {
        return new QueryBuilder(db, table);
      },
      rpc(name: string, args: unknown) {
        db.rpcCalls.push({ name, args });
        const handler = db.rpcHandlers.get(name);
        const result = handler ? handler(args) : { data: null, error: null };
        return Promise.resolve(result);
      },
    };
  }
}

interface Filter {
  type: 'eq' | 'gte' | 'in';
  col: string;
  val: any;
}

class QueryBuilder implements PromiseLike<any> {
  private op: Op = 'select';
  private payload: Row | Row[] | null = null;
  private filters: Filter[] = [];
  private orderSpec: { col: string; ascending: boolean } | null = null;
  private rangeSpec: { from: number; to: number } | null = null;
  private countMode = false;
  private headMode = false;
  private wantSingle: 'single' | 'maybe' | null = null;
  private onConflict: string[] | null = null;
  private didSelect = false;

  constructor(private db: MockDb, private table: string) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    this.didSelect = true;
    if (opts?.count) this.countMode = true;
    if (opts?.head) this.headMode = true;
    return this;
  }
  insert(payload: Row | Row[]) {
    this.op = 'insert';
    this.payload = payload;
    return this;
  }
  update(payload: Row) {
    this.op = 'update';
    this.payload = payload;
    return this;
  }
  delete(opts?: { count?: string }) {
    this.op = 'delete';
    if (opts?.count) this.countMode = true;
    return this;
  }
  upsert(payload: Row, opts?: { onConflict?: string }) {
    this.op = 'upsert';
    this.payload = payload;
    this.onConflict = opts?.onConflict ? opts.onConflict.split(',').map((s) => s.trim()) : null;
    return this;
  }
  eq(col: string, val: any) {
    this.filters.push({ type: 'eq', col, val });
    return this;
  }
  gte(col: string, val: any) {
    this.filters.push({ type: 'gte', col, val });
    return this;
  }
  in(col: string, val: any[]) {
    this.filters.push({ type: 'in', col, val });
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderSpec = { col, ascending: opts?.ascending ?? true };
    return this;
  }
  range(from: number, to: number) {
    this.rangeSpec = { from, to };
    return this;
  }
  limit(_n: number) {
    return this;
  }
  maybeSingle() {
    this.wantSingle = 'maybe';
    return this;
  }
  single() {
    this.wantSingle = 'single';
    return this;
  }

  private matches(row: Row): boolean {
    return this.filters.every((f) => {
      if (f.type === 'eq') return row[f.col] === f.val;
      if (f.type === 'gte') return row[f.col] >= f.val;
      if (f.type === 'in') return Array.isArray(f.val) && f.val.includes(row[f.col]);
      return true;
    });
  }

  private clone<T>(v: T): T {
    return JSON.parse(JSON.stringify(v));
  }

  private execute(): { data: any; error: DbError | null; count?: number } {
    const err = this.db.errors.get(this.table);
    if (err) return { data: null, error: err, count: 0 };
    const rows = this.db.get(this.table);

    if (this.op === 'insert' || this.op === 'upsert') {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload!];
      const written: Row[] = [];
      for (const item of items) {
        const row: Row = {
          id: item.id ?? randomUUID(),
          created_at: item.created_at ?? new Date().toISOString(),
          updated_at: item.updated_at ?? new Date().toISOString(),
          ...item,
        };
        if (this.op === 'upsert' && this.onConflict) {
          const idx = rows.findIndex((r) =>
            this.onConflict!.every((k) => r[k] === row[k]),
          );
          if (idx >= 0) {
            rows[idx] = { ...rows[idx], ...item, updated_at: row.updated_at };
            written.push(rows[idx]);
            continue;
          }
        }
        rows.push(row);
        written.push(row);
      }
      const data = this.didSelect ? this.clone(written) : null;
      if (this.wantSingle) return { data: data ? data[0] : null, error: null };
      return { data, error: null };
    }

    let matched = rows.filter((r) => this.matches(r));

    if (this.op === 'update') {
      for (const r of matched) Object.assign(r, this.payload);
      const data = this.didSelect ? this.clone(matched) : null;
      if (this.wantSingle === 'single') {
        return matched.length
          ? { data: data![0], error: null }
          : { data: null, error: { message: 'no rows' } };
      }
      if (this.wantSingle === 'maybe') {
        return { data: data && data.length ? data[0] : null, error: null };
      }
      return { data, error: null };
    }

    if (this.op === 'delete') {
      const remaining = rows.filter((r) => !this.matches(r));
      const removed = rows.length - remaining.length;
      this.db.tables.set(this.table, remaining);
      if (this.countMode) return { data: null, error: null, count: removed };
      return { data: null, error: null };
    }

    // select
    if (this.orderSpec) {
      const { col, ascending } = this.orderSpec;
      matched = [...matched].sort((a, b) => {
        if (a[col] === b[col]) return 0;
        const cmp = a[col] > b[col] ? 1 : -1;
        return ascending ? cmp : -cmp;
      });
    }
    const total = matched.length;
    if (this.rangeSpec) {
      matched = matched.slice(this.rangeSpec.from, this.rangeSpec.to + 1);
    }

    if (this.headMode) return { data: null, error: null, count: total };

    if (this.wantSingle === 'single') {
      return matched.length
        ? { data: this.clone(matched[0]), error: null }
        : { data: null, error: { message: 'no rows' } };
    }
    if (this.wantSingle === 'maybe') {
      return { data: matched.length ? this.clone(matched[0]) : null, error: null };
    }

    const res: { data: any; error: DbError | null; count?: number } = {
      data: this.clone(matched),
      error: null,
    };
    if (this.countMode) res.count = total;
    return res;
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}
