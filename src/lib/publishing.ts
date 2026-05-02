import { createServerFn } from "@tanstack/react-start";
import fallbackCover from "@/assets/hero-featured.jpg";
import { categories, type Post } from "@/lib/posts";

export type PublishedBlockType =
  | "paragraph"
  | "quote"
  | "code"
  | "latex"
  | "divider"
  | "image"
  | "list"
  | "table"
  | "diagram";

export type PublishedTableCell = {
  text: string;
  align: "left" | "center" | "right";
  color: string;
  width: number;
  height: number;
};

export type PublishedTable = {
  title: string;
  mode: "fit" | "scroll";
  rows: PublishedTableCell[][];
};

export type DiagramShape = "rectangle" | "square" | "circle" | "pill" | "text";

export type DiagramNode = {
  id: string;
  type: DiagramShape;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  fontSize?: number;
  fontFamily?: "sans" | "serif" | "script";
  bold?: boolean;
};

export type DiagramEdge = {
  id: string;
  fromId: string;
  toId: string;
  label: string;
  arrow?: boolean;
};

export type DiagramLine = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  arrow?: boolean;
};

export type Diagram = {
  width: number;
  height: number;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  lines?: DiagramLine[];
};

export type PublishedBlock = {
  id: string;
  type: PublishedBlockType;
  text: string;
  color: string;
  bold: boolean;
  html?: string;
  language?: string;
  filename?: string;
  src?: string;
  alt?: string;
  width?: number;
  table?: PublishedTable;
  diagram?: Diagram;
};

export type PublishedPostInput = {
  title: string;
  excerpt: string;
  categorySlug: string;
  coverDataUrl: string;
  blocks: PublishedBlock[];
  adminToken?: string;
};

export type PublishedPostUpdateInput = PublishedPostInput & {
  slug: string;
};

export type PublishedPost = Omit<PublishedPostInput, "adminToken"> & {
  slug: string;
  date: string;
  readTime: string;
  author: {
    name: string;
    avatar: string;
  };
};

const STORE_KEY = "lure.garden.published-posts";

const author = {
  name: "Luiza Reixach Castro",
  avatar: "https://i.pravatar.cc/120?img=47",
};

const serverStore = globalThis as typeof globalThis & {
  __lurePublishedPosts?: PublishedPost[];
  __lureD1SchemaReady?: boolean;
};

type PublishedPostRow = {
  slug: string;
  title: string;
  excerpt: string;
  category_slug: string;
  cover_data_url: string;
  blocks_json: string;
  date: string;
  read_time: string;
  author_json: string;
};

type SupabasePostRow = {
  slug: string;
  title: string;
  excerpt: string;
  category_slug: string;
  cover_url: string | null;
  blocks: PublishedBlock[] | string | null;
  read_time: string;
  author_name: string;
  author_avatar: string;
  published_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type SupabaseConfig = {
  url: string;
  key: string;
  publishableKey: string;
};

const SUPABASE_IMAGE_BUCKET = "post-images";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 72);
}

function estimateReadTime(blocks: PublishedBlock[]) {
  const words = blocks
    .map((block) => block.text)
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  return `${Math.max(1, Math.ceil(words / 180))} min`;
}

function getServerPosts() {
  serverStore.__lurePublishedPosts ??= [];
  return serverStore.__lurePublishedPosts;
}

async function getWorkerEnv() {
  if (typeof window !== "undefined") return {} as CloudflareBindings;
  return (await import("cloudflare:workers")).env as CloudflareBindings;
}

async function getDb() {
  const workerEnv = await getWorkerEnv();
  return workerEnv.DB ?? null;
}

async function getSupabaseConfig(): Promise<SupabaseConfig | null> {
  const workerEnv = await getWorkerEnv();
  const url = workerEnv.SUPABASE_URL?.replace(/\/+$/, "");
  const key = workerEnv.SUPABASE_SECRET_KEY || workerEnv.SUPABASE_PUBLISHABLE_KEY;
  const publishableKey = workerEnv.SUPABASE_PUBLISHABLE_KEY || key;

  if (!url || !key || !publishableKey) return null;
  return { url, key, publishableKey };
}

async function supabaseFetch<T>(
  path: string,
  init: RequestInit = {},
  config?: SupabaseConfig | null,
): Promise<T> {
  config ??= await getSupabaseConfig();
  if (!config) throw new Error("Supabase nao esta configurado.");

  const response = await fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || `Erro Supabase: ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function getSupabaseUserFromToken(config: SupabaseConfig, adminToken: string) {
  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: {
      apikey: config.publishableKey,
      Authorization: `Bearer ${adminToken}`,
    },
  });

  if (!response.ok) throw new Error("Sessao de admin invalida.");
  return (await response.json()) as { id?: string; email?: string };
}

export async function requireAdmin(adminToken?: string) {
  const config = await getSupabaseConfig();
  const token = String(adminToken ?? "").trim();

  if (!config || !token) throw new Error("Nao autorizado.");

  const user = await getSupabaseUserFromToken(config, token);
  if (!user.id) throw new Error("Nao autorizado.");

  const admins = await supabaseFetch<Array<{ user_id: string; email: string }>>(
    `/rest/v1/admin_users?select=user_id,email&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
    { method: "GET" },
    config,
  );

  const admin = admins[0];
  if (!admin) throw new Error("Nao autorizado.");

  return {
    userId: user.id,
    email: admin.email || user.email || "",
  };
}

function postFromSupabaseRow(row: SupabasePostRow): PublishedPost {
  const blocks =
    typeof row.blocks === "string"
      ? (JSON.parse(row.blocks) as PublishedBlock[])
      : Array.isArray(row.blocks)
        ? row.blocks
        : [];
  const dateSource = row.published_at ?? row.updated_at ?? row.created_at ?? new Date().toISOString();

  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    categorySlug: row.category_slug,
    coverDataUrl: row.cover_url ?? "",
    blocks,
    date: new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(dateSource)),
    readTime: row.read_time,
    author: {
      name: row.author_name || author.name,
      avatar: row.author_avatar || author.avatar,
    },
  };
}

function toSupabasePayload(post: PublishedPost) {
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    category_slug: post.categorySlug,
    cover_url: post.coverDataUrl,
    blocks: post.blocks,
    status: "published",
    read_time: post.readTime,
    author_name: post.author.name,
    author_avatar: post.author.avatar,
    published_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function listSupabasePosts(config: SupabaseConfig) {
  const rows = await supabaseFetch<SupabasePostRow[]>(
    "/rest/v1/posts?select=*&status=eq.published&order=published_at.desc.nullslast,updated_at.desc",
    { method: "GET" },
    config,
  );

  return rows.map(postFromSupabaseRow);
}

async function getSupabasePost(config: SupabaseConfig, slug: string) {
  const rows = await supabaseFetch<SupabasePostRow[]>(
    `/rest/v1/posts?select=*&slug=eq.${encodeURIComponent(slug)}&limit=1`,
    { method: "GET" },
    config,
  );

  return rows[0] ? postFromSupabaseRow(rows[0]) : null;
}

async function createUniqueSupabaseSlug(config: SupabaseConfig, title: string) {
  const baseSlug = slugify(title) || "novo-post";
  const filter = encodeURIComponent(`(slug.eq.${baseSlug},slug.like.${baseSlug}-*)`);
  const rows = await supabaseFetch<Array<{ slug: string }>>(
    `/rest/v1/posts?select=slug&or=${filter}`,
    { method: "GET" },
    config,
  );
  const existing = new Set(rows.map((row) => row.slug));

  if (!existing.has(baseSlug)) return baseSlug;

  let index = 2;
  while (existing.has(`${baseSlug}-${index}`)) index += 1;
  return `${baseSlug}-${index}`;
}

async function upsertSupabasePost(config: SupabaseConfig, post: PublishedPost) {
  const rows = await supabaseFetch<SupabasePostRow[]>(
    "/rest/v1/posts?on_conflict=slug",
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(toSupabasePayload(post)),
    },
    config,
  );

  return rows[0] ? postFromSupabaseRow(rows[0]) : post;
}

async function deleteSupabasePost(config: SupabaseConfig, slug: string) {
  await supabaseFetch<void>(
    `/rest/v1/posts?slug=eq.${encodeURIComponent(slug)}`,
    { method: "DELETE", headers: { Prefer: "return=minimal" } },
    config,
  );
}

function parseDataUrl(value: string) {
  const match = value.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) return null;

  const mime = match[1] || "application/octet-stream";
  const isBase64 = Boolean(match[2]);
  const payload = match[3] || "";
  const binary = isBase64 ? atob(payload) : decodeURIComponent(payload);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return { mime, bytes };
}

function extensionFromMime(mime: string) {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  if (mime === "image/svg+xml") return "svg";
  return "bin";
}

function safeUploadSegment(value: string) {
  return slugify(value).replace(/^-+|-+$/g, "") || "imagem";
}

async function uploadSupabaseDataUrl(
  config: SupabaseConfig,
  dataUrl: string,
  postSlug: string,
  label: string,
) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return dataUrl;

  const path = `posts/${safeUploadSegment(postSlug)}/${Date.now()}-${safeUploadSegment(label)}.${extensionFromMime(parsed.mime)}`;
  const response = await fetch(
    `${config.url}/storage/v1/object/${SUPABASE_IMAGE_BUCKET}/${path}`,
    {
      method: "POST",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        "Content-Type": parsed.mime,
        "x-upsert": "true",
      },
      body: parsed.bytes,
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || `Nao consegui enviar imagem para o Supabase (${response.status}).`);
  }

  return `${config.url}/storage/v1/object/public/${SUPABASE_IMAGE_BUCKET}/${path}`;
}

async function uploadSupabasePostAssets(
  config: SupabaseConfig,
  post: PublishedPost,
): Promise<PublishedPost> {
  const coverDataUrl = post.coverDataUrl.startsWith("data:")
    ? await uploadSupabaseDataUrl(config, post.coverDataUrl, post.slug, "capa")
    : post.coverDataUrl;
  const blocks = await Promise.all(
    post.blocks.map(async (block, index) => {
      if (block.type !== "image" || !block.src?.startsWith("data:")) return block;

      return {
        ...block,
        src: await uploadSupabaseDataUrl(config, block.src, post.slug, block.alt || `imagem-${index + 1}`),
      };
    }),
  );

  return { ...post, coverDataUrl, blocks };
}

async function ensureD1Schema(db: D1Database) {
  if (serverStore.__lureD1SchemaReady) return;

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS published_posts (
      slug TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      excerpt TEXT NOT NULL,
      category_slug TEXT NOT NULL,
      cover_data_url TEXT NOT NULL DEFAULT '',
      blocks_json TEXT NOT NULL,
      date TEXT NOT NULL,
      read_time TEXT NOT NULL,
      author_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    )
    .run();

  await db
    .prepare("CREATE INDEX IF NOT EXISTS idx_published_posts_updated_at ON published_posts(updated_at DESC)")
    .run();

  await db
    .prepare("CREATE INDEX IF NOT EXISTS idx_published_posts_category ON published_posts(category_slug, updated_at DESC)")
    .run();

  serverStore.__lureD1SchemaReady = true;
}

function postFromRow(row: PublishedPostRow): PublishedPost {
  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    categorySlug: row.category_slug,
    coverDataUrl: row.cover_data_url,
    blocks: JSON.parse(row.blocks_json) as PublishedBlock[],
    date: row.date,
    readTime: row.read_time,
    author: JSON.parse(row.author_json) as PublishedPost["author"],
  };
}

async function listD1Posts(db: D1Database) {
  await ensureD1Schema(db);

  const rows = await db
    .prepare(
      `SELECT slug, title, excerpt, category_slug, cover_data_url, blocks_json, date, read_time, author_json
       FROM published_posts
       ORDER BY datetime(updated_at) DESC`,
    )
    .all<PublishedPostRow>();

  return (rows.results ?? []).map(postFromRow);
}

async function getD1Post(db: D1Database, slug: string) {
  await ensureD1Schema(db);

  const row = await db
    .prepare(
      `SELECT slug, title, excerpt, category_slug, cover_data_url, blocks_json, date, read_time, author_json
       FROM published_posts
       WHERE slug = ?`,
    )
    .bind(slug)
    .first<PublishedPostRow>();

  return row ? postFromRow(row) : null;
}

async function createUniqueSlug(db: D1Database, title: string) {
  await ensureD1Schema(db);

  const baseSlug = slugify(title) || "novo-post";
  const rows = await db
    .prepare("SELECT slug FROM published_posts WHERE slug = ? OR slug LIKE ?")
    .bind(baseSlug, `${baseSlug}-%`)
    .all<{ slug: string }>();
  const existing = new Set((rows.results ?? []).map((row) => row.slug));

  if (!existing.has(baseSlug)) return baseSlug;

  let index = 2;
  while (existing.has(`${baseSlug}-${index}`)) index += 1;
  return `${baseSlug}-${index}`;
}

async function upsertD1Post(db: D1Database, post: PublishedPost) {
  await ensureD1Schema(db);

  await db
    .prepare(
      `INSERT INTO published_posts (
        slug,
        title,
        excerpt,
        category_slug,
        cover_data_url,
        blocks_json,
        date,
        read_time,
        author_json,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(slug) DO UPDATE SET
        title = excluded.title,
        excerpt = excluded.excerpt,
        category_slug = excluded.category_slug,
        cover_data_url = excluded.cover_data_url,
        blocks_json = excluded.blocks_json,
        read_time = excluded.read_time,
        author_json = excluded.author_json,
        updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(
      post.slug,
      post.title,
      post.excerpt,
      post.categorySlug,
      post.coverDataUrl,
      JSON.stringify(post.blocks),
      post.date,
      post.readTime,
      JSON.stringify(post.author),
    )
    .run();
}

async function deleteD1Post(db: D1Database, slug: string) {
  await ensureD1Schema(db);
  await db.prepare("DELETE FROM published_posts WHERE slug = ?").bind(slug).run();
}

function uniquePosts(posts: PublishedPost[]) {
  const bySlug = new Map<string, PublishedPost>();

  for (const post of posts) {
    if (!bySlug.has(post.slug)) bySlug.set(post.slug, post);
  }

  return Array.from(bySlug.values());
}

function makePublishedPost(data: PublishedPostInput & { slug: string }, previous?: PublishedPost | null): PublishedPost {
  const { adminToken: _adminToken, ...postData } = data;

  return {
    ...postData,
    date:
      previous?.date ??
      new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date()),
    readTime: estimateReadTime(data.blocks),
    author: previous?.author ?? author,
  };
}

async function saveFallbackPost(post: PublishedPost) {
  const db = await getDb();

  if (db) {
    await upsertD1Post(db, post);
    return post;
  }

  const posts = getServerPosts();
  const index = posts.findIndex((item) => item.slug === post.slug);

  if (index >= 0) {
    posts[index] = post;
  } else {
    posts.unshift(post);
  }

  return post;
}

function normalizeTableCell(cell: unknown): PublishedTableCell {
  const current = cell as Partial<PublishedTableCell>;
  const align = current.align === "center" || current.align === "right" ? current.align : "left";
  const width = Number(current.width ?? 140);
  const height = Number(current.height ?? 44);

  return {
    text: String(current.text ?? ""),
    align,
    color: String(current.color ?? "default"),
    width: Number.isFinite(width) ? Math.min(420, Math.max(60, width)) : 140,
    height: Number.isFinite(height) ? Math.min(180, Math.max(34, height)) : 44,
  };
}

function normalizeTable(table: unknown): PublishedTable | undefined {
  const current = table as Partial<PublishedTable>;
  const rows = Array.isArray(current?.rows) ? current.rows : [];
  const normalizedRows = rows
    .map((row) => (Array.isArray(row) ? row.map(normalizeTableCell) : []))
    .filter((row) => row.length > 0);

  if (normalizedRows.length === 0) return undefined;

  return {
    title: String(current.title ?? "").trim(),
    mode: current.mode === "scroll" ? "scroll" : "fit",
    rows: normalizedRows,
  };
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function normalizeDiagramNode(raw: unknown, index: number): DiagramNode | null {
  const current = raw as Partial<DiagramNode>;
  const type =
    current?.type === "rectangle" ||
    current?.type === "square" ||
    current?.type === "circle" ||
    current?.type === "pill" ||
    current?.type === "text"
      ? current.type
      : "rectangle";
  const id = String(current?.id ?? `node-${index}`);
  const text = String(current?.text ?? "").slice(0, 240);
  const x = clamp(Number(current?.x ?? 40), 0, 4000);
  const y = clamp(Number(current?.y ?? 40), 0, 4000);
  const width = clamp(Number(current?.width ?? 160), 40, 600);
  const height = clamp(Number(current?.height ?? 80), 40, 600);
  const color = String(current?.color ?? "default");
  const fontSize = clamp(Number(current?.fontSize ?? 24), 10, 96);
  const fontFamily =
    current?.fontFamily === "serif" || current?.fontFamily === "script" ? current.fontFamily : "sans";
  const bold = current?.bold === true;

  if (!id) return null;

  return { id, type, text, x, y, width, height, color, fontSize, fontFamily, bold };
}

function normalizeDiagramEdge(
  raw: unknown,
  index: number,
  validIds: Set<string>,
): DiagramEdge | null {
  const current = raw as Partial<DiagramEdge>;
  const id = String(current?.id ?? `edge-${index}`);
  const fromId = String(current?.fromId ?? "");
  const toId = String(current?.toId ?? "");
  const label = String(current?.label ?? "").slice(0, 80);

  if (!fromId || !toId || fromId === toId) return null;
  if (!validIds.has(fromId) || !validIds.has(toId)) return null;

  return { id, fromId, toId, label, arrow: current.arrow !== false };
}

function normalizeDiagramLine(raw: unknown, index: number): DiagramLine | null {
  const current = raw as Partial<DiagramLine>;
  const id = String(current?.id ?? `line-${index}`);
  if (!id) return null;

  return {
    id,
    x1: clamp(Number(current?.x1 ?? 80), 0, 4000),
    y1: clamp(Number(current?.y1 ?? 80), 0, 4000),
    x2: clamp(Number(current?.x2 ?? 240), 0, 4000),
    y2: clamp(Number(current?.y2 ?? 80), 0, 4000),
    color: String(current?.color ?? "sand"),
    arrow: current.arrow === true,
  };
}

function normalizeDiagram(diagram: unknown): Diagram | undefined {
  const current = diagram as Partial<Diagram>;
  const rawNodes = Array.isArray(current?.nodes) ? current.nodes : [];
  const rawEdges = Array.isArray(current?.edges) ? current.edges : [];
  const rawLines = Array.isArray(current?.lines) ? current.lines : [];

  const nodes = rawNodes
    .map((node, index) => normalizeDiagramNode(node, index))
    .filter((node): node is DiagramNode => node !== null);

  if (nodes.length === 0) return undefined;

  const validIds = new Set(nodes.map((node) => node.id));
  const edges = rawEdges
    .map((edge, index) => normalizeDiagramEdge(edge, index, validIds))
    .filter((edge): edge is DiagramEdge => edge !== null);

  return {
    width: clamp(Number(current?.width ?? 720), 320, 2400),
    height: clamp(Number(current?.height ?? 420), 200, 2000),
    nodes,
    edges,
    lines: rawLines
      .map((line, index) => normalizeDiagramLine(line, index))
      .filter((line): line is DiagramLine => line !== null),
  };
}

function normalizePostInput(data: unknown): PublishedPostInput {
  const input = data as Partial<PublishedPostInput>;
  const title = String(input.title ?? "").trim();
  const excerpt = String(input.excerpt ?? "").trim();
  const categorySlug = String(input.categorySlug ?? "").trim();
  const coverDataUrl = String(input.coverDataUrl ?? "").trim();
  const adminToken = String(input.adminToken ?? "").trim();
  const blocks = Array.isArray(input.blocks) ? input.blocks : [];

  if (!title) throw new Error("Titulo obrigatorio.");
  if (!excerpt) throw new Error("Resumo obrigatorio.");
  if (!categories.some((category) => category.slug === categorySlug)) {
    throw new Error("Categoria invalida.");
  }

  const normalizedBlocks = blocks
    .map((block, index) => {
      const current = block as Partial<PublishedBlock>;
      const allowedTypes: PublishedBlockType[] = [
        "quote",
        "code",
        "latex",
        "divider",
        "image",
        "list",
        "table",
        "diagram",
      ];
      const type: PublishedBlockType =
        current.type && allowedTypes.includes(current.type) ? current.type : "paragraph";
      const text = String(current.text ?? "").trim();
      const table = normalizeTable(current.table);
      const diagram = normalizeDiagram(current.diagram);

      return {
        id: String(current.id ?? `block-${index}`),
        type,
        text,
        color: String(current.color ?? "default"),
        bold: Boolean(current.bold),
        html: String(current.html ?? "").trim(),
        language: String(current.language ?? "text").trim(),
        filename: String(current.filename ?? "").trim(),
        src: String(current.src ?? "").trim(),
        alt: String(current.alt ?? "").trim(),
        width: Number(current.width ?? 100),
        table,
        diagram,
      };
    })
    .filter(
      (block) =>
        block.type === "divider" ||
        block.type === "image" ||
        block.type === "list" ||
        block.type === "table" ||
        (block.type === "diagram" && block.diagram) ||
        block.text.length > 0 ||
        block.html.length > 0,
    );

  if (normalizedBlocks.length === 0) {
    throw new Error("Adicione pelo menos um bloco com conteudo.");
  }

  return {
    title,
    excerpt,
    categorySlug,
    coverDataUrl,
    blocks: normalizedBlocks,
    adminToken,
  };
}

function normalizePostUpdateInput(data: unknown): PublishedPostUpdateInput {
  const input = data as Partial<PublishedPostUpdateInput>;
  const normalized = normalizePostInput(input);
  const slug = String(input.slug ?? "").trim();

  if (!slug) throw new Error("Slug obrigatorio.");

  return {
    ...normalized,
    slug,
  };
}

function normalizeAdminTokenInput(data: unknown) {
  return { adminToken: String((data as { adminToken?: unknown })?.adminToken ?? "").trim() };
}

function normalizeDeletePostInput(data: unknown) {
  return {
    slug: String((data as { slug?: unknown })?.slug ?? "").trim(),
    adminToken: String((data as { adminToken?: unknown })?.adminToken ?? "").trim(),
  };
}

export const checkAdminSession = createServerFn({ method: "POST" })
  .inputValidator(normalizeAdminTokenInput)
  .handler(async ({ data }) => requireAdmin(data.adminToken));

export const publishPost = createServerFn({ method: "POST" })
  .inputValidator(normalizePostInput)
  .handler(async ({ data }) => {
    await requireAdmin(data.adminToken);

    const supabase = await getSupabaseConfig();
    if (supabase) {
      try {
        const slug = await createUniqueSupabaseSlug(supabase, data.title);
        const post = makePublishedPost({ ...data, slug });
        const postWithAssets = await uploadSupabasePostAssets(supabase, post);

        return upsertSupabasePost(supabase, postWithAssets);
      } catch {
        const baseSlug = slugify(data.title) || "novo-post";
        const db = await getDb();
        const slug = db ? await createUniqueSlug(db, data.title) : `${baseSlug}-${Date.now()}`;

        return saveFallbackPost(makePublishedPost({ ...data, slug }));
      }
    }

    const db = await getDb();
    const posts = db ? [] : getServerPosts();
    const slug = db
      ? await createUniqueSlug(db, data.title)
      : (() => {
          const baseSlug = slugify(data.title) || "novo-post";
          const repeated = posts.filter(
            (post) => post.slug === baseSlug || post.slug.startsWith(`${baseSlug}-`),
          );
          return repeated.length > 0 ? `${baseSlug}-${repeated.length + 1}` : baseSlug;
        })();
    const post = makePublishedPost({ ...data, slug });

    if (db) {
      await upsertD1Post(db, post);
    } else {
      posts.unshift(post);
    }

    return post;
  });

export const updatePublishedPost = createServerFn({ method: "POST" })
  .inputValidator(normalizePostUpdateInput)
  .handler(async ({ data }) => {
    await requireAdmin(data.adminToken);

    const supabase = await getSupabaseConfig();
    if (supabase) {
      try {
        const previous = await getSupabasePost(supabase, data.slug);
        const post = makePublishedPost(data, previous);
        const postWithAssets = await uploadSupabasePostAssets(supabase, post);

        return upsertSupabasePost(supabase, postWithAssets);
      } catch {
        return saveFallbackPost(makePublishedPost(data));
      }
    }

    const db = await getDb();
    const posts = db ? [] : getServerPosts();
    const previous = db
      ? await getD1Post(db, data.slug)
      : posts.find((post) => post.slug === data.slug) ?? null;
    const post = makePublishedPost(data, previous);

    if (db) {
      await upsertD1Post(db, post);
    } else {
      const index = posts.findIndex((item) => item.slug === data.slug);
      if (index >= 0) {
        posts[index] = post;
      } else {
        posts.unshift(post);
      }
    }

    return post;
  });

export const deletePublishedPost = createServerFn({ method: "POST" })
  .inputValidator(normalizeDeletePostInput)
  .handler(async ({ data }) => {
    await requireAdmin(data.adminToken);

    if (!data.slug) throw new Error("Slug obrigatorio.");

    const supabase = await getSupabaseConfig();
    if (supabase) {
      try {
        await deleteSupabasePost(supabase, data.slug);
      } catch {
        // D1/local fallback below still keeps admin actions useful.
      }
    }

    const db = await getDb();
    if (db) {
      await deleteD1Post(db, data.slug);
    } else {
      const posts = getServerPosts();
      const index = posts.findIndex((post) => post.slug === data.slug);
      if (index >= 0) posts.splice(index, 1);
    }

    return { ok: true };
  });

export const listPublishedPosts = createServerFn({ method: "GET" }).handler(async () => {
  const posts: PublishedPost[] = [];
  const supabase = await getSupabaseConfig();
  if (supabase) {
    try {
      posts.push(...(await listSupabasePosts(supabase)));
    } catch {
      // Keep the public site available even if Supabase rejects a request.
    }
  }

  const db = await getDb();
  if (db) {
    try {
      posts.push(...(await listD1Posts(db)));
    } catch {
      // The in-memory store below is still useful during local development.
    }
  }

  if (posts.length === 0) posts.push(...getServerPosts());

  return uniquePosts(posts);
});

export const getPublishedPost = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ({ slug: String((data as { slug?: unknown })?.slug ?? "") }))
  .handler(async ({ data }) => {
    const supabase = await getSupabaseConfig();
    if (supabase) {
      try {
        const post = await getSupabasePost(supabase, data.slug);
        if (post) return post;
      } catch {
        // Fall through to D1/local fallback.
      }
    }

    const db = await getDb();
    if (db) {
      try {
        const post = await getD1Post(db, data.slug);
        if (post) return post;
      } catch {
        // Fall through to local fallback.
      }
    }

    return getServerPosts().find((post) => post.slug === data.slug) ?? null;
  });

export function getLocalPublishedPosts() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as PublishedPost[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalPublishedPost(post: PublishedPost) {
  if (typeof window === "undefined") return;

  const current = getLocalPublishedPosts().filter((item) => item.slug !== post.slug);
  window.localStorage.setItem(STORE_KEY, JSON.stringify([post, ...current].slice(0, 30)));
}

export function removeLocalPublishedPost(slug: string) {
  if (typeof window === "undefined") return;

  const current = getLocalPublishedPosts().filter((item) => item.slug !== slug);
  window.localStorage.setItem(STORE_KEY, JSON.stringify(current));
}

export function getLocalPublishedPost(slug: string) {
  return getLocalPublishedPosts().find((post) => post.slug === slug) ?? null;
}

export function publishedPostToPost(post: PublishedPost): Post {
  const category = categories.find((item) => item.slug === post.categorySlug) ?? categories[0];

  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    cover: post.coverDataUrl || fallbackCover,
    category,
    author: post.author,
    date: post.date,
    readTime: post.readTime,
  };
}

export async function loadPublishedPosts() {
  const localPosts = getLocalPublishedPosts();
  let serverPosts: PublishedPost[] = [];

  try {
    serverPosts = await listPublishedPosts();
  } catch {
    serverPosts = [];
  }

  const bySlug = new Map<string, PublishedPost>();
  for (const post of [...localPosts, ...serverPosts]) {
    if (!bySlug.has(post.slug)) bySlug.set(post.slug, post);
  }

  return Array.from(bySlug.values()).map(publishedPostToPost);
}
