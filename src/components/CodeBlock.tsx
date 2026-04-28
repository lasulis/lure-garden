import { type ReactNode, useState } from "react";
import { Check, Copy } from "lucide-react";

type Props = { code: string; language?: string; filename?: string };

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

const pythonBuiltins = new Set([
  "dict",
  "enumerate",
  "float",
  "input",
  "int",
  "len",
  "list",
  "map",
  "max",
  "min",
  "print",
  "range",
  "round",
  "set",
  "str",
  "sum",
  "tuple",
  "zip",
]);

function highlightedPython(code: string) {
  const tokenPattern =
    /(#.*$|"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_]*\b|[()[\]{}.,:;=+\-*/%<>!]+)/gm;
  const parts: ReactNode[] = [];
  let cursor = 0;
  let index = 0;

  for (const match of code.matchAll(tokenPattern)) {
    const value = match[0];
    const start = match.index ?? 0;

    if (start > cursor) parts.push(code.slice(cursor, start));

    let className = "";
    if (value.startsWith("#")) className = "text-emerald";
    else if (value.startsWith("\"") || value.startsWith("'")) className = "text-sand";
    else if (/^\d/.test(value)) className = "text-clay";
    else if (pythonKeywords.has(value)) className = "text-crimson";
    else if (pythonBuiltins.has(value)) className = "text-leaf";
    else if (/^[()[\]{}.,:;=+\-*/%<>!]+$/.test(value)) className = "text-muted-foreground";

    parts.push(
      className ? (
        <span key={`token-${index}`} className={className}>
          {value}
        </span>
      ) : (
        value
      ),
    );

    cursor = start + value.length;
    index += 1;
  }

  if (cursor < code.length) parts.push(code.slice(cursor));
  return parts;
}

export function CodeBlock({ code, language = "python", filename }: Props) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-[var(--code-background)] shadow-card">
      <div className="flex items-center justify-between border-b border-border bg-[var(--code-header-background)] px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-rose/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald/70" />
          <span className="ml-3 font-mono text-xs text-muted-foreground">
            {filename ?? `${language}`}
          </span>
        </div>
        <button
          onClick={onCopy}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "copiado" : "copiar"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed">
        <code className="text-[var(--code-foreground)]">
          {language.toLowerCase().includes("python") || language.toLowerCase() === "py"
            ? highlightedPython(code)
            : code}
        </code>
      </pre>
    </div>
  );
}
