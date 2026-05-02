import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { FeaturedPost } from "@/components/FeaturedPost";
import { PostCard } from "@/components/PostCard";
import { Sidebar } from "@/components/Sidebar";
import { CodeBlock } from "@/components/CodeBlock";
import { featuredPost, recentPosts, categories, type Post } from "@/lib/posts";
import { loadPublishedPosts } from "@/lib/publishing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "lure.garden — um jardim digital de Luiza Reixach Castro" },
      {
        name: "description",
        content:
          "Blog pessoal da Luiza (Lure) — Junior Data Scientist. Um espaço para registrar estudos sobre dados, IA generativa, engenharia e falar coisas aleatórias.",
      },
      { property: "og:title", content: "lure.garden — um jardim digital" },
      {
        property: "og:description",
        content: "Estudos, ideias em crescimento e coisas aleatórias.",
      },
    ],
  }),
  component: HomePage,
});

const sampleCode = `# rag mínimo, sem libs pesadas
import numpy as np

def cosine(a, b):
    return (a @ b) / (np.linalg.norm(a) * np.linalg.norm(b))

def search(query_vec, corpus_vecs, k=3):
    scores = [cosine(query_vec, v) for v in corpus_vecs]
    return np.argsort(scores)[-k:][::-1]

# o resto é só… engenharia de prompt e paciência`;

const catColorMap: Record<string, { chip: string; ring: string; glow: string; dot: string }> = {
  crimson: { chip: "bg-crimson/15 text-crimson", ring: "group-hover:border-crimson/50", glow: "from-crimson/20", dot: "bg-crimson" },
  leaf: { chip: "bg-leaf/15 text-leaf", ring: "group-hover:border-leaf/50", glow: "from-leaf/20", dot: "bg-leaf" },
  moss: { chip: "bg-moss/20 text-moss", ring: "group-hover:border-moss/50", glow: "from-moss/20", dot: "bg-moss" },
  clay: { chip: "bg-clay/15 text-clay", ring: "group-hover:border-clay/50", glow: "from-clay/20", dot: "bg-clay" },
  sand: { chip: "bg-sand/15 text-sand", ring: "group-hover:border-sand/50", glow: "from-sand/20", dot: "bg-sand" },
};

function HomePage() {
  const [publishedPosts, setPublishedPosts] = useState<Post[]>([]);
  const visiblePosts = [...publishedPosts, ...recentPosts];

  useEffect(() => {
    let isMounted = true;

    loadPublishedPosts().then((posts) => {
      if (isMounted) setPublishedPosts(posts);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen overflow-x-clip">
      <Header />

      {/* Hero — composição tipográfica estilo referência */}
      <section className="relative bg-hero-glow grain">
        <div className="mx-auto max-w-7xl px-4 pb-8 pt-3 sm:px-6 sm:pb-20 sm:pt-16 lg:px-8">
          <div className="mb-3 flex items-center justify-between text-muted-foreground sm:mb-10">
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-leaf" />
              <span className="font-mono text-xs uppercase tracking-[0.2em]">
                digital garden · v.026
              </span>
            </div>
            <span className="hidden font-mono text-xs text-muted-foreground/60 md:block">
              23.6 · brotando agora
            </span>
          </div>

          {/* Nome em destaque */}
          <div className="relative">
            <div className="overflow-visible pb-1 pt-0 sm:pt-4">
              {/* Mobile: viewBox apertado para encostar o L no topo */}
              <svg
                aria-hidden="true"
                className="-ml-[2.75rem] block h-auto w-[22rem] max-w-[calc(100%+2.75rem)] overflow-visible sm:hidden"
                overflow="visible"
                viewBox="-92 -42 740 245"
              >
                <defs>
                  <linearGradient id="lure-wordmark-gradient-mobile" x1="0" x2="1" y1="0.5" y2="0.5">
                    <stop offset="0%" stopColor="var(--wordmark-from)" />
                    <stop offset="45%" stopColor="var(--wordmark-mid)" />
                    <stop offset="100%" stopColor="var(--wordmark-to)" />
                  </linearGradient>
                </defs>
                <text
                  className="font-script"
                  fill="url(#lure-wordmark-gradient-mobile)"
                  fontSize="196"
                  x="0"
                  y="126"
                >
                  {"L\u00A0\u00A0\u00A0\u00A0"}
                </text>
                <text
                  className="font-display"
                  fill="url(#lure-wordmark-gradient-mobile)"
                  fontSize="128"
                  fontStyle="italic"
                  x="148"
                  y="122"
                >
                  ure
                </text>
              </svg>
              {/* Desktop: viewBox original */}
              <svg
                aria-hidden="true"
                className="hidden h-auto overflow-visible sm:-ml-[4.5rem] sm:block sm:w-[33rem] sm:max-w-[calc(100%+4.5rem)] md:-ml-[5.25rem] md:w-[38rem] md:max-w-[calc(100%+5.25rem)]"
                overflow="visible"
                viewBox="-92 -140 740 340"
              >
                <defs>
                  <linearGradient id="lure-wordmark-gradient" x1="0" x2="1" y1="0.5" y2="0.5">
                    <stop offset="0%" stopColor="var(--wordmark-from)" />
                    <stop offset="45%" stopColor="var(--wordmark-mid)" />
                    <stop offset="100%" stopColor="var(--wordmark-to)" />
                  </linearGradient>
                </defs>
                <text
                  className="font-script"
                  fill="url(#lure-wordmark-gradient)"
                  fontSize="196"
                  x="0"
                  y="126"
                >
                  {"L\u00A0\u00A0\u00A0\u00A0"}
                </text>
                <text
                  className="font-display"
                  fill="url(#lure-wordmark-gradient)"
                  fontSize="128"
                  fontStyle="italic"
                  x="148"
                  y="122"
                >
                  ure
                </text>
              </svg>
              <span className="sr-only">Lure</span>
            </div>
            <p className="-mt-8 font-sans text-lg font-medium tracking-[0.25em] text-foreground sm:-mt-10 sm:text-xl md:-mt-12">
              LUIZA REIXACH CASTRO
            </p>
            <p className="mt-2 font-mono text-xs uppercase tracking-[0.3em] text-crimson">
              junior data scientist
            </p>
          </div>

          <div className="mt-3 max-w-2xl sm:mt-10">
            <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
              Um <em className="font-display italic text-foreground/90">jardim digital</em> para
              registrar meus estudos — ciência de dados, IA generativa — e falar coisas
              aleatórias quando der vontade.
            </p>
          </div>
        </div>
      </section>

      {/* Featured */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FeaturedPost post={featuredPost} />
      </section>

      {/* Grid + Sidebar */}
      <section className="mx-auto mt-20 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0">
            <div className="mb-8 flex items-end justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  brotando agora
                </p>
                <h2 className="mt-2 font-display text-3xl">
                  Posts <em className="italic text-muted-foreground">recentes</em>
                </h2>
              </div>
              <a href="#" className="hidden text-sm text-muted-foreground hover:text-primary md:block">
                ver todos →
              </a>
            </div>

            <div className="space-y-14">
              {(() => {
                const groups = new Map<string, Post[]>();
                for (const p of visiblePosts) {
                  const k = p.category.slug;
                  if (!groups.has(k)) groups.set(k, []);
                  groups.get(k)!.push(p);
                }
                return Array.from(groups.entries()).map(([slug, posts]) => {
                  const cat = posts[0].category;
                  return (
                    <div key={slug}>
                      <div className="mb-3 flex min-w-0 items-end justify-between gap-4 sm:mb-5">
                        <div className="flex min-w-0 flex-wrap items-center gap-3">
                          <span className={`h-2 w-2 rounded-full ${catColorMap[cat.color]?.dot ?? "bg-foreground"}`} />
                          <h3 className="min-w-0 break-words font-display text-base italic sm:text-2xl">{cat.name}</h3>
                          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground sm:text-[11px]">
                            {posts.length} {posts.length === 1 ? "post" : "posts"}
                          </span>
                        </div>
                        <a href="#" className="hidden text-xs text-muted-foreground hover:text-primary md:block">
                          ver todos →
                        </a>
                      </div>
                      <div className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3">
                        {posts.map((p) => (
                          <PostCard key={p.slug} post={p} />
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Code preview from a post */}
            <div className="mt-16">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                trecho do post
              </p>
              <h3 className="mt-2 font-display text-2xl italic">
                “quando o código também é parte do parágrafo”
              </h3>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Aqui no jardim, todo post pode ter blocos de Python embutidos — copiáveis,
                respiráveis, com cara de coisa viva.
              </p>
              <div className="mt-6">
                <CodeBlock code={sampleCode} language="python" filename="rag_minimo.py" />
              </div>
            </div>
          </div>

          <Sidebar />
        </div>
      </section>

      {/* Categorias */}
      <section className="mx-auto mt-28 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              canteiros do jardim
            </p>
            <h2 className="mt-2 font-display text-3xl">
              Por <em className="italic text-gradient">categoria</em>
            </h2>
          </div>
          <a href="/categorias" className="hidden text-sm text-muted-foreground hover:text-primary md:block">
            todas →
          </a>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => {
            const c2 = catColorMap[c.color];
            const Icon = c.icon;
            const totalPosts = c.count + publishedPosts.filter((post) => post.category.slug === c.slug).length;
            return (
              <a
                key={c.slug}
                href={`/categorias#${c.slug}`}
                className={`group relative overflow-hidden rounded-2xl border border-border bg-card/60 p-6 transition-all hover:-translate-y-1 hover:shadow-glow ${c2.ring}`}
              >
                <div className={`pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br ${c2.glow} to-transparent blur-2xl`} />
                <div className="relative flex items-center justify-between">
                  <span className={`grid h-12 w-12 place-items-center rounded-xl ${c2.chip}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                    {totalPosts} posts
                  </span>
                </div>
                <h3 className="relative mt-5 font-display text-2xl group-hover:text-primary">
                  {c.name}
                </h3>
                <p className="relative mt-2 text-sm text-muted-foreground">{c.description}</p>
              </a>
            );
          })}
        </div>
      </section>

      <Footer />
    </div>
  );
}
