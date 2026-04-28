function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const commandMap: Record<string, string> = {
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "δ",
  epsilon: "ε",
  theta: "θ",
  lambda: "λ",
  mu: "μ",
  pi: "π",
  sigma: "σ",
  phi: "φ",
  omega: "ω",
  Gamma: "Γ",
  Delta: "Δ",
  Theta: "Θ",
  Lambda: "Λ",
  Pi: "Π",
  Sigma: "Σ",
  Phi: "Φ",
  Omega: "Ω",
  cdot: "·",
  times: "×",
  div: "÷",
  leq: "≤",
  geq: "≥",
  neq: "≠",
  approx: "≈",
  infty: "∞",
  partial: "∂",
  nabla: "∇",
  pm: "±",
  to: "→",
  rightarrow: "→",
  leftarrow: "←",
  ltimes: "⋉",
  ln: "ln",
  log: "log",
  sin: "sin",
  cos: "cos",
  tan: "tan",
};

const colorMap: Record<string, string> = {
  default: "var(--foreground)",
  muted: "var(--muted-foreground)",
  primary: "var(--primary)",
  leaf: "var(--leaf)",
  clay: "var(--clay)",
  sand: "var(--sand)",
  crimson: "var(--crimson)",
};

function latexColor(value: string) {
  return colorMap[value.trim()] ?? colorMap.default;
}

export function renderLatexHtml(source: string) {
  const input = source
    .trim()
    .replace(/^\$\$?/, "")
    .replace(/\$\$?$/, "")
    .trim();
  let index = 0;

  const peek = () => input[index] ?? "";
  const consume = () => input[index++] ?? "";

  const skipSpaces = () => {
    while (peek() === " " || peek() === "\n" || peek() === "\t") index += 1;
  };

  const parseGroup = () => {
    skipSpaces();
    if (peek() !== "{") return parseAtom();
    consume();
    const value = parseSequence("}");
    if (peek() === "}") consume();
    return value;
  };

  const parseRawGroup = () => {
    skipSpaces();
    if (peek() !== "{") return "";

    consume();
    let depth = 1;
    let value = "";

    while (index < input.length && depth > 0) {
      const current = consume();

      if (current === "{") {
        depth += 1;
        value += current;
        continue;
      }

      if (current === "}") {
        depth -= 1;
        if (depth > 0) value += current;
        continue;
      }

      value += current;
    }

    return value;
  };

  const parseScriptValue = () => {
    skipSpaces();
    return peek() === "{" ? parseGroup() : parseAtom();
  };

  const withScripts = (base: string, isOperator = false) => {
    let sub = "";
    let sup = "";

    while (peek() === "_" || peek() === "^") {
      const marker = consume();
      const value = parseScriptValue();
      if (marker === "_") sub = value;
      if (marker === "^") sup = value;
      skipSpaces();
    }

    if (!sub && !sup) return base;

    if (isOperator) {
      return `<span class="latex-limits"><span class="latex-limit-sup">${sup}</span><span class="latex-limit-base">${base}</span><span class="latex-limit-sub">${sub}</span></span>`;
    }

    return `<span class="latex-script"><span>${base}</span><span class="latex-script-stack">${sup ? `<sup>${sup}</sup>` : ""}${sub ? `<sub>${sub}</sub>` : ""}</span></span>`;
  };

  const parseCommand = () => {
    let name = "";
    while (/[A-Za-z]/.test(peek())) name += consume();

    if (name === "frac") {
      const numerator = parseGroup();
      const denominator = parseGroup();
      return `<span class="latex-frac"><span class="latex-frac-num">${numerator}</span><span class="latex-frac-den">${denominator}</span></span>`;
    }

    if (name === "sqrt") {
      return `<span class="latex-root"><span class="latex-root-symbol">√</span><span class="latex-root-body">${parseGroup()}</span></span>`;
    }

    if (name === "textcolor" || name === "color") {
      const color = parseRawGroup();
      return `<span class="latex-color" style="color: ${latexColor(color)}">${parseGroup()}</span>`;
    }

    if (name === "sum" || name === "prod" || name === "int") {
      const symbol = name === "sum" ? "∑" : name === "prod" ? "∏" : "∫";
      return withScripts(`<span class="latex-op">${symbol}</span>`, true);
    }

    if (name === ",") return '<span class="latex-thin-space"></span>';

    const mapped = commandMap[name] ?? `\\${name}`;
    const isNamedFunction = ["ln", "log", "sin", "cos", "tan"].includes(name);
    return `<span class="${isNamedFunction ? "latex-fn" : ""}">${escapeHtml(mapped)}</span>`;
  };

  function parseAtom(): string {
    const current = peek();
    if (!current) return "";

    if (current === "\\") {
      consume();
      return parseCommand();
    }

    if (current === "{") return parseGroup();
    if (current === "}") return "";
    if (current === "$") {
      consume();
      return "";
    }

    consume();
    if (current === " ") return " ";
    if (current === "-") return "−";
    return escapeHtml(current);
  }

  function parseSequence(stop?: string): string {
    let html = "";

    while (index < input.length && (!stop || peek() !== stop)) {
      skipSpaces();
      if (stop && peek() === stop) break;
      if (!peek()) break;

      const before = index;
      const atom = parseAtom();
      const isOperator = atom.includes("latex-op");
      html += withScripts(atom, isOperator);

      if (index === before) index += 1;
    }

    return html;
  }

  return parseSequence() || escapeHtml(source);
}
