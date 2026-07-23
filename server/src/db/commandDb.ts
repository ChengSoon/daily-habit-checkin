import type { QueryResult, QueryResultRow } from "pg";

export type CommandDb = {
  query<T extends QueryResultRow>(text: string, values?: readonly unknown[]): Promise<QueryResult<T>>;
};
