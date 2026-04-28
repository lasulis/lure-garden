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
};

export type PublishedPostUpdateInput = PublishedPostInput & {
  slug: string;
};

export type PublishedPost = PublishedPostInput & {
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
};

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

export const publishPost = createServerFn({ method: "POST" })
  .inputValidator(normalizePostInput)
  .handler(({ data }) => {
    const posts = getServerPosts();
    const baseSlug = slugify(data.title) || "novo-post";
    const repeated = posts.filter(
      (post) => post.slug === baseSlug || post.slug.startsWith(`${baseSlug}-`),
    );
    const slug = repeated.length > 0 ? `${baseSlug}-${repeated.length + 1}` : baseSlug;
    const post: PublishedPost = {
      ...data,
      slug,
      date: new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date()),
      readTime: estimateReadTime(data.blocks),
      author,
    };

    posts.unshift(post);

    return post;
  });

export const updatePublishedPost = createServerFn({ method: "POST" })
  .inputValidator(normalizePostUpdateInput)
  .handler(({ data }) => {
    const posts = getServerPosts();
    const index = posts.findIndex((post) => post.slug === data.slug);
    const previous = index >= 0 ? posts[index] : null;
    const post: PublishedPost = {
      ...data,
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

    if (index >= 0) {
      posts[index] = post;
    } else {
      posts.unshift(post);
    }

    return post;
  });

export const listPublishedPosts = createServerFn({ method: "GET" }).handler(() => {
  return getServerPosts();
});

export const getPublishedPost = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ({ slug: String((data as { slug?: unknown })?.slug ?? "") }))
  .handler(({ data }) => {
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
