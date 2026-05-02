import { createFileRoute } from "@tanstack/react-router";
import {
  Bold,
  Code2,
  Eye,
  Heading1,
  Heading2,
  ImagePlus,
  List,
  Minus,
  Palette,
  Quote,
  Save,
  Sigma,
  Sparkles,
  Table2,
  Type,
  Workflow,
  Redo2,
  Undo2,
} from "lucide-react";
import { type CSSProperties, type FormEvent, type KeyboardEvent, type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CodeBlock } from "@/components/CodeBlock";
import { DataFrameTable } from "@/components/DataFrameTable";
import { DiagramEditor } from "@/components/DiagramEditor";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { useAdminSession } from "@/hooks/use-admin-session";
import {
  type TechnicalReviewResult,
  reviewGrammar,
  reviewTechnicalContent,
} from "@/lib/ai-review";
import { diagramToSvg, emptyDiagram, makeDiagramId } from "@/lib/diagram";
import { renderLatexHtml } from "@/lib/latex-render";
import { categories } from "@/lib/posts";
import {
  type Diagram,
  type PublishedBlock,
  type PublishedPost,
  type PublishedTable,
  type PublishedTableCell,
  getLocalPublishedPost,
  getPublishedPost,
  publishPost,
  saveLocalPublishedPost,
  updatePublishedPost,
} from "@/lib/publishing";

export const Route = createFileRoute("/escrever")({
  head: () => ({
    meta: [
      { title: "Escrever — lure.garden" },
      { name: "description", content: "Editor para publicar novos posts no jardim digital." },
      { property: "og:title", content: "Escrever — lure.garden" },
      { property: "og:description", content: "Crie posts com capa, quotes, codigo e texto colorido." },
    ],
  }),
  component: WritePage,
});

const textColors = [
  { value: "default", label: "Texto", css: "var(--foreground)", swatch: "bg-foreground" },
  { value: "muted", label: "Suave", css: "var(--muted-foreground)", swatch: "bg-muted-foreground" },
  { value: "primary", label: "Berry", css: "var(--primary)", swatch: "bg-primary" },
  { value: "leaf", label: "Folha", css: "var(--leaf)", swatch: "bg-leaf" },
  { value: "clay", label: "Argila", css: "var(--clay)", swatch: "bg-clay" },
  { value: "sand", label: "Areia", css: "var(--sand)", swatch: "bg-sand" },
];

const fontFamilies = [
  { value: "sans", label: "Sem serifa", css: "var(--font-sans)" },
  { value: "serif", label: "Serifa", css: "var(--font-display)" },
  { value: "script", label: "Estilizada", css: "var(--font-script)" },
];

const fontPresets = [
  { value: "body", label: "Texto", size: 16, family: "sans", icon: Type },
  { value: "subtitle", label: "Subtitulo", size: 24, family: "serif", icon: Heading2 },
  { value: "title", label: "Titulo", size: 36, family: "serif", icon: Heading1 },
];

const slashMenuItems = [
  { id: "font-body", label: "Texto", description: "16px sem serifa", icon: Type, preset: "body" },
  { id: "font-subtitle", label: "Subtitulo", description: "24px com serifa", icon: Heading2, preset: "subtitle" },
  { id: "font-title", label: "Titulo", description: "36px com serifa", icon: Heading1, preset: "title" },
  { id: "quote", label: "Quote", description: "Bloco de citacao", icon: Quote, command: "quote" },
  { id: "code", label: "Codigo Python", description: "Bloco com highlight", icon: Code2, command: "code" },
  { id: "latex", label: "LaTeX", description: "Formula renderizada", icon: Sigma, command: "latex" },
  { id: "table", label: "Tabela dataframe", description: "Linhas e colunas", icon: Table2, command: "table" },
  { id: "diagram", label: "Organograma", description: "Fluxograma visual", icon: Workflow, command: "diagram" },
  { id: "divider", label: "Divisor", description: "Linha horizontal", icon: Minus, command: "divider" },
  { id: "bullet", label: "Bullet point", description: "Lista indentavel", icon: List, command: "bullet" },
] as const;

const writerTheme = {
  "--background": "oklch(0 0 0)",
  "--foreground": "oklch(0.96 0.01 100)",
  "--card": "oklch(0.095 0.01 145)",
  "--border": "oklch(0.24 0.018 145)",
  "--input": "oklch(0.13 0.012 145)",
  "--secondary": "oklch(0.15 0.014 145)",
  "--muted": "oklch(0.16 0.014 145)",
  "--muted-foreground": "oklch(0.72 0.025 120)",
  "--code-background": "oklch(0.13 0.012 80)",
  "--code-header-background": "oklch(0.11 0.01 80)",
  "--code-foreground": "oklch(0.95 0.012 100 / 0.9)",
  "--code-caret": "oklch(1 0 0)",
} as CSSProperties;

const emptyEditor = "<p><br></p>";
const draftPrefix = "lure.garden.writer-draft";

type WriterDraft = {
  title: string;
  excerpt: string;
  categorySlug: string;
  coverDataUrl: string;
  editorHtml: string;
  savedAt: number;
};

type GrammarTextTarget =
  | {
      id: string;
      kind: "title" | "excerpt";
      text: string;
    }
  | {
      id: string;
      kind: "node";
      text: string;
      node: Text;
    };

type TechnicalReviewDialog = {
  result: TechnicalReviewResult;
  originalText: string;
  canApply: boolean;
  suggestedHtml: string;
} | null;

function draftKey(slug: string) {
  return `${draftPrefix}:${slug || "novo"}`;
}

function readWriterDraft(slug: string) {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(draftKey(slug));
    return raw ? (JSON.parse(raw) as WriterDraft) : null;
  } catch {
    return null;
  }
}

function saveWriterDraft(slug: string, draft: WriterDraft) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(draftKey(slug), JSON.stringify(draft));
}

function clearWriterDraft(slug: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(draftKey(slug));
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? String(Date.now());
}

function textFromHtml(html: string) {
  if (typeof document === "undefined") return html.replace(/<[^>]+>/g, " ");

  const container = document.createElement("div");
  container.innerHTML = html;
  return container.textContent ?? "";
}

function countWordsFromHtml(html: string) {
  return textFromHtml(html)
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function isInsideIgnoredAiElement(node: Node) {
  const element = node.parentElement;

  return Boolean(
    element?.closest(
      [
        "[data-lure-code-widget]",
        "[data-lure-latex-widget]",
        "[data-lure-table-widget]",
        "[data-lure-diagram-widget]",
        "[data-lure-image-figure]",
        "pre",
        "code",
        "table",
        "figure",
      ].join(","),
    ),
  );
}

function collectGrammarTextTargets(root: HTMLElement | null, title: string, excerpt: string) {
  const targets: GrammarTextTarget[] = [];

  if (title.trim()) {
    targets.push({ id: "meta-title", kind: "title", text: title });
  }

  if (excerpt.trim()) {
    targets.push({ id: "meta-excerpt", kind: "excerpt", text: excerpt });
  }

  if (!root || typeof document === "undefined") return targets;

  let index = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
      if (isInsideIgnoredAiElement(node)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let current = walker.nextNode();
  while (current) {
    targets.push({
      id: `editor-text-${index}`,
      kind: "node",
      text: current.textContent ?? "",
      node: current as Text,
    });
    index += 1;
    current = walker.nextNode();
  }

  return targets;
}

function collectReviewText(root: HTMLElement | null, title: string, excerpt: string) {
  const pieces = [title.trim(), excerpt.trim()].filter(Boolean);

  if (!root || typeof document === "undefined") return pieces.join("\n\n");

  const clone = root.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll(
      [
        "[data-lure-code-widget]",
        "[data-lure-latex-widget]",
        "[data-lure-table-widget]",
        "[data-lure-diagram-widget]",
        "[data-lure-image-figure]",
        "pre",
        "code",
        "table",
        "figure",
      ].join(","),
    )
    .forEach((element) => element.remove());

  const editorText = clone.textContent?.replace(/\n{3,}/g, "\n\n").trim();
  if (editorText) pieces.push(editorText);
  return pieces.join("\n\n");
}

function cleanSelectionHtmlForAi(range: Range | null) {
  if (!range || typeof document === "undefined") return "";

  const container = document.createElement("div");
  container.appendChild(range.cloneContents());

  const cleanNode = (node: Node): Node | DocumentFragment | null => {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent ?? "");
    if (!(node instanceof HTMLElement)) return null;

    const tag = node.tagName.toLowerCase();
    if (["script", "style", "img", "svg", "button", "input", "textarea", "select"].includes(tag)) {
      return null;
    }

    const children = Array.from(node.childNodes)
      .map(cleanNode)
      .filter((child): child is Node | DocumentFragment => Boolean(child));

    if (tag === "br") return document.createElement("br");

    const allowedTag = ["span", "strong", "b", "em", "i"].includes(tag) ? tag : "";
    const next = allowedTag ? document.createElement(allowedTag) : document.createDocumentFragment();

    if (next instanceof HTMLElement && tag === "span") {
      const color = node.dataset.lureColor;
      const fontSize = node.dataset.lureFontSize;
      const fontFamily = node.dataset.lureFontFamily;

      if (color && textColors.some((item) => item.value === color)) next.dataset.lureColor = color;
      if (fontSize && Number.isFinite(Number(fontSize))) next.dataset.lureFontSize = fontSize;
      if (fontFamily && fontFamilies.some((item) => item.value === fontFamily)) {
        next.dataset.lureFontFamily = fontFamily;
      }
    }

    children.forEach((child) => next.appendChild(child));
    return next;
  };

  const cleaned = document.createElement("div");
  Array.from(container.childNodes).forEach((node) => {
    const clean = cleanNode(node);
    if (clean) cleaned.appendChild(clean);
  });

  return cleaned.innerHTML;
}

function sanitizeAiSuggestionHtml(html: string) {
  if (typeof document === "undefined" || !html.trim()) return null;

  const template = document.createElement("template");
  template.innerHTML = html;

  const cleanNode = (node: Node): Node | DocumentFragment | null => {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent ?? "");
    if (!(node instanceof HTMLElement)) return null;

    const tag = node.tagName.toLowerCase();
    if (tag === "br") return document.createElement("br");

    const allowedTag = ["span", "strong", "b", "em", "i"].includes(tag) ? tag : "";
    const next = allowedTag ? document.createElement(allowedTag) : document.createDocumentFragment();

    if (next instanceof HTMLElement && tag === "span") {
      const color = node.dataset.lureColor;
      const fontSize = node.dataset.lureFontSize;
      const fontFamily = node.dataset.lureFontFamily;
      const colorDef = textColors.find((item) => item.value === color);
      const familyDef = fontFamilies.find((item) => item.value === fontFamily);
      const parsedSize = Number(fontSize);

      if (colorDef) {
        next.dataset.lureColor = colorDef.value;
        next.style.color = colorDef.css;
      }

      if (Number.isFinite(parsedSize) && parsedSize >= 10 && parsedSize <= 96) {
        next.dataset.lureFontSize = String(parsedSize);
        next.style.fontSize = `${parsedSize}px`;
      }

      if (familyDef) {
        next.dataset.lureFontFamily = familyDef.value;
        next.style.fontFamily = familyDef.css;
      }
    }

    Array.from(node.childNodes).forEach((child) => {
      const clean = cleanNode(child);
      if (clean) next.appendChild(clean);
    });

    return next;
  };

  const fragment = document.createDocumentFragment();
  Array.from(template.content.childNodes).forEach((node) => {
    const clean = cleanNode(node);
    if (clean) fragment.appendChild(clean);
  });

  return fragment;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const pythonKeywords = new Set([
  "False",
  "None",
  "True",
  "and",
  "as",
  "assert",
  "async",
  "await",
  "break",
  "class",
  "continue",
  "def",
  "del",
  "elif",
  "else",
  "except",
  "finally",
  "for",
  "from",
  "global",
  "if",
  "import",
  "in",
  "is",
  "lambda",
  "nonlocal",
  "not",
  "or",
  "pass",
  "raise",
  "return",
  "try",
  "while",
  "with",
  "yield",
]);

const pythonBuiltins = new Set(["dict", "enumerate", "float", "input", "int", "len", "list", "map", "max", "min", "print", "range", "round", "set", "str", "sum", "tuple", "zip"]);

function highlightPythonHtml(code: string) {
  const tokenPattern =
    /(#.*$|"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_]*\b|[()[\]{}.,:;=+\-*/%<>!]+)/gm;
  let html = "";
  let cursor = 0;

  for (const match of code.matchAll(tokenPattern)) {
    const value = match[0];
    const start = match.index ?? 0;

    if (start > cursor) html += escapeHtml(code.slice(cursor, start));

    let className = "";
    if (value.startsWith("#")) className = "text-emerald";
    else if (value.startsWith("\"") || value.startsWith("'")) className = "text-sand";
    else if (/^\d/.test(value)) className = "text-clay";
    else if (pythonKeywords.has(value)) className = "text-crimson";
    else if (pythonBuiltins.has(value)) className = "text-leaf";
    else if (/^[()[\]{}.,:;=+\-*/%<>!]+$/.test(value)) className = "text-muted-foreground";

    html += className ? `<span class="${className}">${escapeHtml(value)}</span>` : escapeHtml(value);
    cursor = start + value.length;
  }

  if (cursor < code.length) html += escapeHtml(code.slice(cursor));
  return html || "<br>";
}

function highlightLatexHtml(code: string) {
  const tokenPattern = /(%.+$|\\[A-Za-z]+|[$_^{}[\]&=+\-*/(),])/gm;
  let html = "";
  let cursor = 0;

  for (const match of code.matchAll(tokenPattern)) {
    const value = match[0];
    const start = match.index ?? 0;

    if (start > cursor) html += escapeHtml(code.slice(cursor, start));

    let className = "";
    if (value.startsWith("%")) className = "text-emerald";
    else if (value.startsWith("\\")) className = "text-crimson";
    else if (/^[$_^{}[\]&=+\-*/(),]$/.test(value)) className = "text-muted-foreground";

    html += className ? `<span class="${className}">${escapeHtml(value)}</span>` : escapeHtml(value);
    cursor = start + value.length;
  }

  if (cursor < code.length) html += escapeHtml(code.slice(cursor));
  return html || "<br>";
}

function updateLatexWidgetPreview(widget: Element | null, value: string) {
  const preview = widget?.querySelector("[data-lure-latex-preview] code");
  if (preview) preview.innerHTML = highlightLatexHtml(value);
}

function resetLatexWidgetColor(widget: Element | null) {
  if (!(widget instanceof HTMLElement)) return;

  const preview = widget.querySelector("[data-lure-latex-preview]") as HTMLElement | null;
  const defaultColor = textColors[0];

  widget.dataset.lureLatexColor = defaultColor.value;
  if (preview) preview.style.color = defaultColor.css;
}

function rememberLatexInputSelection(input: HTMLTextAreaElement) {
  const widget = input.closest("[data-lure-latex-widget]") as HTMLElement | null;
  if (!widget) return;

  widget.dataset.lureLatexSelectionStart = String(input.selectionStart);
  widget.dataset.lureLatexSelectionEnd = String(input.selectionEnd);
}

function syncTextareaMarkup(root: HTMLElement) {
  root.querySelectorAll("textarea").forEach((textarea) => {
    textarea.textContent = textarea.value;
  });

  root.querySelectorAll("input").forEach((input) => {
    if (input.type !== "file") input.setAttribute("value", input.value);
  });
}

function refreshWidgetPreviews(root: HTMLElement) {
  root.querySelectorAll("[data-lure-code-widget]").forEach((widget) => {
    const input = widget.querySelector("[data-lure-code-input]") as HTMLTextAreaElement | null;
    const preview = widget.querySelector("[data-lure-code-preview] code");
    if (input && preview) preview.innerHTML = highlightPythonHtml(input.value);
  });

  root.querySelectorAll("[data-lure-latex-widget]").forEach((widget) => {
    const input = widget.querySelector("[data-lure-latex-input]") as HTMLTextAreaElement | null;
    if (input) updateLatexWidgetPreview(widget, input.value);
  });
}

function inlineStyleFromDataset(element: HTMLElement) {
  const styles = [
    element.dataset.lureColor || element.style.color
      ? `color: ${textColors.find((item) => item.value === element.dataset.lureColor)?.css ?? element.style.color}`
      : "",
    element.dataset.lureFontSize || element.style.fontSize
      ? `font-size: ${element.dataset.lureFontSize ? Number(element.dataset.lureFontSize) : element.style.fontSize.replace("px", "")}px`
      : "",
    element.dataset.lureFontFamily || element.style.fontFamily
      ? `font-family: ${fontFamilies.find((item) => item.value === element.dataset.lureFontFamily)?.css ?? element.style.fontFamily}`
      : "",
  ].filter(Boolean);

  return styles.length ? ` style="${styles.join("; ")}"` : "";
}

function safeInlineHtmlFromNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent ?? "");
  if (!(node instanceof HTMLElement)) return "";

  const children = Array.from(node.childNodes).map(safeInlineHtmlFromNode).join("");
  const tagName = node.tagName.toLowerCase();

  if (tagName === "br") return "<br>";
  if (tagName === "strong" || tagName === "b") return `<strong>${children}</strong>`;
  if (tagName === "em" || tagName === "i") return `<em>${children}</em>`;
  if (tagName === "ul" || tagName === "ol" || tagName === "li") return `<${tagName}>${children}</${tagName}>`;

  if (tagName === "span") {
    return `<span${inlineStyleFromDataset(node)}>${children}</span>`;
  }

  if (tagName === "font") {
    return `<span>${children}</span>`;
  }

  return children;
}

function safeInlineHtmlFromElement(element: Element) {
  const children = Array.from(element.childNodes).map(safeInlineHtmlFromNode).join("").trim();
  if (element instanceof HTMLElement && inlineStyleFromDataset(element)) {
    return `<span${inlineStyleFromDataset(element)}>${children}</span>`;
  }

  return children;
}

function placeCaretInside(element: HTMLElement) {
  const range = document.createRange();
  const selection = window.getSelection();

  range.selectNodeContents(element);
  range.collapse(false);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function selectionCoversElement(element: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false;

  const range = selection.getRangeAt(0);
  if (!element.contains(range.commonAncestorContainer) && range.commonAncestorContainer !== element) {
    return false;
  }

  const fullRange = document.createRange();
  fullRange.selectNodeContents(element);

  return (
    range.compareBoundaryPoints(Range.START_TO_START, fullRange) <= 0 &&
    range.compareBoundaryPoints(Range.END_TO_END, fullRange) >= 0
  );
}

function removeSlashBeforeCaret() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const node = range.startContainer;
  const offset = range.startOffset;

  if (node.nodeType === Node.TEXT_NODE && node.textContent?.slice(offset - 1, offset) === "/") {
    node.textContent = `${node.textContent.slice(0, offset - 1)}${node.textContent.slice(offset)}`;
    range.setStart(node, Math.max(0, offset - 1));
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

function transformDividerLines(root: HTMLElement) {
  const selectedNode = window.getSelection()?.anchorNode ?? null;
  const candidates = Array.from(
    root.querySelectorAll<HTMLElement>("p, div, section, article"),
  ).filter((node) => {
    if (node === root) return false;
    if (node.matches("hr, pre, blockquote, figure, [data-lure-code-widget]")) return false;
    if (node.closest("pre, blockquote, figure, [data-lure-code-widget]")) return false;
    return node.textContent?.trim() === "----";
  });

  for (const node of candidates) {
    const divider = document.createElement("hr");
    divider.dataset.lureDivider = "true";
    const nextLine = document.createElement("p");
    nextLine.innerHTML = "<br>";
    const shouldMoveCaret = selectedNode ? node.contains(selectedNode) : false;

    node.replaceWith(divider);
    divider.after(nextLine);

    if (shouldMoveCaret) placeCaretInside(nextLine);
  }

  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType !== Node.TEXT_NODE || node.textContent?.trim() !== "----") continue;

    const divider = document.createElement("hr");
    divider.dataset.lureDivider = "true";
    const nextLine = document.createElement("p");
    nextLine.innerHTML = "<br>";
    const shouldMoveCaret = selectedNode === node;

    node.replaceWith(divider);
    divider.after(nextLine);

    if (shouldMoveCaret) placeCaretInside(nextLine);
  }
}

function insertEditorHtml(root: HTMLElement | null, html: string) {
  if (!root) return;

  const template = document.createElement("template");
  template.innerHTML = html;
  const fragment = template.content;
  const lastInserted = fragment.lastElementChild as HTMLElement | null;
  const selection = window.getSelection();
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
  const isInsideEditor = range ? root.contains(range.commonAncestorContainer) : false;

  if (range && isInsideEditor) {
    range.deleteContents();
    range.insertNode(fragment);
  } else {
    root.appendChild(fragment);
  }

  const nextTarget =
    lastInserted?.matches("p, blockquote, pre, figure, [data-lure-code-widget], [data-lure-table-widget]")
      ? lastInserted
      : root.lastElementChild instanceof HTMLElement
        ? root.lastElementChild
        : root;
  placeCaretInside(nextTarget);
}

function codeWidgetHtml(code = 'def meu_exemplo():\n    return "oi, jardim"') {
  const escaped = escapeHtml(code);

  return [
    '<div data-lure-code-widget="true" contenteditable="false" class="lure-editor-code-widget">',
    '<div class="lure-editor-code-header">',
    '<span class="font-mono text-xs text-muted-foreground">snippet.py</span>',
    '<span class="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">python</span>',
    "</div>",
    '<div class="lure-editor-code-body">',
    `<pre aria-hidden="true" data-lure-code-preview="true" class="lure-editor-code-preview"><code>${highlightPythonHtml(code)}</code></pre>`,
    `<textarea data-lure-code-input="true" rows="2" spellcheck="false" class="lure-editor-code-input">${escaped}</textarea>`,
    "</div>",
    "</div>",
    "<p><br></p>",
  ].join("");
}

function latexWidgetHtml(code = "\\int_0^1 x^2 \\, dx = \\frac{1}{3}", color = "default") {
  const escaped = escapeHtml(code);
  const selected = textColors.find((item) => item.value === color) ?? textColors[0];

  return [
    `<div data-lure-latex-widget="true" data-lure-latex-color="${selected.value}" contenteditable="false" class="lure-editor-code-widget">`,
    '<div class="lure-editor-code-header">',
    '<span class="font-mono text-xs text-muted-foreground">formula.tex</span>',
    '<div class="flex items-center gap-1">',
    ...textColors.map(
      (item) =>
        `<button type="button" data-lure-latex-color-button="${item.value}" class="grid h-6 w-6 place-items-center rounded-md transition-colors hover:bg-secondary" aria-label="${item.label}"><span class="h-3 w-3 rounded-full ${item.swatch}"></span></button>`,
    ),
    '<span class="ml-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">latex</span>',
    "</div>",
    "</div>",
    '<div class="lure-editor-code-body">',
    `<pre aria-hidden="true" data-lure-latex-preview="true" class="lure-editor-code-preview" style="color: ${selected.css}"><code>${highlightLatexHtml(code)}</code></pre>`,
    `<textarea data-lure-latex-input="true" rows="2" spellcheck="false" class="lure-editor-code-input">${escaped}</textarea>`,
    "</div>",
    "</div>",
    "<p><br></p>",
  ].join("");
}

function imageWidgetHtml(src: string, alt = "Imagem do post", width = 72) {
  const id = makeId();

  return `
    <figure data-lure-image-figure="true" contenteditable="false" class="my-6">
      <img
        data-lure-image="true"
        data-lure-image-id="${id}"
        src="${src}"
        alt="${escapeHtml(alt)}"
        style="width: ${width}%; max-width: 100%;"
        class="rounded-xl border border-border object-cover shadow-card"
      />
    </figure>
    <p><br></p>
  `;
}

function tableCellBackground(color: string) {
  const map: Record<string, string> = {
    default: "transparent",
    muted: "color-mix(in oklch, var(--muted-foreground) 16%, transparent)",
    primary: "color-mix(in oklch, var(--primary) 16%, transparent)",
    leaf: "color-mix(in oklch, var(--leaf) 16%, transparent)",
    clay: "color-mix(in oklch, var(--clay) 16%, transparent)",
    sand: "color-mix(in oklch, var(--sand) 22%, transparent)",
  };

  return map[color] ?? map.default;
}

function defaultTableCell(text = ""): PublishedTableCell {
  return {
    text,
    align: "left",
    color: "default",
    width: 140,
    height: 44,
  };
}

function defaultTable(): PublishedTable {
  return {
    title: "df_estudos",
    mode: "fit",
    rows: [
      [defaultTableCell("coluna_a"), defaultTableCell("coluna_b"), defaultTableCell("coluna_c")],
      [defaultTableCell("valor 1"), defaultTableCell("42"), defaultTableCell("sim")],
      [defaultTableCell("valor 2"), defaultTableCell("17"), defaultTableCell("nao")],
    ],
  };
}

function tableCellHtml(cell: PublishedTableCell, rowIndex: number, columnIndex: number, mode: PublishedTable["mode"], selected = false) {
  const tag = rowIndex === 0 ? "th" : "td";
  const escaped = escapeHtml(cell.text);
  const sizeStyle = mode === "scroll" ? `width: ${cell.width}px; min-width: ${cell.width}px;` : "";

  return [
    `<${tag} data-lure-table-cell="true" data-lure-table-row="${rowIndex}" data-lure-table-col="${columnIndex}" data-lure-table-align="${cell.align}" data-lure-table-color="${cell.color}" data-lure-table-width="${cell.width}" data-lure-table-height="${cell.height}" ${selected ? 'data-lure-table-selected-cell="true"' : ""} style="${sizeStyle} height: ${cell.height}px; text-align: ${cell.align}; background: ${tableCellBackground(cell.color)};">`,
    `<textarea data-lure-table-cell-input="true" rows="1" spellcheck="false">${escaped}</textarea>`,
    `</${tag}>`,
  ].join("");
}

function tableWidgetHtml(table = defaultTable(), includeNextParagraph = true) {
  const selectedCell = table.rows[0]?.[0] ?? defaultTableCell();
  const scrollWidth = table.rows[0]?.reduce((sum, cell) => sum + cell.width, 0) ?? 420;

  return [
    `<div data-lure-table-widget="true" data-lure-table-mode="${table.mode}" data-lure-table-selected="0:0" contenteditable="false" class="lure-table-editor-widget">`,
    '<div class="lure-table-editor-toolbar">',
    `<input data-lure-table-title="true" value="${escapeHtml(table.title)}" placeholder="titulo do dataframe" class="lure-table-title-input" />`,
    '<div class="lure-table-toolbar-group">',
    '<button type="button" data-lure-table-action="add-row">+ linha</button>',
    '<button type="button" data-lure-table-action="remove-row">- linha</button>',
    '<button type="button" data-lure-table-action="add-column">+ coluna</button>',
    '<button type="button" data-lure-table-action="remove-column">- coluna</button>',
    "</div>",
    '<div class="lure-table-toolbar-group">',
    '<button type="button" data-lure-table-mode-button="fit">ajustar</button>',
    '<button type="button" data-lure-table-mode-button="scroll">scroll</button>',
    "</div>",
    '<div class="lure-table-toolbar-group">',
    '<button type="button" data-lure-table-align-button="left">esq</button>',
    '<button type="button" data-lure-table-align-button="center">centro</button>',
    '<button type="button" data-lure-table-align-button="right">dir</button>',
    "</div>",
    '<div class="lure-table-toolbar-group">',
    ...textColors.map(
      (item) =>
        `<button type="button" data-lure-table-color-button="${item.value}" aria-label="${item.label}"><span class="h-3 w-3 rounded-full ${item.swatch}"></span></button>`,
    ),
    "</div>",
    '<label class="lure-table-size-control">L <input data-lure-table-width-input="true" type="number" min="60" max="420" value="' + selectedCell.width + '" /></label>',
    '<label class="lure-table-size-control">A <input data-lure-table-height-input="true" type="number" min="34" max="180" value="' + selectedCell.height + '" /></label>',
    "</div>",
    `<div class="${table.mode === "scroll" ? "lure-table-editor-scroll is-scroll" : "lure-table-editor-scroll"}">`,
    `<table style="table-layout: ${table.mode === "fit" ? "fixed" : "auto"}; ${table.mode === "scroll" ? `min-width: ${Math.max(520, scrollWidth)}px;` : ""}">`,
    "<tbody>",
    ...table.rows.map((row, rowIndex) => `<tr>${row.map((cell, columnIndex) => tableCellHtml(cell, rowIndex, columnIndex, table.mode, rowIndex === 0 && columnIndex === 0)).join("")}</tr>`),
    "</tbody>",
    "</table>",
    "</div>",
    "</div>",
    includeNextParagraph ? "<p><br></p>" : "",
  ].join("");
}

function diagramWidgetHtml(diagram: Diagram, widgetId?: string) {
  const id = widgetId || makeDiagramId("diagram");
  const json = JSON.stringify(diagram);
  const escapedJson = escapeHtml(json);
  const previewSvg = diagramToSvg(diagram, { className: "lure-diagram-preview-svg" });
  const summary = `${diagram.nodes.length} formas${diagram.edges.length ? ` · ${diagram.edges.length} setas` : ""}`;

  return [
    `<div data-lure-diagram-widget="true" data-lure-diagram-id="${id}" data-lure-diagram-state="${escapedJson}" contenteditable="false" class="lure-editor-diagram-widget">`,
    '<div class="lure-editor-diagram-header">',
    '<span class="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">organograma</span>',
    `<span class="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/80">${summary}</span>`,
    '<button type="button" data-lure-diagram-edit="true" class="lure-editor-diagram-edit">editar diagrama</button>',
    "</div>",
    `<div class="lure-editor-diagram-canvas" data-lure-diagram-preview="true">${previewSvg}</div>`,
    "</div>",
    "<p><br></p>",
  ].join("");
}

function diagramFromWidget(node: HTMLElement): Diagram | null {
  const raw = node.dataset.lureDiagramState;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Diagram;
    if (!Array.isArray(parsed?.nodes) || parsed.nodes.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function diagramBlockFromWidget(node: HTMLElement): PublishedBlock[] {
  const diagram = diagramFromWidget(node);
  if (!diagram) return [];
  const text = diagram.nodes.map((item) => item.text).filter(Boolean).join(" ");

  return [
    {
      id: node.dataset.lureDiagramId || makeId(),
      type: "diagram",
      text,
      color: "default",
      bold: false,
      diagram,
    },
  ];
}

function codeBlockFromWidget(node: HTMLElement): PublishedBlock[] {
  const input = node.querySelector("[data-lure-code-input]") as HTMLTextAreaElement | null;
  const code = input?.value ?? input?.textContent ?? "";

  return code.trim()
    ? [
        {
          id: makeId(),
          type: "code",
          text: code,
          color: "default",
          bold: false,
          language: "python",
          filename: "snippet.py",
        },
      ]
    : [];
}

function latexBlockFromWidget(node: HTMLElement): PublishedBlock[] {
  const input = node.querySelector("[data-lure-latex-input]") as HTMLTextAreaElement | null;
  const code = input?.value ?? input?.textContent ?? "";

  return code.trim()
    ? [
        {
          id: makeId(),
          type: "latex",
          text: code,
          color: node.dataset.lureLatexColor || "default",
          bold: false,
          language: "latex",
          filename: "formula.tex",
        },
      ]
    : [];
}

function tableFromWidget(node: HTMLElement): PublishedTable {
  const title = (node.querySelector("[data-lure-table-title]") as HTMLInputElement | null)?.value ?? "";
  const rows = Array.from(node.querySelectorAll("tbody tr"))
    .map((row) =>
      Array.from(row.querySelectorAll<HTMLElement>("[data-lure-table-cell]")).map((cell) => {
        const input = cell.querySelector("[data-lure-table-cell-input]") as HTMLTextAreaElement | null;
        const align: PublishedTableCell["align"] =
          cell.dataset.lureTableAlign === "center" || cell.dataset.lureTableAlign === "right"
            ? cell.dataset.lureTableAlign
            : "left";
        const width = Number(cell.dataset.lureTableWidth ?? 140);
        const height = Number(cell.dataset.lureTableHeight ?? 44);

        return {
          text: input?.value ?? input?.textContent ?? "",
          align,
          color: cell.dataset.lureTableColor || "default",
          width: Number.isFinite(width) ? Math.min(420, Math.max(60, width)) : 140,
          height: Number.isFinite(height) ? Math.min(180, Math.max(34, height)) : 44,
        };
      }),
    )
    .filter((row) => row.length > 0);

  return {
    title,
    mode: node.dataset.lureTableMode === "scroll" ? "scroll" : "fit",
    rows: rows.length ? rows : defaultTable().rows,
  };
}

function tableBlockFromWidget(node: HTMLElement): PublishedBlock[] {
  const table = tableFromWidget(node);
  const text = [table.title, ...table.rows.flat().map((cell) => cell.text)].join(" ").trim();

  return [
    {
      id: node.dataset.lureTableId || makeId(),
      type: "table",
      text,
      color: "default",
      bold: false,
      table,
    },
  ];
}

function getTableWidget(target: Element | null) {
  return target?.closest("[data-lure-table-widget]") as HTMLElement | null;
}

function getSelectedTableCell(widget: HTMLElement) {
  const selected = widget.dataset.lureTableSelected || "0:0";
  const [row, col] = selected.split(":");
  return widget.querySelector(`[data-lure-table-cell][data-lure-table-row="${row}"][data-lure-table-col="${col}"]`) as HTMLElement | null;
}

function refreshTableControls(widget: HTMLElement) {
  const selectedCell = getSelectedTableCell(widget);
  const widthInput = widget.querySelector("[data-lure-table-width-input]") as HTMLInputElement | null;
  const heightInput = widget.querySelector("[data-lure-table-height-input]") as HTMLInputElement | null;

  if (selectedCell && widthInput) widthInput.value = selectedCell.dataset.lureTableWidth || "140";
  if (selectedCell && heightInput) heightInput.value = selectedCell.dataset.lureTableHeight || "44";
}

function selectTableCell(cell: HTMLElement) {
  const widget = getTableWidget(cell);
  if (!widget) return;

  widget.querySelectorAll("[data-lure-table-selected-cell]").forEach((current) => {
    delete (current as HTMLElement).dataset.lureTableSelectedCell;
  });

  cell.dataset.lureTableSelectedCell = "true";
  widget.dataset.lureTableSelected = `${cell.dataset.lureTableRow || "0"}:${cell.dataset.lureTableCol || "0"}`;
  refreshTableControls(widget);
}

function applyTableCellPresentation(cell: HTMLElement) {
  const widget = getTableWidget(cell);
  const mode = widget?.dataset.lureTableMode === "scroll" ? "scroll" : "fit";
  const width = Number(cell.dataset.lureTableWidth ?? 140);
  const height = Number(cell.dataset.lureTableHeight ?? 44);
  const align = cell.dataset.lureTableAlign || "left";
  const color = cell.dataset.lureTableColor || "default";

  cell.style.width = mode === "scroll" ? `${width}px` : "";
  cell.style.minWidth = mode === "scroll" ? `${width}px` : "";
  cell.style.height = `${height}px`;
  cell.style.textAlign = align;
  cell.style.background = tableCellBackground(color);
}

function replaceTableWidget(widget: HTMLElement, table: PublishedTable) {
  const template = document.createElement("template");
  template.innerHTML = tableWidgetHtml(table, false);
  const nextWidget = template.content.firstElementChild as HTMLElement | null;
  if (!nextWidget) return widget;

  widget.replaceWith(nextWidget);
  return nextWidget;
}

function parseEditorNode(node: ChildNode): PublishedBlock[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.trim() ?? "";
    if (!text) return [];
    return [
      {
        id: makeId(),
        type: text === "----" ? "divider" : "paragraph",
        text: text === "----" ? "" : text,
        html: text === "----" ? "" : escapeHtml(text),
        color: "default",
        bold: false,
      },
    ];
  }

  if (!(node instanceof HTMLElement)) return [];

  if (node.matches("[data-lure-code-widget]")) return codeBlockFromWidget(node);
  if (node.matches("[data-lure-latex-widget]")) return latexBlockFromWidget(node);
  if (node.matches("[data-lure-table-widget]")) return tableBlockFromWidget(node);
  if (node.matches("[data-lure-diagram-widget]")) return diagramBlockFromWidget(node);

  if (node.matches("blockquote")) {
    const text = (node.textContent ?? "").trim();
    if (!text) return [];

    return [
      {
        id: makeId(),
        type: "quote",
        text,
        html: safeInlineHtmlFromElement(node),
        color: "default",
        bold: false,
      },
    ];
  }

  if (node.matches("ul, ol")) {
    const text = (node.textContent ?? "").trim();
    if (!text) return [];

    return [
      {
        id: makeId(),
        type: "list",
        text,
        html: safeInlineHtmlFromElement(node),
        color: "default",
        bold: false,
      },
    ];
  }

  if (node.matches("[data-lure-image-figure]")) {
    const image = node.querySelector("img[data-lure-image]") as HTMLImageElement | null;
    if (!image?.src) return [];

    return [
      {
        id: image.dataset.lureImageId || makeId(),
        type: "image",
        text: image.alt || "Imagem do post",
        color: "default",
        bold: false,
        src: image.src,
        alt: image.alt,
        width: Number.parseInt(image.style.width, 10) || 72,
      },
    ];
  }

  if (node.querySelector("[data-lure-code-widget], [data-lure-latex-widget], [data-lure-table-widget], [data-lure-diagram-widget], [data-lure-image-figure], blockquote, ul, ol")) {
    return Array.from(node.childNodes).flatMap(parseEditorNode);
  }

  if (node.matches("hr")) {
    return [{ id: makeId(), type: "divider", text: "", color: "default", bold: false }];
  }

  const text = (node.textContent ?? "").trim();
  if (node.matches("pre")) {
    return text
      ? [
          {
            id: makeId(),
            type: "code",
            text,
            color: "default",
            bold: false,
            language: node.dataset.language || "python",
            filename: node.dataset.filename || "snippet.py",
          },
        ]
      : [];
  }

  if (!text) return [];

  if (text === "----") {
    return [{ id: makeId(), type: "divider", text: "", color: "default", bold: false }];
  }

  const html = safeInlineHtmlFromElement(node);
  return [
    {
      id: makeId(),
      type: "paragraph",
      text,
      html,
      color: "default",
      bold: false,
    },
  ];
}

function parseEditorBlocks(root: HTMLElement | null): PublishedBlock[] {
  if (!root) return [];

  return Array.from(root.childNodes)
    .flatMap(parseEditorNode)
    .filter(
      (block) =>
        block.type === "divider" ||
        block.type === "image" ||
        block.type === "list" ||
        block.type === "table" ||
        (block.type === "diagram" && block.diagram) ||
        block.text ||
        block.html,
    );
}

function blockToEditorHtml(block: PublishedBlock) {
  if (block.type === "code") return codeWidgetHtml(block.text);
  if (block.type === "latex") return latexWidgetHtml(block.text, block.color);
  if (block.type === "table") return tableWidgetHtml(block.table ?? defaultTable());
  if (block.type === "diagram") return diagramWidgetHtml(block.diagram ?? emptyDiagram(), block.id);
  if (block.type === "divider") return '<hr data-lure-divider="true">';

  if (block.type === "image") {
    return block.src ? imageWidgetHtml(block.src, block.alt || block.text || "Imagem do post", block.width ?? 72) : "";
  }

  if (block.type === "quote") {
    return `<blockquote>${block.html || escapeHtml(block.text)}</blockquote>`;
  }

  if (block.type === "list") {
    const html = block.html || escapeHtml(block.text);
    return /^<\s*(ul|ol)\b/i.test(html) ? html : `<ul>${html}</ul>`;
  }

  return `<p>${block.html || escapeHtml(block.text)}</p>`;
}

function blocksToEditorHtml(blocks: PublishedBlock[]) {
  const html = blocks.map(blockToEditorHtml).join("");
  return html || emptyEditor;
}

function RichBlock({ block }: { block: PublishedBlock }) {
  if (block.type === "divider") {
    return <hr className="border-border/70" />;
  }

  if (block.type === "code") {
    return (
      <CodeBlock
        code={block.text}
        filename={block.filename || "snippet.py"}
        language={block.language || "python"}
      />
    );
  }

  if (block.type === "latex") {
    const color = textColors.find((item) => item.value === block.color) ?? textColors[0];

    return (
      <div className="lure-editor-code-widget">
        <div className="lure-editor-code-header">
          <span className="font-mono text-xs text-muted-foreground">{block.filename || "formula.tex"}</span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">latex</span>
        </div>
        <div
          className="lure-latex-render"
          style={{ color: color.css }}
          dangerouslySetInnerHTML={{ __html: renderLatexHtml(block.text) }}
        />
      </div>
    );
  }

  if (block.type === "image") {
    return (
      <figure>
        <img
          src={block.src}
          alt={block.alt || ""}
          style={{ width: `${block.width ?? 72}%` }}
          className="max-w-full rounded-xl border border-border object-cover shadow-card"
        />
      </figure>
    );
  }

  if (block.type === "table" && block.table) {
    return <DataFrameTable table={block.table} />;
  }

  if (block.type === "diagram" && block.diagram) {
    return (
      <figure
        className="lure-diagram-render overflow-x-auto rounded-2xl border border-border bg-card/60 p-4"
        dangerouslySetInnerHTML={{ __html: diagramToSvg(block.diagram) }}
      />
    );
  }

  if (block.type === "list") {
    return (
      <div
        className="lure-rich-list text-base leading-8 text-foreground/85"
        dangerouslySetInnerHTML={{ __html: block.html || escapeHtml(block.text) }}
      />
    );
  }

  if (block.type === "quote") {
    return (
      <blockquote
        className="border-l-2 border-primary pl-5 font-display text-2xl italic leading-relaxed text-foreground/85"
        dangerouslySetInnerHTML={{ __html: block.html || escapeHtml(block.text) }}
      />
    );
  }

  return (
    <p
      className="text-base leading-8 text-foreground/85"
      dangerouslySetInnerHTML={{ __html: block.html || escapeHtml(block.text) }}
    />
  );
}

function PostPreview({
  title,
  excerpt,
  categorySlug,
  coverDataUrl,
  blocks,
}: {
  title: string;
  excerpt: string;
  categorySlug: string;
  coverDataUrl: string;
  blocks: PublishedBlock[];
}) {
  const category = categories.find((item) => item.slug === categorySlug) ?? categories[0];

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      {coverDataUrl ? (
        <img src={coverDataUrl} alt="" className="aspect-[16/8] w-full object-cover" />
      ) : (
        <div className="grid aspect-[16/8] place-items-center bg-secondary text-muted-foreground">
          <ImagePlus className="h-8 w-8" />
        </div>
      )}

      <div className="p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-primary">
            {category.name}
          </span>
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            {Math.max(1, Math.ceil(blocks.map((block) => block.text).join(" ").split(/\s+/).filter(Boolean).length / 180))} min
          </span>
        </div>

        <h2 className="mt-5 font-display text-4xl leading-tight">{title || "Titulo do post"}</h2>
        <p className="mt-4 text-muted-foreground">{excerpt || "Resumo curto do post publicado."}</p>

        <div className="mx-auto mt-8 max-w-3xl space-y-6">
          {blocks.length > 0 ? (
            blocks.map((block) => <RichBlock key={block.id} block={block} />)
          ) : (
            <p className="text-base leading-8 text-muted-foreground">Seu texto aparece aqui.</p>
          )}
        </div>
      </div>
    </article>
  );
}

function WritePage() {
  const { accessToken, isAdmin, isLoading: isCheckingAdmin } = useAdminSession();
  const editorRef = useRef<HTMLDivElement | null>(null);
  const inlineImageInputRef = useRef<HTMLInputElement | null>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const technicalReviewRangeRef = useRef<Range | null>(null);
  const seededEditorRef = useRef(false);
  const editorHtmlRef = useRef(emptyEditor);
  const historyPastRef = useRef<string[]>([]);
  const historyFutureRef = useRef<string[]>([]);
  const isApplyingHistoryRef = useRef(false);
  const draftStateRef = useRef({
    title: "",
    excerpt: "",
    categorySlug: categories[0].slug,
    coverDataUrl: "",
    editingSlug: "",
    isLoadingPost: false,
  });
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [categorySlug, setCategorySlug] = useState(categories[0].slug);
  const [coverDataUrl, setCoverDataUrl] = useState("");
  const [editorHtml, setEditorHtml] = useState(emptyEditor);
  const [status, setStatus] = useState("");
  const [draftStatus, setDraftStatus] = useState("");
  const [availableDraft, setAvailableDraft] = useState<WriterDraft | null>(null);
  const [published, setPublished] = useState<PublishedPost | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [editingSlug, setEditingSlug] = useState("");
  const [isLoadingPost, setIsLoadingPost] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashMenuIndex, setSlashMenuIndex] = useState(0);
  const [fontSize, setFontSize] = useState(16);
  const [fontFamily, setFontFamily] = useState("sans");
  const [selectedImageId, setSelectedImageId] = useState("");
  const [selectedImageWidth, setSelectedImageWidth] = useState(72);
  const [isAiReviewing, setIsAiReviewing] = useState<"grammar" | "technical" | null>(null);
  const [technicalReviewDialog, setTechnicalReviewDialog] = useState<TechnicalReviewDialog>(null);
  const [diagramModal, setDiagramModal] = useState<
    { widgetId: string; diagram: Diagram } | null
  >(null);

  useEffect(() => {
    if (isCheckingAdmin || isAdmin || typeof window === "undefined") return;
    const redirect = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
    window.location.href = `/login?redirect=${redirect}`;
  }, [isAdmin, isCheckingAdmin]);

  const blocks = useMemo(() => {
    if (typeof document === "undefined") return [];
    const container = document.createElement("div");
    container.innerHTML = editorHtml;
    return parseEditorBlocks(container);
  }, [editorHtml]);

  const stats = useMemo(() => {
    const words = countWordsFromHtml(editorHtml);
    return {
      words,
      readTime: Math.max(1, Math.ceil(words / 180)),
    };
  }, [editorHtml]);

  useEffect(() => {
    editorHtmlRef.current = editorHtml;
  }, [editorHtml]);

  useEffect(() => {
    draftStateRef.current = {
      title,
      excerpt,
      categorySlug,
      coverDataUrl,
      editingSlug,
      isLoadingPost,
    };
  }, [title, excerpt, categorySlug, coverDataUrl, editingSlug, isLoadingPost]);

  const applyDraft = useCallback((draft: WriterDraft) => {
    const nextCategory = categories.some((category) => category.slug === draft.categorySlug)
      ? draft.categorySlug
      : categories[0].slug;

    setTitle(draft.title);
    setExcerpt(draft.excerpt);
    setCategorySlug(nextCategory);
    setCoverDataUrl(draft.coverDataUrl);
    setEditorHtml(draft.editorHtml || emptyEditor);
    editorHtmlRef.current = draft.editorHtml || emptyEditor;
    historyPastRef.current = [];
    historyFutureRef.current = [];

    if (editorRef.current) {
      editorRef.current.innerHTML = editorHtmlRef.current;
      refreshWidgetPreviews(editorRef.current);
    }

    setDraftStatus(
      `rascunho restaurado às ${new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(draft.savedAt))}`,
    );
    setAvailableDraft(null);
  }, []);

  const hydratePost = useCallback((post: PublishedPost) => {
    const nextHtml = blocksToEditorHtml(post.blocks);

    setTitle(post.title);
    setExcerpt(post.excerpt);
    setCategorySlug(post.categorySlug);
    setCoverDataUrl(post.coverDataUrl);
    setPublished(post);
    setEditorHtml(nextHtml);
    editorHtmlRef.current = nextHtml;
    historyPastRef.current = [];
    historyFutureRef.current = [];

    if (editorRef.current) {
      editorRef.current.innerHTML = nextHtml;
      refreshWidgetPreviews(editorRef.current);
    }

    const draft = readWriterDraft(post.slug);
    setAvailableDraft(draft);
    if (draft) {
      setDraftStatus(
        `rascunho salvo disponível às ${new Intl.DateTimeFormat("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(draft.savedAt))}`,
      );
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const slug = new URLSearchParams(window.location.search).get("edit")?.trim();
    if (!slug) return;

    let cancelled = false;
    const localPost = getLocalPublishedPost(slug);

    setEditingSlug(slug);
    setIsLoadingPost(true);

    if (localPost) {
      hydratePost(localPost);
      setIsLoadingPost(false);
      return;
    }

    getPublishedPost({ data: { slug } })
      .then((post) => {
        if (cancelled) return;

        if (post) {
          hydratePost(post);
        } else {
          setStatus("Nao encontrei esse post para editar.");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("Nao consegui carregar esse post para editar.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPost(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hydratePost]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const slug = new URLSearchParams(window.location.search).get("edit")?.trim();
    if (slug) return;

    const draft = readWriterDraft("");
    setAvailableDraft(draft);
    if (draft) {
      setDraftStatus(
        `rascunho salvo disponível às ${new Intl.DateTimeFormat("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(draft.savedAt))}`,
      );
    }
  }, []);

  const setEditorElement = useCallback((node: HTMLDivElement | null) => {
    editorRef.current = node;

    if (node && (!seededEditorRef.current || node.innerHTML.trim() === "")) {
      node.innerHTML = editorHtmlRef.current || emptyEditor;
      refreshWidgetPreviews(node);
      seededEditorRef.current = true;
    }
  }, []);

  const setEditorSnapshot = (html: string) => {
    if (!editorRef.current) return;

    isApplyingHistoryRef.current = true;
    editorRef.current.innerHTML = html || emptyEditor;
    refreshWidgetPreviews(editorRef.current);
    editorHtmlRef.current = editorRef.current.innerHTML;
    setEditorHtml(editorHtmlRef.current);
    isApplyingHistoryRef.current = false;
  };

  const syncEditor = (recordHistory = true) => {
    if (!editorRef.current) return;
    transformDividerLines(editorRef.current);
    syncTextareaMarkup(editorRef.current);

    const nextHtml = editorRef.current.innerHTML;
    if (nextHtml === editorHtmlRef.current) return;

    if (recordHistory && !isApplyingHistoryRef.current) {
      historyPastRef.current = [...historyPastRef.current.slice(-79), editorHtmlRef.current];
      historyFutureRef.current = [];
    }

    editorHtmlRef.current = nextHtml;
    setEditorHtml(nextHtml);
  };

  const saveCurrentDraftNow = useCallback((statusLabel = "rascunho salvo") => {
    if (!editorRef.current) return;

    const current = draftStateRef.current;
    if (current.isLoadingPost) return;

    transformDividerLines(editorRef.current);
    syncTextareaMarkup(editorRef.current);

    const nextHtml = editorRef.current.innerHTML;
    const hasContent =
      Boolean(current.editingSlug) ||
      Boolean(current.title.trim()) ||
      Boolean(current.excerpt.trim()) ||
      Boolean(current.coverDataUrl) ||
      Boolean(textFromHtml(nextHtml).trim());

    if (!hasContent) return;

    const savedAt = Date.now();
    saveWriterDraft(current.editingSlug, {
      title: current.title,
      excerpt: current.excerpt,
      categorySlug: current.categorySlug,
      coverDataUrl: current.coverDataUrl,
      editorHtml: nextHtml,
      savedAt,
    });

    if (nextHtml !== editorHtmlRef.current) {
      editorHtmlRef.current = nextHtml;
      setEditorHtml(nextHtml);
    }

    setDraftStatus(
      `${statusLabel} às ${new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(savedAt))}`,
    );
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const interval = window.setInterval(() => {
      saveCurrentDraftNow();
    }, 10000);

    return () => window.clearInterval(interval);
  }, [saveCurrentDraftNow]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") saveCurrentDraftNow("rascunho preservado");
    };
    const handlePageHide = () => saveCurrentDraftNow("rascunho preservado");

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [saveCurrentDraftNow]);

  const rememberSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !editorRef.current) return;

    const range = selection.getRangeAt(0);
    if (editorRef.current.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange();
    }
  };

  const restoreSelection = () => {
    const selection = window.getSelection();
    const currentRange = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const currentIsInside =
      currentRange && editorRef.current?.contains(currentRange.commonAncestorContainer);

    if (currentIsInside) return;
    if (!selection || !savedRangeRef.current) return;

    selection.removeAllRanges();
    selection.addRange(savedRangeRef.current);
  };

  const handleCoverChange = async (file: File | undefined) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setCoverDataUrl(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  };

  const applyHistoryCommand = (command: "undo" | "redo") => {
    if (!editorRef.current) return;

    syncTextareaMarkup(editorRef.current);
    const currentHtml = editorRef.current.innerHTML;

    if (command === "undo") {
      const previous = historyPastRef.current.pop();
      if (!previous) return;

      historyFutureRef.current = [currentHtml, ...historyFutureRef.current].slice(0, 80);
      setEditorSnapshot(previous);
    } else {
      const next = historyFutureRef.current.shift();
      if (!next) return;

      historyPastRef.current = [...historyPastRef.current.slice(-79), currentHtml];
      setEditorSnapshot(next);
    }

    rememberSelection();
  };

  const applyBold = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    editorRef.current?.focus();
    document.execCommand("bold");
    syncEditor();
  };

  const applyColor = (value: string) => {
    const color = textColors.find((item) => item.value === value);
    const activeElement = document.activeElement;

    if (color && activeElement instanceof HTMLTextAreaElement && activeElement.dataset.lureLatexInput === "true") {
      const widget = activeElement.closest("[data-lure-latex-widget]") as HTMLElement | null;
      const preview = widget?.querySelector("[data-lure-latex-preview]") as HTMLElement | null;
      const start = Math.min(activeElement.selectionStart, activeElement.selectionEnd);
      const end = Math.max(activeElement.selectionStart, activeElement.selectionEnd);

      if (widget && preview && end > start) {
        const before = activeElement.value.slice(0, start);
        const selected = activeElement.value.slice(start, end);
        const after = activeElement.value.slice(end);
        const wrapped = `\\textcolor{${color.value}}{${selected}}`;

        activeElement.value = `${before}${wrapped}${after}`;
        activeElement.textContent = activeElement.value;
        updateLatexWidgetPreview(widget, activeElement.value);
        activeElement.focus();
        activeElement.setSelectionRange(start + wrapped.length, start + wrapped.length);
        rememberLatexInputSelection(activeElement);
        syncEditor();
        return;
      }
    }

    editorRef.current?.focus();
    restoreSelection();
    const selection = window.getSelection();
    if (!color || !selection || selection.rangeCount === 0 || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const wrapper = document.createElement("span");
    wrapper.dataset.lureColor = color.value;
    wrapper.style.color = color.css;
    wrapper.appendChild(range.extractContents());
    range.insertNode(wrapper);
    selection.removeAllRanges();

    const nextRange = document.createRange();
    nextRange.selectNodeContents(wrapper);
    selection.addRange(nextRange);
    syncEditor();
  };

  const applyTextStyle = (patch: { fontSize?: number; fontFamily?: string }) => {
    editorRef.current?.focus();
    restoreSelection();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const family = patch.fontFamily ? fontFamilies.find((item) => item.value === patch.fontFamily) : null;
    const range = selection.getRangeAt(0);

    if (selection.isCollapsed) {
      const element =
        range.startContainer instanceof HTMLElement
          ? range.startContainer
          : range.startContainer.parentElement;
      const target = element?.closest("p, div, h1, h2, h3, blockquote") as HTMLElement | null;

      if (target) {
        if (patch.fontSize) {
          target.dataset.lureFontSize = String(patch.fontSize);
          target.style.fontSize = `${patch.fontSize}px`;
        }

        if (family) {
          target.dataset.lureFontFamily = family.value;
          target.style.fontFamily = family.css;
        }
      }
    } else {
      const wrapper = document.createElement("span");

      if (patch.fontSize) {
        wrapper.dataset.lureFontSize = String(patch.fontSize);
        wrapper.style.fontSize = `${patch.fontSize}px`;
      }

      if (family) {
        wrapper.dataset.lureFontFamily = family.value;
        wrapper.style.fontFamily = family.css;
      }

      wrapper.appendChild(range.extractContents());
      range.insertNode(wrapper);
      selection.removeAllRanges();

      const nextRange = document.createRange();
      nextRange.selectNodeContents(wrapper);
      selection.addRange(nextRange);
    }

    syncEditor();
    rememberSelection();
  };

  const applyPreset = (preset: (typeof fontPresets)[number]) => {
    setFontSize(preset.size);
    setFontFamily(preset.family);
    applyTextStyle({ fontSize: preset.size, fontFamily: preset.family });
  };

  const applyBulletList = () => {
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand("insertUnorderedList");
    syncEditor();
    rememberSelection();
  };

  const clearEditorSelection = () => {
    if (!editorRef.current) return;

    syncTextareaMarkup(editorRef.current);
    historyPastRef.current = [...historyPastRef.current.slice(-79), editorRef.current.innerHTML];
    historyFutureRef.current = [];
    setEditorSnapshot(emptyEditor);

    const firstLine = editorRef.current.querySelector("p") as HTMLElement | null;
    if (firstLine) placeCaretInside(firstLine);
  };

  const resetTextBlockStyle = (block: HTMLElement) => {
    delete block.dataset.lureColor;
    delete block.dataset.lureFontSize;
    delete block.dataset.lureFontFamily;
    block.style.removeProperty("color");
    block.style.removeProperty("font-size");
    block.style.removeProperty("font-family");
    block.style.removeProperty("margin-left");
    block.style.removeProperty("padding-left");
    block.style.textAlign = "left";
  };

  const normalizeLineAfterEnter = () => {
    window.setTimeout(() => {
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      const element =
        range?.startContainer instanceof HTMLElement
          ? range.startContainer
          : range?.startContainer.parentElement;
      const block = element?.closest("p, div, h1, h2, h3") as HTMLElement | null;

      if (
        !block ||
        !editorRef.current?.contains(block) ||
        block.closest("li, blockquote, [data-lure-code-widget], [data-lure-latex-widget], [data-lure-table-widget], [data-lure-diagram-widget]")
      ) {
        return;
      }

      resetTextBlockStyle(block);
      syncEditor();
      rememberSelection();
    }, 0);
  };

  const insertPlainLineBreak = () => {
    if (!editorRef.current) return false;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    const range = selection.getRangeAt(0);
    const element =
      range.startContainer instanceof HTMLElement
        ? range.startContainer
        : range.startContainer.parentElement;
    const block = element?.closest("p, div, h1, h2, h3") as HTMLElement | null;

    if (
      !block ||
      !editorRef.current.contains(block) ||
      block === editorRef.current ||
      block.closest("li, blockquote, [data-lure-code-widget], [data-lure-latex-widget], [data-lure-table-widget], [data-lure-diagram-widget]")
    ) {
      return false;
    }

    range.deleteContents();

    const tailRange = document.createRange();
    tailRange.setStart(range.endContainer, range.endOffset);
    tailRange.setEnd(block, block.childNodes.length);
    const tail = tailRange.extractContents();
    const nextLine = document.createElement("p");

    resetTextBlockStyle(nextLine);
    nextLine.appendChild(tail);

    if (!nextLine.textContent?.trim() && nextLine.childNodes.length === 0) {
      nextLine.innerHTML = "<br>";
    }

    if (!block.textContent?.trim() && block.childNodes.length === 0) {
      block.innerHTML = "<br>";
    }

    block.after(nextLine);
    placeCaretInside(nextLine);
    syncEditor();
    rememberSelection();
    return true;
  };

  const handleEditorKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.key === "Delete" || event.key === "Backspace") && editorRef.current) {
      const target = event.target as HTMLElement;
      const isWidgetField =
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement;

      if (!isWidgetField && selectionCoversElement(editorRef.current)) {
        event.preventDefault();
        clearEditorSelection();
        return;
      }
    }

    if (showSlashMenu) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        setSlashMenuIndex((currentIndex) => {
          const direction = event.key === "ArrowDown" ? 1 : -1;
          return (currentIndex + direction + slashMenuItems.length) % slashMenuItems.length;
        });
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        runSlashMenuItem(slashMenuItems[slashMenuIndex] ?? slashMenuItems[0]);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setShowSlashMenu(false);
        return;
      }

      if (event.key === "Backspace" || event.key === "Delete") {
        setShowSlashMenu(false);
      }
    }

    if (event.key === "Enter" && !event.shiftKey) {
      const target = event.target as HTMLElement;
      const isWidgetField =
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement;

      if (!isWidgetField && insertPlainLineBreak()) {
        event.preventDefault();
      } else if (!isWidgetField) {
        normalizeLineAfterEnter();
      }
      return;
    }

    if (event.key !== "Tab") return;

    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const element =
      range?.startContainer instanceof HTMLElement
        ? range.startContainer
        : range?.startContainer.parentElement;

    if (!element?.closest("li")) return;

    event.preventDefault();
    document.execCommand(event.shiftKey ? "outdent" : "indent");
    syncEditor();
    rememberSelection();
  };

  const handleEditorBeforeInput = (event: FormEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (!(target instanceof HTMLTextAreaElement) || target.dataset.lureLatexInput !== "true") return;

    const widget = target.closest("[data-lure-latex-widget]") as HTMLElement | null;
    const isReplacingWholeFormula =
      target.value.length > 0 &&
      target.selectionStart === 0 &&
      target.selectionEnd === target.value.length;

    if (widget && isReplacingWholeFormula) {
      widget.dataset.lureLatexResetColorOnInput = "true";
    }
  };

  const handleEditorInput = (event: FormEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;

    if (target instanceof HTMLTextAreaElement && target.dataset.lureCodeInput === "true") {
      const widget = target.closest("[data-lure-code-widget]");
      const preview = widget?.querySelector("[data-lure-code-preview] code");
      if (preview) preview.innerHTML = highlightPythonHtml(target.value);
    }

    if (target instanceof HTMLTextAreaElement && target.dataset.lureLatexInput === "true") {
      const widget = target.closest("[data-lure-latex-widget]");
      if (widget instanceof HTMLElement) {
        const shouldResetColor =
          widget.dataset.lureLatexResetColorOnInput === "true" ||
          target.value.trim().length === 0;

        if (shouldResetColor) {
          resetLatexWidgetColor(widget);
          delete widget.dataset.lureLatexResetColorOnInput;
        }
      }
      rememberLatexInputSelection(target);
      updateLatexWidgetPreview(widget, target.value);
    }

    if (target instanceof HTMLTextAreaElement && target.dataset.lureTableCellInput === "true") {
      const cell = target.closest("[data-lure-table-cell]") as HTMLElement | null;
      if (cell) selectTableCell(cell);
    }

    if (target instanceof HTMLInputElement && target.dataset.lureTableTitle === "true") {
      syncEditor();
      return;
    }

    if (target instanceof HTMLInputElement && (target.dataset.lureTableWidthInput === "true" || target.dataset.lureTableHeightInput === "true")) {
      const widget = getTableWidget(target);
      const cell = widget ? getSelectedTableCell(widget) : null;
      const value = Number(target.value);

      if (cell && Number.isFinite(value)) {
        if (target.dataset.lureTableWidthInput === "true") {
          cell.dataset.lureTableWidth = String(Math.min(420, Math.max(60, value)));
        } else {
          cell.dataset.lureTableHeight = String(Math.min(180, Math.max(34, value)));
        }

        applyTableCellPresentation(cell);
      }
    }

    syncEditor();
  };

  const applyLatexColorButton = (latexColorButton: HTMLElement) => {
    const color = textColors.find((item) => item.value === latexColorButton.dataset.lureLatexColorButton);
    const widget = latexColorButton.closest("[data-lure-latex-widget]") as HTMLElement | null;
    const preview = widget?.querySelector("[data-lure-latex-preview]") as HTMLElement | null;
    const input = widget?.querySelector("[data-lure-latex-input]") as HTMLTextAreaElement | null;

    if (!color || !widget || !preview || !input) return;

    if (document.activeElement === input) {
      rememberLatexInputSelection(input);
    }

    const rememberedStart = Number(widget.dataset.lureLatexSelectionStart ?? input.selectionStart);
    const rememberedEnd = Number(widget.dataset.lureLatexSelectionEnd ?? input.selectionEnd);
    const start = Math.max(0, Math.min(rememberedStart, rememberedEnd));
    const end = Math.max(start, Math.max(rememberedStart, rememberedEnd));

    if (end > start) {
      const before = input.value.slice(0, start);
      const selected = input.value.slice(start, end);
      const after = input.value.slice(end);
      const wrapped = `\\textcolor{${color.value}}{${selected}}`;

      input.value = `${before}${wrapped}${after}`;
      input.textContent = input.value;
      updateLatexWidgetPreview(widget, input.value);
      input.focus();
      input.setSelectionRange(start + wrapped.length, start + wrapped.length);
      rememberLatexInputSelection(input);
    } else {
      widget.dataset.lureLatexColor = color.value;
      preview.style.color = color.css;
    }

    syncEditor();
  };

  const runTableCommand = (target: HTMLElement) => {
    const actionButton = target.closest("[data-lure-table-action]") as HTMLElement | null;
    const modeButton = target.closest("[data-lure-table-mode-button]") as HTMLElement | null;
    const alignButton = target.closest("[data-lure-table-align-button]") as HTMLElement | null;
    const colorButton = target.closest("[data-lure-table-color-button]") as HTMLElement | null;
    const widget = getTableWidget(target);

    if (!widget) return false;

    if (actionButton || modeButton) {
      const table = tableFromWidget(widget);
      const columnCount = Math.max(...table.rows.map((row) => row.length), 1);

      if (actionButton?.dataset.lureTableAction === "add-row") {
        table.rows.push(Array.from({ length: columnCount }, () => defaultTableCell()));
      }

      if (actionButton?.dataset.lureTableAction === "remove-row" && table.rows.length > 1) {
        table.rows.pop();
      }

      if (actionButton?.dataset.lureTableAction === "add-column") {
        table.rows = table.rows.map((row, rowIndex) => [...row, defaultTableCell(rowIndex === 0 ? `coluna_${row.length + 1}` : "")]);
      }

      if (actionButton?.dataset.lureTableAction === "remove-column" && columnCount > 1) {
        table.rows = table.rows.map((row) => row.slice(0, -1));
      }

      if (modeButton?.dataset.lureTableModeButton === "fit" || modeButton?.dataset.lureTableModeButton === "scroll") {
        table.mode = modeButton.dataset.lureTableModeButton;
      }

      replaceTableWidget(widget, table);
      syncEditor();
      return true;
    }

    const selectedCell = getSelectedTableCell(widget);
    if (!selectedCell) return false;

    if (alignButton?.dataset.lureTableAlignButton) {
      selectedCell.dataset.lureTableAlign = alignButton.dataset.lureTableAlignButton;
      applyTableCellPresentation(selectedCell);
      syncEditor();
      return true;
    }

    if (colorButton?.dataset.lureTableColorButton) {
      selectedCell.dataset.lureTableColor = colorButton.dataset.lureTableColorButton;
      applyTableCellPresentation(selectedCell);
      syncEditor();
      return true;
    }

    return false;
  };

  const handleEditorMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const tableControl = target.closest("[data-lure-table-action], [data-lure-table-mode-button], [data-lure-table-align-button], [data-lure-table-color-button]") as HTMLElement | null;

    if (tableControl) {
      event.preventDefault();
      event.stopPropagation();
      runTableCommand(tableControl);
      return;
    }

    const latexColorButton = target.closest("[data-lure-latex-color-button]") as HTMLElement | null;

    if (!latexColorButton) return;

    event.preventDefault();
    event.stopPropagation();
    applyLatexColorButton(latexColorButton);
    latexColorButton.dataset.lureLatexMouseHandled = "true";
  };

  const handleEditorClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const diagramEditButton = target.closest("[data-lure-diagram-edit]") as HTMLElement | null;
    if (diagramEditButton) {
      event.preventDefault();
      event.stopPropagation();
      const widget = diagramEditButton.closest("[data-lure-diagram-widget]") as HTMLElement | null;
      if (widget) openDiagramModalForWidget(widget);
      return;
    }

    const diagramWidget = target.closest("[data-lure-diagram-widget]") as HTMLElement | null;
    if (diagramWidget) {
      event.preventDefault();
      openDiagramModalForWidget(diagramWidget);
      return;
    }

    const tableCell = target.closest("[data-lure-table-cell]") as HTMLElement | null;

    if (tableCell) {
      selectTableCell(tableCell);
      return;
    }

    if (target instanceof HTMLTextAreaElement && target.dataset.lureLatexInput === "true") {
      rememberLatexInputSelection(target);
      return;
    }

    const latexColorButton = target.closest("[data-lure-latex-color-button]") as HTMLElement | null;

    if (latexColorButton) {
      if (latexColorButton.dataset.lureLatexMouseHandled === "true") {
        delete latexColorButton.dataset.lureLatexMouseHandled;
      } else {
        applyLatexColorButton(latexColorButton);
      }

      return;
    }

    const image = target.closest("img[data-lure-image]") as HTMLImageElement | null;

    if (!image) {
      setSelectedImageId("");
      return;
    }

    setSelectedImageId(image.dataset.lureImageId || "");
    setSelectedImageWidth(Number.parseInt(image.style.width, 10) || 72);
  };

  const insertInlineImage = (file: File | undefined) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      insertEditorHtml(editorRef.current, imageWidgetHtml(String(reader.result ?? ""), file.name, 72));
      syncEditor();
    };
    reader.readAsDataURL(file);
  };

  const resizeSelectedImage = (width: number) => {
    setSelectedImageWidth(width);

    const image = editorRef.current?.querySelector(
      `img[data-lure-image-id="${CSS.escape(selectedImageId)}"]`,
    ) as HTMLImageElement | null;

    if (image) {
      image.style.width = `${width}%`;
      syncEditor();
    }
  };

  const insertDiagramWidget = useCallback(() => {
    const widgetId = makeDiagramId("diagram");
    const diagram = emptyDiagram();
    insertEditorHtml(editorRef.current, diagramWidgetHtml(diagram, widgetId));
    syncEditor();
    setDiagramModal({ widgetId, diagram });
  }, []);

  const openDiagramModalForWidget = useCallback((widget: HTMLElement) => {
    const diagram = diagramFromWidget(widget);
    if (!diagram) return;
    const widgetId = widget.dataset.lureDiagramId || makeDiagramId("diagram");
    if (!widget.dataset.lureDiagramId) widget.dataset.lureDiagramId = widgetId;
    setDiagramModal({ widgetId, diagram });
  }, []);

  const handleDiagramSave = useCallback(
    (diagram: Diagram) => {
      const widgetId = diagramModal?.widgetId;
      if (!widgetId || !editorRef.current) return;

      const widget = editorRef.current.querySelector(
        `[data-lure-diagram-widget][data-lure-diagram-id="${CSS.escape(widgetId)}"]`,
      ) as HTMLElement | null;

      if (!widget) {
        // Widget was removed in the meantime — nothing to update.
        return;
      }

      const template = document.createElement("template");
      template.innerHTML = diagramWidgetHtml(diagram, widgetId);
      const nextWidget = template.content.firstElementChild as HTMLElement | null;
      if (!nextWidget) return;
      widget.replaceWith(nextWidget);
      syncEditor();
    },
    [diagramModal?.widgetId],
  );

  const runSlashCommand = (command: "quote" | "code" | "latex" | "divider" | "bullet" | "table" | "diagram") => {
    editorRef.current?.focus();
    removeSlashBeforeCaret();

    if (command === "quote") {
      insertEditorHtml(editorRef.current, "<blockquote>Uma frase que merece respirar um pouco mais.</blockquote><p><br></p>");
    }

    if (command === "code") {
      insertEditorHtml(editorRef.current, codeWidgetHtml());
    }

    if (command === "latex") {
      insertEditorHtml(editorRef.current, latexWidgetHtml());
    }

    if (command === "table") {
      insertEditorHtml(editorRef.current, tableWidgetHtml());
    }

    if (command === "divider") {
      insertEditorHtml(editorRef.current, '<hr data-lure-divider="true"><p><br></p>');
    }

    if (command === "bullet") {
      document.execCommand("insertUnorderedList");
    }

    if (command === "diagram") {
      setShowSlashMenu(false);
      insertDiagramWidget();
      return;
    }

    setShowSlashMenu(false);
    syncEditor();
  };

  const runSlashMenuItem = (item: (typeof slashMenuItems)[number]) => {
    if ("preset" in item) {
      const preset = fontPresets.find((fontPreset) => fontPreset.value === item.preset);
      editorRef.current?.focus();
      removeSlashBeforeCaret();

      if (preset) applyPreset(preset);

      setShowSlashMenu(false);
      syncEditor();
      return;
    }

    runSlashCommand(item.command);
  };

  const runGrammarReview = async () => {
    if (!accessToken) {
      setStatus("Faca login como admin para usar a revisao.");
      return;
    }

    const targets = collectGrammarTextTargets(editorRef.current, title, excerpt);
    const segments = targets.map(({ id, text }) => ({ id, text }));

    if (segments.length === 0) {
      setStatus("Nao encontrei texto para corrigir.");
      return;
    }

    syncEditor();
    setIsAiReviewing("grammar");
    setStatus("Corrigindo gramatica...");

    try {
      const result = await reviewGrammar({ data: { adminToken: accessToken, segments } });
      const targetsById = new Map(targets.map((target) => [target.id, target]));
      let appliedChanges = 0;

      historyPastRef.current = [...historyPastRef.current.slice(-79), editorHtmlRef.current];
      historyFutureRef.current = [];

      for (const change of result.changes) {
        const target = targetsById.get(change.id);
        if (!target || !change.correctedText || change.correctedText === target.text) continue;

        if (target.kind === "title") {
          setTitle(change.correctedText);
        } else if (target.kind === "excerpt") {
          setExcerpt(change.correctedText);
        } else {
          target.node.textContent = change.correctedText;
        }

        appliedChanges += 1;
      }

      syncEditor(false);
      setStatus(
        appliedChanges > 0
          ? `Gramatica corrigida em ${appliedChanges} trecho${appliedChanges === 1 ? "" : "s"}.`
          : "A gramatica ja parece boa.",
      );
    } catch (error) {
      setStatus(error instanceof Error ? `Erro na revisao: ${error.message}` : "Erro na revisao gramatical.");
    } finally {
      setIsAiReviewing(null);
    }
  };

  const runTechnicalReview = async () => {
    if (!accessToken) {
      setStatus("Faca login como admin para usar a revisao.");
      return;
    }

    restoreSelection();
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const selectedText =
      range && editorRef.current?.contains(range.commonAncestorContainer) && !selection?.isCollapsed
        ? selection?.toString().trim() ?? ""
        : "";
    const selectedHtml = selectedText && range ? cleanSelectionHtmlForAi(range) : "";
    const text = selectedText || collectReviewText(editorRef.current, title, excerpt);

    if (!text.trim()) {
      setStatus("Nao encontrei texto para revisar.");
      return;
    }

    if (!selectedText) {
      const confirmed = window.confirm(
        "Nenhum trecho esta selecionado. Enviar o texto inteiro do editor para revisao tecnica?",
      );
      if (!confirmed) return;
      technicalReviewRangeRef.current = null;
    } else if (range) {
      technicalReviewRangeRef.current = range.cloneRange();
    }

    setIsAiReviewing("technical");
    setStatus("Analisando conteudo tecnico...");
    setTechnicalReviewDialog(null);

    try {
      const result = await reviewTechnicalContent({
        data: {
          adminToken: accessToken,
          text,
          html: selectedHtml,
          context: categories.find((category) => category.slug === categorySlug)?.name ?? categorySlug,
        },
      });

      setTechnicalReviewDialog({
        result,
        originalText: text,
        suggestedHtml: selectedHtml ? result.suggestedHtml : "",
        canApply: Boolean(selectedText && technicalReviewRangeRef.current && result.suggestedRewrite.trim()),
      });
      setStatus("Revisao tecnica pronta.");
    } catch (error) {
      setStatus(error instanceof Error ? `Erro na revisao: ${error.message}` : "Erro na revisao tecnica.");
    } finally {
      setIsAiReviewing(null);
    }
  };

  const applyTechnicalSuggestion = () => {
    const suggestion = technicalReviewDialog?.result.suggestedRewrite.trim();
    const suggestedHtml = technicalReviewDialog?.suggestedHtml.trim();
    const range = technicalReviewRangeRef.current;

    if (!suggestion || !range || !editorRef.current) return;

    historyPastRef.current = [...historyPastRef.current.slice(-79), editorHtmlRef.current];
    historyFutureRef.current = [];
    range.deleteContents();

    const fragment = suggestedHtml ? sanitizeAiSuggestionHtml(suggestedHtml) : null;
    range.insertNode(fragment && fragment.textContent?.trim() ? fragment : document.createTextNode(suggestion));

    setTechnicalReviewDialog(null);
    technicalReviewRangeRef.current = null;
    syncEditor(false);
    setStatus("Sugestao tecnica aplicada.");
  };

  const submitPost = async () => {
    if (!accessToken) {
      setStatus("Faca login como admin para publicar.");
      return;
    }

    const action = editingSlug ? "Atualizando" : "Publicando";
    setStatus(`${action}...`);
    setIsPublishing(true);

    const parsedBlocks = parseEditorBlocks(editorRef.current);
    const payload = {
      title,
      excerpt,
      categorySlug,
      coverDataUrl,
      blocks: parsedBlocks,
      adminToken: accessToken,
    };

    try {
      const post = editingSlug
        ? await updatePublishedPost({ data: { ...payload, slug: editingSlug } })
        : await publishPost({ data: payload });

      saveLocalPublishedPost(post);
      clearWriterDraft(editingSlug);
      clearWriterDraft(post.slug);
      if (!editingSlug) clearWriterDraft("");
      setPublished(post);
      setEditingSlug(post.slug);
      setDraftStatus("");
      setStatus(editingSlug ? "Post atualizado com sucesso." : "Post publicado com sucesso.");

      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", `/escrever?edit=${post.slug}`);
      }
    } catch (error) {
      setStatus(error instanceof Error ? `Erro ao publicar: ${error.message}` : "Erro ao publicar: nao consegui salvar.");
    } finally {
      setIsPublishing(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background text-foreground" style={writerTheme}>
        <Header />
        <main className="mx-auto max-w-3xl px-4 py-16 text-muted-foreground">
          {isCheckingAdmin ? "Verificando acesso admin..." : "Redirecionando para login..."}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground" style={writerTheme}>
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {editingSlug ? "editar canteiro" : "novo canteiro"}
            </p>
            <h1 className="mt-3 font-display text-5xl leading-tight md:text-6xl">
              {editingSlug ? "Editar" : "Escrever"} <em className="italic text-gradient">post</em>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              {stats.words} palavras · {stats.readTime} min
            </span>
            {draftStatus && (
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                {draftStatus}
              </span>
            )}
            {availableDraft && (
              <button
                type="button"
                onClick={() => applyDraft(availableDraft)}
                className="inline-flex h-9 items-center rounded-md border border-border bg-card px-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
              >
                Voltar rascunho
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                syncEditor();
                setShowPreview((value) => !value);
              }}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              <Eye className="h-4 w-4" />
              {showPreview ? "Ocultar preview" : "Preview"}
            </button>
            <button
              type="button"
              onClick={submitPost}
              disabled={isPublishing || isLoadingPost}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-gradient-glow px-4 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {isLoadingPost ? "Carregando" : isPublishing ? (editingSlug ? "Atualizando" : "Publicando") : editingSlug ? "Atualizar" : "Publicar"}
            </button>
            {status && (
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground" aria-live="polite">
                {status}
              </span>
            )}
          </div>
        </div>

        <section className="space-y-5">
          <div className="rounded-2xl border border-border bg-card/70 p-5">
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr_240px]">
              <label className="block">
                <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  Titulo
                </span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="mt-2 h-11 w-full rounded-lg border border-border bg-input/40 px-3 text-sm outline-none focus:border-primary/60"
                  placeholder="Meu novo post"
                />
              </label>

              <label className="block">
                <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  Resumo
                </span>
                <textarea
                  value={excerpt}
                  onChange={(event) => setExcerpt(event.target.value)}
                  className="mt-2 min-h-24 w-full resize-y rounded-lg border border-border bg-input/40 px-3 py-2 text-sm leading-relaxed outline-none focus:border-primary/60"
                  placeholder="Uma frase curta para abrir o post."
                />
              </label>

              <div className="space-y-4">
                <label className="block">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    Categoria
                  </span>
                  <select
                    value={categorySlug}
                    onChange={(event) => setCategorySlug(event.target.value)}
                    className="mt-2 h-11 w-full rounded-lg border border-border bg-input/40 px-3 text-sm outline-none focus:border-primary/60"
                  >
                    {categories.map((category) => (
                      <option key={category.slug} value={category.slug}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex min-h-16 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-secondary/30 px-4 py-3 text-center transition-colors hover:border-primary/50">
                  <ImagePlus className="h-5 w-5 text-muted-foreground" />
                  <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    Capa
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => handleCoverChange(event.target.files?.[0])}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-border bg-card/70">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={runGrammarReview}
                disabled={Boolean(isAiReviewing)}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 font-mono text-[11px] uppercase tracking-widest text-primary transition-colors hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Corrigir gramatica"
                title="Corrigir gramatica"
              >
                <Sparkles className="h-4 w-4" />
                {isAiReviewing === "grammar" ? "Corrigindo" : "Gramatica"}
              </button>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={runTechnicalReview}
                disabled={Boolean(isAiReviewing)}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Verificar conteudo tecnico"
                title="Verificar conteudo tecnico"
              >
                <Sparkles className="h-4 w-4" />
                {isAiReviewing === "technical" ? "Analisando" : "Tecnico"}
              </button>

              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => applyHistoryCommand("undo")}
                className="grid h-9 w-9 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Desfazer"
                title="Desfazer"
              >
                <Undo2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => applyHistoryCommand("redo")}
                className="grid h-9 w-9 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Refazer"
                title="Refazer"
              >
                <Redo2 className="h-4 w-4" />
              </button>

              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={applyBold}
                className="grid h-9 w-9 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Negrito"
              >
                <Bold className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-1 rounded-md border border-border px-2 py-1">
                <Palette className="h-4 w-4 text-muted-foreground" />
                {textColors.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyColor(color.value)}
                    className="grid h-7 w-7 place-items-center rounded-md transition-colors hover:bg-secondary"
                    aria-label={color.label}
                    title={color.label}
                  >
                    <span className={`h-3.5 w-3.5 rounded-full ${color.swatch}`} />
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 rounded-md border border-border px-2 py-1">
                {fontPresets.map((preset) => {
                  const Icon = preset.icon;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => applyPreset(preset)}
                      className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      aria-label={preset.label}
                      title={preset.label}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  );
                })}
                <input
                  type="number"
                  min={10}
                  max={96}
                  value={fontSize}
                  onChange={(event) => {
                    const nextSize = Number(event.target.value);
                    setFontSize(nextSize);
                    applyTextStyle({ fontSize: nextSize });
                  }}
                  className="h-7 w-16 rounded-md border border-border bg-input/40 px-2 text-xs outline-none focus:border-primary/60"
                  aria-label="Tamanho da fonte"
                />
              </div>

              <select
                value={fontFamily}
                onMouseDown={(event) => event.stopPropagation()}
                onChange={(event) => {
                  setFontFamily(event.target.value);
                  applyTextStyle({ fontFamily: event.target.value });
                }}
                className="h-9 rounded-md border border-border bg-input/40 px-2 text-xs outline-none focus:border-primary/60"
                aria-label="Fonte"
              >
                {fontFamilies.map((family) => (
                  <option key={family.value} value={family.value}>
                    {family.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => runSlashCommand("quote")}
                className="grid h-9 w-9 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Quote"
                title="Quote"
              >
                <Quote className="h-4 w-4" />
              </button>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => runSlashCommand("code")}
                className="grid h-9 w-9 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Codigo"
                title="Codigo"
              >
                <Code2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => runSlashCommand("latex")}
                className="grid h-9 w-9 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="LaTeX"
                title="LaTeX"
              >
                <Sigma className="h-4 w-4" />
              </button>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => runSlashCommand("table")}
                className="grid h-9 w-9 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Tabela dataframe"
                title="Tabela dataframe"
              >
                <Table2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => runSlashCommand("diagram")}
                className="grid h-9 w-9 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Organograma"
                title="Organograma"
              >
                <Workflow className="h-4 w-4" />
              </button>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => runSlashCommand("divider")}
                className="grid h-9 w-9 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Divisor"
                title="Divisor"
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={applyBulletList}
                className="grid h-9 w-9 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Bullet point"
                title="Bullet point"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => inlineImageInputRef.current?.click()}
                className="grid h-9 w-9 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Imagem no texto"
                title="Imagem no texto"
              >
                <ImagePlus className="h-4 w-4" />
              </button>
              <input
                ref={inlineImageInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => {
                  insertInlineImage(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </div>

            {selectedImageId && (
              <div className="flex flex-wrap items-center gap-3 border-b border-border bg-secondary/20 px-4 py-3">
                <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  largura da imagem
                </span>
                <input
                  type="range"
                  min={25}
                  max={100}
                  value={selectedImageWidth}
                  onChange={(event) => resizeSelectedImage(Number(event.target.value))}
                  className="w-56 accent-primary"
                />
                <span className="font-mono text-xs text-muted-foreground">{selectedImageWidth}%</span>
              </div>
            )}

            <div
              ref={setEditorElement}
              contentEditable
              role="textbox"
              aria-multiline="true"
              tabIndex={0}
              suppressContentEditableWarning
              className="lure-editor-surface min-h-[34rem] w-full whitespace-pre-wrap bg-background/60 px-5 py-5 text-base leading-8 outline-none focus:ring-2 focus:ring-primary/30 sm:px-7 [&>*]:mx-auto [&>*]:max-w-3xl [&_blockquote]:my-5 [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-5 [&_blockquote]:font-display [&_blockquote]:text-2xl [&_blockquote]:italic [&_hr]:my-8 [&_hr]:border-border/70 [&_p]:my-4"
              onBeforeInput={handleEditorBeforeInput}
              onInput={handleEditorInput}
              onMouseDown={handleEditorMouseDown}
              onClick={handleEditorClick}
              onKeyDown={handleEditorKeyDown}
              onFocus={() => {
                if (editorRef.current && editorRef.current.innerHTML.trim() === "") {
                  editorRef.current.innerHTML = emptyEditor;
                  placeCaretInside(editorRef.current);
                }
                rememberSelection();
              }}
              onMouseUp={(event) => {
                const target = event.target as HTMLElement;
                if (target instanceof HTMLTextAreaElement && target.dataset.lureLatexInput === "true") {
                  rememberLatexInputSelection(target);
                }
                rememberSelection();
              }}
              onKeyUp={(event) => {
                const target = event.target as HTMLElement;
                if (target instanceof HTMLTextAreaElement && target.dataset.lureLatexInput === "true") {
                  rememberLatexInputSelection(target);
                }
                if (event.key === "/") {
                  setShowSlashMenu(true);
                  setSlashMenuIndex(0);
                }
                if (event.key === "Escape") setShowSlashMenu(false);
                syncEditor();
                rememberSelection();
              }}
              onBlur={() => setTimeout(() => setShowSlashMenu(false), 120)}
            />

            {showSlashMenu && (
              <div className="absolute left-6 top-16 z-20 max-h-96 w-72 overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-card">
                {slashMenuItems.map((item, index) => {
                  const Icon = item.icon;
                  const isActive = index === slashMenuIndex;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setSlashMenuIndex(index)}
                      onClick={() => runSlashMenuItem(item)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                        isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-primary" />
                      <span className="min-w-0">
                        <span className="block font-medium">{item.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {status && (
            <div className="rounded-xl border border-border bg-card/70 px-4 py-3 text-sm text-muted-foreground">
              {status}
              {published && (
                <a href={`/posts/${published.slug}`} className="ml-3 text-primary hover:underline">
                  abrir post
                </a>
              )}
            </div>
          )}

          {showPreview && (
            <PostPreview
              title={title}
              excerpt={excerpt}
              categorySlug={categorySlug}
              coverDataUrl={coverDataUrl}
              blocks={parseEditorBlocks(editorRef.current)}
            />
          )}
        </section>
      </main>

      {technicalReviewDialog && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4">
          <section className="w-full max-w-2xl rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
                  revisao tecnica
                </p>
                <h2 className="mt-2 font-display text-3xl leading-tight">
                  {technicalReviewDialog.result.hasIssue ? "Possivel ajuste" : "Nenhum erro claro"}
                </h2>
              </div>
              <span className="rounded-full border border-border px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                confianca {technicalReviewDialog.result.confidence}
              </span>
            </div>

            <div className="mt-5 space-y-4 text-sm leading-relaxed">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  trecho analisado
                </p>
                <p className="mt-2 max-h-32 overflow-y-auto rounded-lg border border-border bg-background/60 p-3 text-muted-foreground">
                  {technicalReviewDialog.originalText}
                </p>
              </div>

              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  motivo
                </p>
                <p className="mt-2 text-foreground">{technicalReviewDialog.result.reason}</p>
              </div>

              {technicalReviewDialog.result.suggestedRewrite && (
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    sugestao
                  </p>
                  <div
                    className="mt-2 rounded-lg border border-primary/30 bg-primary/10 p-3 text-foreground"
                    dangerouslySetInnerHTML={{
                      __html: technicalReviewDialog.suggestedHtml || escapeHtml(technicalReviewDialog.result.suggestedRewrite),
                    }}
                  />
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setTechnicalReviewDialog(null);
                  technicalReviewRangeRef.current = null;
                }}
                className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                Ignorar
              </button>
              {technicalReviewDialog.canApply && (
                <button
                  type="button"
                  onClick={applyTechnicalSuggestion}
                  className="inline-flex h-10 items-center rounded-md bg-gradient-glow px-4 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02]"
                >
                  Aplicar sugestao
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      <DiagramEditor
        open={Boolean(diagramModal)}
        initialDiagram={diagramModal?.diagram ?? null}
        onClose={() => setDiagramModal(null)}
        onSave={handleDiagramSave}
      />

      <Footer />
    </div>
  );
}
