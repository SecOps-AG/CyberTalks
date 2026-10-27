export type Statement = { sql: string; params: unknown[] };

export type SqlClient = {
  exec(sql: string): Promise<void>;
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;
  batch(statements: Statement[]): Promise<void>;
};

type Prepared = {
  bind(...values: unknown[]): Prepared;
  all<T>(): Promise<{ results?: T[] }>;
};

/** The subset of D1 this port uses. Matches the TALKS_DB binding. */
export type D1Like = {
  prepare(query: string): Prepared;
  batch(statements: Prepared[]): Promise<unknown>;
  exec(query: string): Promise<unknown>;
};

const BATCH = 80;

export function asSql(db: D1Like): SqlClient {
  return {
    async exec(sql: string) {
      await db.exec(sql);
    },
    async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      const prepared = params.length === 0 ? db.prepare(sql) : db.prepare(sql).bind(...params);
      const result = await prepared.all<T>();
      return result.results ?? [];
    },
    async batch(statements: Statement[]) {
      for (let index = 0; index < statements.length; index += BATCH) {
        const slice = statements.slice(index, index + BATCH);
        if (slice.length === 0) continue;
        await db.batch(slice.map((statement) => db.prepare(statement.sql).bind(...statement.params)));
      }
    },
  };
}

export function sqlLiteral(value: unknown): string {
  if (value == null) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "NULL";
    return String(value);
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** One statement, with `?` placeholders replaced. The SQL itself has no extra `?`. */
export function statementToSql(statement: Statement): string {
  let index = 0;
  const sql = statement.sql.replace(/\?/g, () => {
    const value = statement.params[index];
    index += 1;
    return sqlLiteral(value);
  });
  if (index !== statement.params.length) {
    throw new Error("SQL placeholder count does not match the parameters.");
  }
  return sql;
}
