import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { categories, recentPosts, type Post } from "@/lib/posts";
import { loadPublishedPosts } from "@/lib/publishing";

export const Route = createFileRoute("/categorias")({
  head: () => ({
    meta: [
      { title: "Categorias — lure.garden" },
      { name: "description", content: "Explore as categorias do jardim digital: IA, dados, engenharia e mais." },
      { property: "og:title", content: "Categorias — lure.garden" },
      { property: "og:description", content: "Tudo que cresce neste jardim, organizado por tema." },
    ],
  }),
  component: CategoriasPage,
});

const dotMap: Record<string, string> = {
  crimson: "bg-crimson",
  leaf: "bg-leaf",
  moss: "bg-moss",
  clay: "bg-clay",
  sand: "bg-sand",
};

const MAX_VISIBLE = 15;

function CategoryColumn({ slug, name, color, posts }: { slug: string; name: string; color: string; posts: Post[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? posts : posts.slice(0, MAX_VISIBLE);
  const hasMore = posts.length > MAX_VISIBLE;

  return (
    <div id={slug}>
      <div className="mb-5 flex items-baseline gap-3">
        <span className={`h-2 w-2 rounded-full ${dotMap[color] ?? "bg-foreground"}`} />
        <h2 className="font-display text-2xl italic">{name}</h2>
        <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          {posts.length} {posts.length === 1 ? "post" : "posts"}
        </span>
      </div>

      {visible.length > 0 ? (
        <ul className="flex flex-col">
          {visible.map((p) => (
            <li key={p.slug}>
              <a
                href={`/posts/${p.slug}`}
                className="group flex items-baseline gap-3 border-b border-border/30 py-3 transition-colors hover:border-border"
              >
                <span className={`mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${dotMap[color] ?? "bg-foreground"}`} />
                <span className="flex-1 font-sans text-sm leading-snug text-foreground/90 group-hover:text-primary">
                  {p.title}
                </span>
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
                  {p.date}
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <div className="border-b border-border/30 py-3 text-sm text-muted-foreground">
          Nenhum post publicado nessa categoria ainda.
        </div>
      )}

      {hasMore && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-4 font-mono text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-primary"
        >
          {expanded ? "← mostrar menos" : `mostrar mais (${posts.length - MAX_VISIBLE}) →`}
        </button>
      )}
    </div>
  );
}

function CategoriasPage() {
  const [publishedPosts, setPublishedPosts] = useState<Post[]>([]);
  const visiblePosts = [...publishedPosts, ...recentPosts];

  useEffect(() => {
    let isMounted = true;

    const refreshPublishedPosts = () => loadPublishedPosts().then((posts) => {
      if (isMounted) setPublishedPosts(posts);
    });

    refreshPublishedPosts();
    window.addEventListener("focus", refreshPublishedPosts);
    window.addEventListener("storage", refreshPublishedPosts);

    return () => {
      isMounted = false;
      window.removeEventListener("focus", refreshPublishedPosts);
      window.removeEventListener("storage", refreshPublishedPosts);
    };
  }, []);

  const grouped = categories
    .map((c) => ({
      ...c,
      posts: visiblePosts.filter((p) => p.category.slug === c.slug),
    }));

  return (
    <div className="min-h-screen">
      <Header />
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          índice do jardim
        </p>
        <h1 className="mt-3 font-display text-5xl leading-tight md:text-6xl">
          <em className="italic text-gradient">Categorias</em>
        </h1>
        <p className="mt-4 max-w-xl text-muted-foreground">
          Cada canteiro tem seu próprio ritmo de florescer.
        </p>

        <div className="mt-14 grid gap-x-12 gap-y-16 md:grid-cols-2">
          {grouped.map((c) => (
            <CategoryColumn key={c.slug} slug={c.slug} name={c.name} color={c.color} posts={c.posts} />
          ))}
        </div>
      </section>
      <Footer />
    </div>
  );
}
