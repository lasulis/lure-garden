type D1Value = string | number | boolean | null | ArrayBuffer | Uint8Array;

interface D1PreparedStatement {
  bind(...values: D1Value[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
  run(): Promise<unknown>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): Promise<unknown>;
}

interface R2Bucket {
  put(key: string, value: string | ArrayBuffer | ArrayBufferView | Blob): Promise<unknown>;
}

interface CloudflareBindings {
  DB?: D1Database;
  ASSETS?: R2Bucket;
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
  OPENAI_API_KEY?: string;
}

declare module "cloudflare:workers" {
  export const env: CloudflareBindings;
}
