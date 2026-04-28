import type { Diagram, DiagramEdge, DiagramLine, DiagramNode, DiagramShape } from "@/lib/publishing";

export const DIAGRAM_PALETTE: Record<string, { stroke: string; fill: string; text: string }> = {
  default: {
    stroke: "var(--border)",
    fill: "color-mix(in oklch, var(--card) 90%, var(--primary) 4%)",
    text: "var(--foreground)",
  },
  primary: {
    stroke: "color-mix(in oklch, var(--primary) 70%, transparent)",
    fill: "color-mix(in oklch, var(--primary) 18%, transparent)",
    text: "var(--primary)",
  },
  leaf: {
    stroke: "color-mix(in oklch, var(--leaf) 70%, transparent)",
    fill: "color-mix(in oklch, var(--leaf) 18%, transparent)",
    text: "var(--leaf)",
  },
  clay: {
    stroke: "color-mix(in oklch, var(--clay) 70%, transparent)",
    fill: "color-mix(in oklch, var(--clay) 18%, transparent)",
    text: "var(--clay)",
  },
  sand: {
    stroke: "color-mix(in oklch, var(--sand) 70%, transparent)",
    fill: "color-mix(in oklch, var(--sand) 22%, transparent)",
    text: "var(--sand)",
  },
  muted: {
    stroke: "color-mix(in oklch, var(--muted-foreground) 60%, transparent)",
    fill: "color-mix(in oklch, var(--muted-foreground) 14%, transparent)",
    text: "var(--muted-foreground)",
  },
};

export function paletteFor(color: string) {
  return DIAGRAM_PALETTE[color] ?? DIAGRAM_PALETTE.default;
}

export function defaultNodeSize(type: DiagramShape) {
  if (type === "text") return { width: 260, height: 90 };
  if (type === "pill") return { width: 170, height: 76 };
  if (type === "circle") return { width: 110, height: 110 };
  if (type === "square") return { width: 110, height: 110 };
  return { width: 170, height: 84 };
}

export function makeDiagramId(prefix: string) {
  const random =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return `${prefix}-${random.slice(0, 12)}`;
}

export function emptyDiagram(): Diagram {
  const first: DiagramNode = {
    id: makeDiagramId("node"),
    type: "rectangle",
    text: "Inicio",
    x: 60,
    y: 130,
    width: 170,
    height: 84,
    color: "default",
  };

  return {
    width: 720,
    height: 400,
    nodes: [first],
    edges: [],
    lines: [],
  };
}

export function nodeCenter(node: DiagramNode) {
  return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
}

/** Returns the boundary point of a node along the line going toward (tx, ty). */
export function nodeBoundaryPoint(node: DiagramNode, tx: number, ty: number) {
  const center = nodeCenter(node);
  const dx = tx - center.x;
  const dy = ty - center.y;
  const length = Math.hypot(dx, dy);

  if (length < 0.0001) return center;

  if (node.type === "circle") {
    const rx = node.width / 2;
    const ry = node.height / 2;
    // Parametric ellipse
    const denom = Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
    if (denom < 0.0001) return center;
    return {
      x: center.x + dx / denom,
      y: center.y + dy / denom,
    };
  }

  // Rectangle / square
  const halfW = node.width / 2;
  const halfH = node.height / 2;
  const tX = dx === 0 ? Number.POSITIVE_INFINITY : halfW / Math.abs(dx);
  const tY = dy === 0 ? Number.POSITIVE_INFINITY : halfH / Math.abs(dy);
  const t = Math.min(tX, tY);

  return {
    x: center.x + dx * t,
    y: center.y + dy * t,
  };
}

export type EdgeGeometry = {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  midX: number;
  midY: number;
};

export function computeEdgeGeometry(edge: DiagramEdge, nodes: DiagramNode[]): EdgeGeometry | null {
  const from = nodes.find((node) => node.id === edge.fromId);
  const to = nodes.find((node) => node.id === edge.toId);
  if (!from || !to) return null;

  const fromCenter = nodeCenter(from);
  const toCenter = nodeCenter(to);
  const start = nodeBoundaryPoint(from, toCenter.x, toCenter.y);
  const end = nodeBoundaryPoint(to, fromCenter.x, fromCenter.y);

  return {
    fromX: start.x,
    fromY: start.y,
    toX: end.x,
    toY: end.y,
    midX: (start.x + end.x) / 2,
    midY: (start.y + end.y) / 2,
  };
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function wrapTextLines(text: string, maxChars: number) {
  const paragraphs = text.split(/\r?\n/);
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.replace(/[ \t]+/g, " ").trim().split(" ");
    let current = "";

    for (const word of words) {
      if (!word) continue;
      if (!current) {
        current = word;
      } else if (current.length + word.length + 1 <= maxChars) {
        current = `${current} ${word}`;
      } else {
        lines.push(current);
        current = word;
      }
    }

    lines.push(current);
  }

  return lines.slice(0, 12);
}

function nodeShapeMarkup(node: DiagramNode) {
  const palette = paletteFor(node.color);
  const fill = palette.fill;
  const stroke = palette.stroke;

  if (node.type === "text") return "";

  if (node.type === "circle") {
    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;
    const rx = node.width / 2;
    const ry = node.height / 2;
    return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="1.6" />`;
  }

  const radius = node.type === "pill" ? Math.min(node.height / 2, 999) : 14;
  return `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="${radius}" ry="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="1.6" />`;
}

function nodeLabelMarkup(node: DiagramNode) {
  const palette = paletteFor(node.color);
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const fontSize = node.type === "text" ? (node.fontSize ?? 24) : 13;
  const lines = wrapTextLines(node.text, node.type === "text" ? Math.max(8, Math.floor(node.width / Math.max(7, fontSize * 0.48))) : node.type === "circle" ? 14 : 22);
  if (lines.length === 0) lines.push("");
  const lineHeight = 16;
  const startY = cy - ((lines.length - 1) * lineHeight) / 2;

  const tspans = lines
    .map((line, index) => {
      const y = startY + index * lineHeight;
      return `<tspan x="${cx}" y="${y}">${escapeXml(line) || "&#160;"}</tspan>`;
    })
    .join("");

  const anchor = node.type === "text" ? "start" : "middle";
  const x = node.type === "text" ? node.x : cx;
  const fontFamily =
    node.fontFamily === "serif"
      ? "var(--font-display, serif)"
      : node.fontFamily === "script"
        ? "var(--font-script, cursive)"
        : "var(--font-sans, sans-serif)";
  const adjusted = node.type === "text"
    ? lines
        .map((line, index) => `<tspan x="${x}" y="${node.y + fontSize + index * fontSize * 1.25}">${escapeXml(line) || "&#160;"}</tspan>`)
        .join("")
    : tspans;
  const weight = node.type === "text" ? (node.bold ? 700 : 500) : 500;
  return `<text text-anchor="${anchor}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="${weight}" fill="${palette.text}">${adjusted}</text>`;
}

function edgeMarkup(edge: DiagramEdge, nodes: DiagramNode[], strokeColor: string) {
  const geometry = computeEdgeGeometry(edge, nodes);
  if (!geometry) return "";

  const labelMarkup = edge.label
    ? `<g><rect x="${geometry.midX - Math.max(28, edge.label.length * 4.4)}" y="${geometry.midY - 11}" width="${Math.max(56, edge.label.length * 8.8)}" height="22" rx="11" ry="11" fill="var(--card)" stroke="${strokeColor}" stroke-width="0.8" opacity="0.95" /><text x="${geometry.midX}" y="${geometry.midY + 4}" text-anchor="middle" font-family="var(--font-sans, sans-serif)" font-size="11" fill="var(--foreground)">${escapeXml(edge.label)}</text></g>`
    : "";

  const marker = edge.arrow === false ? "" : ' marker-end="url(#lure-diagram-arrow)"';
  return `<line x1="${geometry.fromX}" y1="${geometry.fromY}" x2="${geometry.toX}" y2="${geometry.toY}" stroke="${strokeColor}" stroke-width="1.6"${marker} />${labelMarkup}`;
}

function freeLineMarkup(line: DiagramLine, strokeColor: string) {
  const palette = paletteFor(line.color);
  const marker = line.arrow ? ' marker-end="url(#lure-diagram-arrow)"' : "";
  return `<line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" stroke="${palette.stroke || strokeColor}" stroke-width="2"${marker} />`;
}

export type DiagramSvgOptions = {
  background?: boolean;
  padding?: number;
  className?: string;
};

export function diagramToSvg(diagram: Diagram, options: DiagramSvgOptions = {}) {
  const { background = true, padding = 16, className = "" } = options;
  const width = Math.max(diagram.width, 320);
  const height = Math.max(diagram.height, 200);
  const strokeColor = "color-mix(in oklch, var(--muted-foreground) 65%, transparent)";

  const defs = `<defs><marker id="lure-diagram-arrow" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M 0 0 L 12 6 L 0 12 z" fill="${strokeColor}" /></marker></defs>`;

  const bg = background
    ? `<rect x="0" y="0" width="${width}" height="${height}" rx="18" ry="18" fill="color-mix(in oklch, var(--background) 92%, var(--primary) 2%)" stroke="var(--border)" stroke-width="1" />`
    : "";

  const freeLines = (diagram.lines ?? []).map((line) => freeLineMarkup(line, strokeColor)).join("");
  const edges = diagram.edges.map((edge) => edgeMarkup(edge, diagram.nodes, strokeColor)).join("");
  const shapes = diagram.nodes.map(nodeShapeMarkup).join("");
  const labels = diagram.nodes.map(nodeLabelMarkup).join("");

  return `<svg viewBox="${-padding} ${-padding} ${width + padding * 2} ${height + padding * 2}" preserveAspectRatio="xMidYMid meet" class="${className}" xmlns="http://www.w3.org/2000/svg">${defs}${bg}${freeLines}${edges}${shapes}${labels}</svg>`;
}
