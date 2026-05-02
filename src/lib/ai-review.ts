import { createServerFn } from "@tanstack/react-start";
import { requireAdmin } from "@/lib/publishing";

type GrammarSegment = {
  id: string;
  text: string;
};

type GrammarReviewInput = {
  adminToken: string;
  segments: GrammarSegment[];
};

type TechnicalReviewInput = {
  adminToken: string;
  text: string;
  html?: string;
  context?: string;
};

type OpenAITextPart = {
  type?: string;
  text?: string;
};

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    content?: OpenAITextPart[];
  }>;
};

export type GrammarReviewResult = {
  changes: Array<{
    id: string;
    correctedText: string;
  }>;
};

export type TechnicalReviewResult = {
  hasIssue: boolean;
  severity: "baixa" | "media" | "alta";
  reason: string;
  suggestedRewrite: string;
  suggestedHtml: string;
  confidence: "baixa" | "media" | "alta";
};

const GRAMMAR_MODEL = "gpt-5-mini";
const TECHNICAL_MODEL = "gpt-5.2";
const OPENAI_URL = "https://api.openai.com/v1/responses";

function normalizeGrammarReviewInput(data: unknown): GrammarReviewInput {
  const current = data as Partial<GrammarReviewInput>;
  const segments = Array.isArray(current.segments) ? current.segments : [];

  return {
    adminToken: String(current.adminToken ?? "").trim(),
    segments: segments
      .map((segment) => ({
        id: String((segment as Partial<GrammarSegment>).id ?? "").trim(),
        text: String((segment as Partial<GrammarSegment>).text ?? ""),
      }))
      .filter((segment) => segment.id && segment.text.trim())
      .slice(0, 160),
  };
}

function normalizeTechnicalReviewInput(data: unknown): TechnicalReviewInput {
  const current = data as Partial<TechnicalReviewInput>;

  return {
    adminToken: String(current.adminToken ?? "").trim(),
    text: String(current.text ?? "").trim().slice(0, 18000),
    html: String(current.html ?? "").trim().slice(0, 26000),
    context: String(current.context ?? "").trim().slice(0, 400),
  };
}

async function getOpenAIKey() {
  if (typeof window !== "undefined") return "";
  const { env } = await import("cloudflare:workers");
  const key = (env as CloudflareBindings).OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OpenAI nao esta configurada.");
  return key;
}

function getResponseText(response: OpenAIResponse) {
  if (response.output_text) return response.output_text;

  return (
    response.output
      ?.flatMap((item) => item.content ?? [])
      .map((part) => part.text ?? "")
      .join("")
      .trim() ?? ""
  );
}

async function callOpenAI<T>(model: string, instructions: string, input: unknown, schema: Record<string, unknown>) {
  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await getOpenAIKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: instructions,
        },
        {
          role: "user",
          content: JSON.stringify(input),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "review_result",
          schema,
          strict: true,
        },
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || `Erro OpenAI: ${response.status}`);
  }

  const data = (await response.json()) as OpenAIResponse;
  const text = getResponseText(data);
  if (!text) throw new Error("A OpenAI nao retornou conteudo.");

  return JSON.parse(text) as T;
}

export const reviewGrammar = createServerFn({ method: "POST" })
  .inputValidator(normalizeGrammarReviewInput)
  .handler(async ({ data }) => {
    await requireAdmin(data.adminToken);

    if (data.segments.length === 0) {
      throw new Error("Nao encontrei texto para corrigir.");
    }

    const characterCount = data.segments.reduce((total, segment) => total + segment.text.length, 0);
    if (characterCount > 24000) {
      throw new Error("Texto muito longo para uma unica correcao. Revise por partes.");
    }

    return callOpenAI<GrammarReviewResult>(
      GRAMMAR_MODEL,
      [
        "Voce e uma revisora de portugues brasileiro para um blog pessoal de ciencia de dados.",
        "Corrija gramatica, acentos, pontuacao e pequenas melhorias de fluidez.",
        "Nao altere o sentido, nao invente conteudo, nao mude termos tecnicos e preserve quebras de linha internas.",
        "Retorne apenas os segmentos que precisam mudar, mantendo exatamente o mesmo id.",
      ].join(" "),
      { segments: data.segments },
      {
        type: "object",
        additionalProperties: false,
        properties: {
          changes: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                id: { type: "string" },
                correctedText: { type: "string" },
              },
              required: ["id", "correctedText"],
            },
          },
        },
        required: ["changes"],
      },
    );
  });

export const reviewTechnicalContent = createServerFn({ method: "POST" })
  .inputValidator(normalizeTechnicalReviewInput)
  .handler(async ({ data }) => {
    await requireAdmin(data.adminToken);

    if (!data.text) throw new Error("Selecione um trecho ou escreva algum texto para revisar.");

    return callOpenAI<TechnicalReviewResult>(
      TECHNICAL_MODEL,
      [
        "Voce e uma revisora tecnica rigorosa para textos de ciencia de dados, IA, estatistica, matematica e programacao.",
        "Analise se o trecho tem erro conceitual, exagero, imprecisao tecnica ou formulacao enganosa.",
        "Se estiver correto, diga hasIssue=false e explique brevemente.",
        "Se houver problema, explique de forma curta e proponha uma reescrita tecnicamente mais precisa.",
        "Se o usuario enviar html, devolva suggestedHtml preservando ao maximo as marcacoes existentes.",
        "Em suggestedHtml use somente texto, br, strong, b, em, i e span com data-lure-color, data-lure-font-size ou data-lure-font-family.",
        "Nao invente estilos novos; reaplique marcas do html original em conceitos correspondentes quando a palavra mudar.",
        "Nao reescreva com floreio; priorize precisao e clareza.",
      ].join(" "),
      {
        context: data.context || "blog pessoal de ciencia de dados",
        text: data.text,
        html: data.html || "",
      },
      {
        type: "object",
        additionalProperties: false,
        properties: {
          hasIssue: { type: "boolean" },
          severity: { type: "string", enum: ["baixa", "media", "alta"] },
          reason: { type: "string" },
          suggestedRewrite: { type: "string" },
          suggestedHtml: { type: "string" },
          confidence: { type: "string", enum: ["baixa", "media", "alta"] },
        },
        required: ["hasIssue", "severity", "reason", "suggestedRewrite", "suggestedHtml", "confidence"],
      },
    );
  });
