import hero from "@/assets/hero-featured.jpg";
import p1 from "@/assets/post-1.jpg";
import p2 from "@/assets/post-2.jpg";
import p3 from "@/assets/post-3.jpg";
import p4 from "@/assets/post-4.jpg";
import { Sparkles, BarChart3, Code2, NotebookPen, Map, type LucideIcon } from "lucide-react";

export type Category = {
  slug: string;
  name: string;
  color: string; // token name
  count: number;
  icon: LucideIcon;
  description: string;
};

export const categories: Category[] = [
  { slug: "data-science", name: "Ciência de Dados", color: "leaf", count: 18, icon: BarChart3, description: "Análises, modelos e gráficos honestos." },
  { slug: "gen-ai", name: "IA Generativa", color: "crimson", count: 12, icon: Sparkles, description: "LLMs, RAG, agentes e o que mais brotar." },
  { slug: "roadmaps", name: "Estudos & Roadmaps", color: "sand", count: 8, icon: Map, description: "Trilhas, planos de estudo e o que aprender depois." },
  
  { slug: "python", name: "Python", color: "moss", count: 24, icon: Code2, description: "Truques, padrões e snippets do dia a dia." },
  { slug: "diario", name: "Diário & Notas", color: "sand", count: 7, icon: NotebookPen, description: "Coisas aleatórias que valem ser escritas." },
];

export type Post = {
  slug: string;
  title: string;
  excerpt: string;
  cover: string;
  category: Category;
  author: { name: string; avatar: string };
  date: string;
  readTime: string;
  featured?: boolean;
};

export type PostBody = {
  deck: string;
  sections: Array<{
    title: string;
    paragraphs: string[];
  }>;
  takeaways: string[];
  code?: {
    language: string;
    filename: string;
    value: string;
  };
};

type PostBodyTemplate = Pick<PostBody, "sections" | "takeaways"> & {
  code?: PostBody["code"];
};

const author = {
  name: "Luiza Reixach Castro",
  avatar: "https://i.pravatar.cc/120?img=47",
};

const catBySlug = (s: string) => categories.find((c) => c.slug === s)!;

export const featuredPost: Post = {
  slug: "jardim-digital",
  title: "Cultivando um jardim digital: notas em vez de posts perfeitos",
  excerpt:
    "Por que parei de tratar o blog como vitrine e comecei a tratá-lo como caderno vivo — com rascunhos, ideias meio prontas e código que ainda está crescendo.",
  cover: hero,
  category: catBySlug("roadmaps"),
  author,
  date: "23 de abril, 2026",
  readTime: "8 min",
  featured: true,
};

export const recentPosts: Post[] = [
  // Ciência de Dados (4)
  {
    slug: "clusters-bonitos",
    title: "Clusters bonitos não significam clusters úteis",
    excerpt: "UMAP é viciante. Mas separar pontos no plano não é o mesmo que separar significado.",
    cover: p2,
    category: catBySlug("data-science"),
    author,
    date: "11 abr, 2026",
    readTime: "6 min",
  },
  {
    slug: "feature-eng-honesto",
    title: "Feature engineering honesto: o que não te contam",
    excerpt: "Sobre vazamentos sutis, features que parecem mágicas e por que validar importa mais que criar.",
    cover: p1,
    category: catBySlug("data-science"),
    author,
    date: "08 abr, 2026",
    readTime: "9 min",
  },
  {
    slug: "metricas-mentem",
    title: "Quando suas métricas mentem para você",
    excerpt: "AUC alto, modelo péssimo. Um conto curto sobre desbalanceamento e auto-engano.",
    cover: p3,
    category: catBySlug("data-science"),
    author,
    date: "01 abr, 2026",
    readTime: "5 min",
  },
  {
    slug: "graficos-honestos",
    title: "Gráficos honestos: menos eixos truncados, mais contexto",
    excerpt: "Pequenos hábitos de visualização que mudam como o leitor confia no seu dado.",
    cover: p4,
    category: catBySlug("data-science"),
    author,
    date: "27 mar, 2026",
    readTime: "7 min",
  },
  // IA Generativa (4)
  {
    slug: "rag-do-zero",
    title: "Construindo um RAG do zero com embeddings locais",
    excerpt: "Um passeio honesto pelos trade-offs entre custo, latência e qualidade ao montar seu próprio retrieval.",
    cover: p1,
    category: catBySlug("gen-ai"),
    author,
    date: "18 abr, 2026",
    readTime: "12 min",
  },
  {
    slug: "agentes-loop",
    title: "Agentes que não entram em loop infinito (quase)",
    excerpt: "Padrões simples para dar fim, memória curta e ferramentas confiáveis a um agente LLM.",
    cover: p2,
    category: catBySlug("gen-ai"),
    author,
    date: "14 abr, 2026",
    readTime: "10 min",
  },
  {
    slug: "prompt-eng-vivo",
    title: "Engenharia de prompt como organismo vivo",
    excerpt: "Versionar, testar e versionar de novo. Prompt é código — e merece o mesmo carinho.",
    cover: p3,
    category: catBySlug("gen-ai"),
    author,
    date: "07 abr, 2026",
    readTime: "8 min",
  },
  {
    slug: "embeddings-intuicao",
    title: "Embeddings com intuição (e pouca matemática)",
    excerpt: "O que realmente significa 'vetor próximo' e por que isso muda como pensamos busca.",
    cover: p4,
    category: catBySlug("gen-ai"),
    author,
    date: "31 mar, 2026",
    readTime: "6 min",
  },
  // Estudos & Roadmaps (4)
  {
    slug: "roadmap-data-2026",
    title: "Meu roadmap de Ciência de Dados em 2026",
    excerpt: "O que estou estudando, na ordem, e por quê — sem checklist genérica de internet.",
    cover: p1,
    category: catBySlug("roadmaps"),
    author,
    date: "20 abr, 2026",
    readTime: "11 min",
  },
  {
    slug: "estudar-llm-do-zero",
    title: "Como estudar LLMs do zero sem se perder",
    excerpt: "Uma trilha honesta com livros, papers e projetos — calibrada para quem trabalha durante o dia.",
    cover: p2,
    category: catBySlug("roadmaps"),
    author,
    date: "13 abr, 2026",
    readTime: "9 min",
  },
  {
    slug: "matematica-essencial-ml",
    title: "A matemática que realmente importa para ML",
    excerpt: "O subconjunto pequeno e poderoso que aparece em quase todo modelo do dia a dia.",
    cover: p3,
    category: catBySlug("roadmaps"),
    author,
    date: "05 abr, 2026",
    readTime: "10 min",
  },
  {
    slug: "rotina-estudo-noturna",
    title: "Uma rotina de estudo noturna que funciona pra mim",
    excerpt: "Blocos curtos, anotações em markdown e nada de fingir que vou ler aquele livro de 800 páginas.",
    cover: p4,
    category: catBySlug("roadmaps"),
    author,
    date: "29 mar, 2026",
    readTime: "5 min",
  },
];

export const allPosts = [featuredPost, ...recentPosts];

const categoryBody: Record<string, PostBodyTemplate> = {
  "data-science": {
    sections: [
      {
        title: "O problema que eu queria observar",
        paragraphs: [
          "A ideia deste experimento fictício era pegar um conjunto pequeno de dados, daqueles que cabem na cabeça, e resistir à tentação de transformar tudo em dashboard bonito demais. Antes de modelar, eu queria entender onde a pergunta estava mal formulada.",
          "Usei uma tabela imaginária com registros de estudos, leituras, hipóteses e resultados. O ponto não era acertar uma métrica perfeita, mas perceber onde a análise começava a contar uma história que os dados não sustentavam.",
        ],
      },
      {
        title: "O que mudou quando olhei com calma",
        paragraphs: [
          "Quando separamos os dados por contexto, alguns padrões que pareciam fortes ficaram bem menores. A maior parte da diferença vinha de grupos com comportamento muito específico, e não de uma regra geral sobre o fenômeno.",
          "Foi aí que a análise ficou interessante: menos sobre encontrar a resposta e mais sobre escrever uma pergunta que não empurrasse o resultado para onde eu já queria chegar.",
        ],
      },
      {
        title: "Como eu validaria numa versão real",
        paragraphs: [
          "Numa análise de produção, eu colocaria checagens explícitas para vazamento, estabilidade temporal e sensibilidade a outliers. Também deixaria um caderno de decisões, porque quase todo gráfico bonito tem uma sequência de escolhas invisíveis por trás.",
        ],
      },
    ],
    takeaways: [
      "A visualização deve explicar a incerteza, não esconder.",
      "Métrica isolada é convite para autoengano.",
      "O melhor gráfico costuma nascer depois da pergunta ficar mais honesta.",
    ],
    code: {
      language: "python",
      filename: "validacao_minima.py",
      value: `checks = [
    "sem vazamento temporal",
    "baseline documentado",
    "resultado estável por segmento",
]

for check in checks:
    print(f"ok: {check}")`,
    },
  },
  "gen-ai": {
    sections: [
      {
        title: "O protótipo imaginário",
        paragraphs: [
          "Neste rascunho fictício, montei um fluxo pequeno para responder perguntas usando notas pessoais como contexto. A primeira versão era propositalmente simples: quebrar textos, gerar embeddings, recuperar trechos e pedir ao modelo uma resposta com referências.",
          "A parte difícil não foi fazer funcionar uma vez. Foi fazer falhar de um jeito previsível, com logs bons o suficiente para eu entender se o problema estava na busca, no prompt ou na expectativa.",
        ],
      },
      {
        title: "Onde os agentes tropeçam",
        paragraphs: [
          "Quando o sistema tem liberdade demais, ele começa a inventar trabalho. Por isso eu gosto de limitar o espaço de ação: ferramentas pequenas, estados explícitos e uma condição de parada que pareça quase burocrática.",
          "A graça está em dar autonomia suficiente para o fluxo economizar tempo, mas não tanta a ponto de transformar cada pergunta numa aventura sem fim.",
        ],
      },
      {
        title: "O que eu mediria",
        paragraphs: [
          "Eu mediria cobertura dos documentos recuperados, taxa de resposta sem evidência e tempo até uma resposta útil. Em projetos pequenos, essas três medidas já mostram mais do que uma pontuação genérica de qualidade.",
        ],
      },
    ],
    takeaways: [
      "Recuperação boa vale mais que prompt dramático.",
      "Agente precisa de fim, memória curta e ferramentas chatas.",
      "Logs são parte do produto, não um detalhe de debug.",
    ],
    code: {
      language: "python",
      filename: "mini_rag.py",
      value: `def responder(pergunta, trechos):
    contexto = "\\n\\n".join(trechos[:4])
    return f"Pergunta: {pergunta}\\nContexto usado:\\n{contexto}"`,
    },
  },
  roadmaps: {
    sections: [
      {
        title: "A trilha que eu seguiria",
        paragraphs: [
          "Este post fictício parte de uma regra simples: roadmap bom precisa caber na vida real. Em vez de empilhar cursos, eu começaria com um projeto pequeno, uma rotina de leitura e uma lista curta de lacunas para revisar no fim da semana.",
          "A ordem importa menos do que o ciclo. Estudar, aplicar, escrever uma nota curta e repetir. Sem essa volta, o conteúdo vira coleção de links salvos.",
        ],
      },
      {
        title: "Como evitar a checklist infinita",
        paragraphs: [
          "A checklist infinita dá uma sensação ótima de controle, mas raramente produz domínio. Eu prefiro escolher um tema por vez e criar um artefato concreto: um notebook, uma explicação, uma demo ou um post.",
          "Quando o estudo termina com algo que outra pessoa poderia abrir, ler e questionar, a aprendizagem fica menos nebulosa.",
        ],
      },
      {
        title: "Critério de progresso",
        paragraphs: [
          "Meu critério fictício aqui seria simples: consigo explicar isso sem copiar a definição? Consigo usar num exemplo novo? Consigo dizer onde isso quebra? Se sim, avanço. Se não, volto um passo.",
        ],
      },
    ],
    takeaways: [
      "Roadmap bom tem ritmo, não só tópicos.",
      "Projeto pequeno vence lista enorme.",
      "Escrever é uma forma de testar entendimento.",
    ],
  },
};

const fallbackBody: PostBodyTemplate = {
  sections: [
    {
      title: "Primeiro rascunho",
      paragraphs: [
        "Este é um texto fictício para mostrar como a página de post funcionaria quando o conteúdo real entrar. A estrutura já deixa espaço para uma abertura, seções, notas e links relacionados.",
      ],
    },
    {
      title: "Próximos detalhes",
      paragraphs: [
        "Depois, cada post pode ganhar markdown, blocos de código, imagens internas e referências. Por enquanto, a página prioriza a experiência de leitura e navegação.",
      ],
    },
  ],
  takeaways: [
    "Conteúdo fictício pode validar o fluxo antes do CMS.",
    "A rota já funciona com qualquer slug cadastrado.",
    "O layout está pronto para receber posts reais.",
  ],
};

export function getPostBySlug(slug: string) {
  return allPosts.find((post) => post.slug === slug);
}

export function getRelatedPosts(post: Post) {
  return allPosts
    .filter((item) => item.slug !== post.slug && item.category.slug === post.category.slug)
    .slice(0, 3);
}

export function getPostBody(post: Post): PostBody {
  const body = categoryBody[post.category.slug] ?? fallbackBody;

  return {
    deck: `${post.excerpt} Este exemplo usa dados fictícios para mostrar o formato final de leitura dentro do jardim.`,
    sections: body.sections,
    takeaways: body.takeaways,
    code: body.code,
  };
}

export const popularPosts = [
  { slug: "rag-do-zero", title: "Construindo um RAG do zero com embeddings locais", views: "12.4k" },
  { slug: "roadmap-data-2026", title: "Meu roadmap de Ciência de Dados em 2026", views: "9.1k" },
  { slug: "jardim-digital", title: "Cultivando um jardim digital: notas em vez de posts perfeitos", views: "7.8k" },
  { slug: "clusters-bonitos", title: "Clusters bonitos não significam clusters úteis", views: "5.3k" },
];
