// Local, frontend-only data adapter.
//
// It exposes a small chainable query API (`db.from("table").select().eq(...)`)
// backed by mock JSON data persisted in localStorage. The API surface is
// deliberately generic so it can later be re-implemented on top of Firebase,
// Appwrite, a REST API or any other backend without touching the UI layer.

import { buildSeed } from "./seed";
import type { Database, Row, TableName } from "./types";

const FOREIGN_KEYS: Partial<Record<TableName, string>> = {
  companies: "company_id",
  contacts: "contact_id",
  profiles: "user_id",
  tasks: "task_id",
};

const STORAGE_KEY = "placement-crm:data:v1";

let cache: Database | null = null;

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function read(): Database {
  if (cache) return cache;
  if (isBrowser()) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        cache = JSON.parse(raw) as Database;
        return cache;
      }
    } catch {
      /* fall through to seed */
    }
  }
  cache = buildSeed();
  persist();
  return cache;
}

function persist() {
  if (!isBrowser() || !cache) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    /* quota / private mode — keep working from memory */
  }
}

export function resetLocalData() {
  cache = buildSeed();
  persist();
}

export function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

type Filter = (row: Row) => boolean;
type Insertable = Record<string, unknown>;
type Result<T> = { data: T; error: { message: string } | null; count: number };

function value(row: Row, column: string) {
  return row[column] as unknown;
}

function likeToRegExp(pattern: string) {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*");
  return new RegExp(`^${escaped}$`, "i");
}

function matchOrExpression(row: Row, expression: string) {
  // PostgREST-like: "name.ilike.%foo%,industry.eq.IT"
  return expression.split(",").some((clause) => {
    const [column, op, ...rest] = clause.split(".");
    const raw = rest.join(".");
    const current = value(row, column);
    if (op === "ilike" || op === "like") {
      return typeof current === "string" && likeToRegExp(raw).test(current);
    }
    if (op === "is") return raw === "null" ? current === null || current === undefined : current === (raw === "true");
    if (op === "eq") return String(current) === raw;
    if (op === "neq") return String(current) !== raw;
    return false;
  });
}

function sortRows(rows: Row[], column: string, ascending: boolean) {
  return [...rows].sort((a, b) => {
    const av = value(a, column);
    const bv = value(b, column);
    if (av === bv) return 0;
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    const cmp = av > bv ? 1 : -1;
    return ascending ? cmp : -cmp;
  });
}

class QueryBuilder<T = Row[]> implements PromiseLike<Result<T>> {
  private filters: Filter[] = [];
  private sorts: { column: string; ascending: boolean }[] = [];
  private limitCount: number | null = null;
  private mode: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private payload: Insertable[] = [];
  private conflictKey: string | null = null;
  private singleMode: "none" | "maybe" | "one" = "none";
  private embeds: { table: TableName; fk: string }[] = [];
  private countMode = false;
  private headOnly = false;

  constructor(private table: TableName) {}

  select(columns?: string, opts?: { count?: "exact"; head?: boolean }) {
    this.countMode = Boolean(opts?.count);
    this.headOnly = Boolean(opts?.head);
    if (columns) {
      for (const match of columns.matchAll(/([a-z_]+)\(([^)]*)\)/g)) {
        const table = match[1] as TableName;
        const fk = FOREIGN_KEYS[table];
        if (fk) this.embeds.push({ table, fk });
      }
    }
    return this as unknown as QueryBuilder<Row[]>;
  }

  eq(column: string, val: unknown) {
    this.filters.push((row) => String(value(row, column) ?? "") === String(val ?? ""));
    return this;
  }

  neq(column: string, val: unknown) {
    this.filters.push((row) => String(value(row, column) ?? "") !== String(val ?? ""));
    return this;
  }

  is(column: string, val: null | boolean) {
    this.filters.push((row) => {
      const current = value(row, column);
      if (val === null) return current === null || current === undefined;
      return current === val;
    });
    return this;
  }

  not(column: string, op: string, val: unknown) {
    this.filters.push((row) => {
      const current = value(row, column);
      if (op === "is" && val === null) return current !== null && current !== undefined;
      return String(current ?? "") !== String(val ?? "");
    });
    return this;
  }

  in(column: string, values: unknown[]) {
    const set = new Set(values.map((v) => String(v)));
    this.filters.push((row) => set.has(String(value(row, column))));
    return this;
  }

  gte(column: string, val: unknown) {
    this.filters.push((row) => (value(row, column) as never) >= (val as never));
    return this;
  }

  lte(column: string, val: unknown) {
    this.filters.push((row) => (value(row, column) as never) <= (val as never));
    return this;
  }

  gt(column: string, val: unknown) {
    this.filters.push((row) => (value(row, column) as never) > (val as never));
    return this;
  }

  lt(column: string, val: unknown) {
    this.filters.push((row) => (value(row, column) as never) < (val as never));
    return this;
  }

  ilike(column: string, pattern: string) {
    const re = likeToRegExp(pattern);
    this.filters.push((row) => typeof value(row, column) === "string" && re.test(value(row, column) as string));
    return this;
  }

  or(expression: string) {
    this.filters.push((row) => matchOrExpression(row, expression));
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }) {
    this.sorts.push({ column, ascending: opts?.ascending !== false });
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  maybeSingle() {
    this.singleMode = "maybe";
    return this as unknown as QueryBuilder<Row | null>;
  }

  single() {
    this.singleMode = "one";
    return this as unknown as QueryBuilder<Row | null>;
  }

  insert(payload: Insertable | Insertable[]) {
    this.mode = "insert";
    this.payload = Array.isArray(payload) ? payload : [payload];
    return this;
  }

  update(payload: Insertable) {
    this.mode = "update";
    this.payload = [payload];
    return this;
  }

  upsert(payload: Insertable | Insertable[], opts?: { onConflict?: string }) {
    this.mode = "upsert";
    this.payload = Array.isArray(payload) ? payload : [payload];
    this.conflictKey = opts?.onConflict ?? "id";
    return this;
  }

  delete() {
    this.mode = "delete";
    return this;
  }

  private matching(rows: Row[]) {
    return rows.filter((row) => this.filters.every((f) => f(row)));
  }

  private run(): Result<unknown> {
    const db = read();
    const table = db[this.table] ?? (db[this.table] = []);
    const stamp = new Date().toISOString();
    let out: Row[] = [];

    if (this.mode === "insert") {
      out = this.payload.map((item) => ({
        created_at: stamp,
        updated_at: stamp,
        ...item,
        id: (item.id as string) ?? uid(this.table.slice(0, 2)),
      })) as Row[];
      table.unshift(...out);
      persist();
    } else if (this.mode === "update") {
      out = this.matching(table);
      out.forEach((row) => Object.assign(row, this.payload[0], { updated_at: stamp }));
      persist();
    } else if (this.mode === "upsert") {
      const key = this.conflictKey ?? "id";
      out = this.payload.map((item) => {
        const existing = table.find((row) => String(value(row, key)) === String(item[key]));
        if (existing) {
          Object.assign(existing, item, { updated_at: stamp });
          return existing;
        }
        const created = {
          created_at: stamp,
          updated_at: stamp,
          ...item,
          id: (item.id as string) ?? uid(this.table.slice(0, 2)),
        } as Row;
        table.unshift(created);
        return created;
      });
      persist();
    } else if (this.mode === "delete") {
      out = this.matching(table);
      const ids = new Set(out.map((row) => row.id));
      db[this.table] = table.filter((row) => !ids.has(row.id));
      persist();
    } else {
      out = this.matching(table);
      for (const sort of this.sorts) out = sortRows(out, sort.column, sort.ascending);
      if (this.limitCount !== null) out = out.slice(0, this.limitCount);
    }

    const clone = JSON.parse(JSON.stringify(out)) as Row[];
    for (const embed of this.embeds) {
      const related = db[embed.table] ?? [];
      clone.forEach((row) => {
        const match = related.find((r) => String(r.id) === String(row[embed.fk]));
        row[embed.table] = match ? JSON.parse(JSON.stringify(match)) : null;
      });
    }
    if (this.singleMode !== "none") return { data: clone[0] ?? null, error: null, count: clone.length };
    return { data: this.headOnly ? [] : clone, error: null, count: clone.length };
  }

  then<TResult1 = Result<T>, TResult2 = never>(
    onfulfilled?: ((v: Result<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    try {
      return Promise.resolve(this.run() as Result<T>).then(onfulfilled, onrejected);
    } catch (error) {
      return Promise.resolve({
        data: (this.singleMode === "none" ? [] : null) as T,
        error: { message: error instanceof Error ? error.message : "Local data error" },
        count: 0,
      }).then(onfulfilled, onrejected);
    }
  }
}

export const db = {
  from(table: TableName) {
    return new QueryBuilder(table);
  },
};

export type { Row, TableName } from "./types";
