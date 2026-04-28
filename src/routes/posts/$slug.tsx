import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, Clock, Pencil, Tag } from "lucide-react";
import { useEffect, useState } from "react";
import { CodeBlock } from "@/components/CodeBlock";
import { DataFrameTable } from "@/components/DataFrameTable";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { PostCard } from "@/components/PostCard";
import { diagramToSvg } from "@/lib/diagram";
import { renderLatexHtml } from "@/lib/latex-render";
import { categories } from "@/lib/posts";
import { getPostBody, getPostBySlug, getRelatedPosts } from "@/lib/posts";
import {
  type PublishedBlock,
  type PublishedPost,
  getLocalPublishedPost,
  getPublishedPost,
} from "@/lib/publishing";

export const Route = createFileRoute("/posts/$slug")({
  head: ({ params }) => {
    const post = getPostBySlug(params.slug);

    return {
      meta: [
        { title: post ? `${post.title} — lure.garden` : "Post nao encontrado — lure.garden" },
        {
          name: "description",
          content: post?.excerpt ?? "Este post ainda nao existe no jardim digital.",
        },
        { property: "og:title", content: post?.title ?? "Post nao encontrado" },
        { property: "og:description", content: post?.excerpt ?? "Conteudo indisponivel." },
      ],
    };
  },
  component: PostPage,
});

function PostNotFound() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          canteiro vazio
        </p>
        <h1 className="mt-4 font-display text-5xl">Post nao encontrado</h1>
        <p className="mt-4 text-muted-foreground">
          Esse caminho ainda nao recebeu uma muda. Volte para o inicio e escolha outro post.
        </p>
        <a
          href="/"
          className="mt-8 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Voltar para home
        </a>
      </main>
      <Footer />
    </div>
  );
}

function blockColorClass(color: string) {
  const map: Record<string, string> = {
    muted: "text-muted-foreground",
    primary: "text-primary",
    leaf: "text-leaf",
    clay: "text-clay",
    sand: "text-sand",
  };

  return map[color] ?? "text-foreground/85";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function latexColor(color: string) {
  const map: Record<string, string> = {
    muted: "var(--muted-foreground)",
    primary: "var(--primary)",
    leaf: "var(--leaf)",
    clay: "var(--clay)",
    sand: "var(--sand)",
  };

  return map[color] ?? "var(--foreground)";
}

function PublishedBlockView({ block }: { block: PublishedBlock }) {
  if (block.type === "divider") {
    return <hr className="border-border/70" />;
  }

  if (block.type === "code") {
    return (
      <CodeBlock
        code={block.text}
        filename={block.filename || "snippet.txt"}
        language={block.language || "text"}
      />
    );
  }

  if (block.type === "latex") {
    return (
      <div className="lure-editor-code-widget">
        <div className="lure-editor-code-header">
          <span className="font-mono text-xs text-muted-foreground">{block.filename || "formula.tex"}</span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">latex</span>
        </div>
        <div
          className="lure-latex-render"
          style={{ color: latexColor(block.color) }}
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
        dangerouslySetInnerHTML={{ __html: block.html || block.text }}
      />
    );
  }

  if (block.type === "quote") {
    const className = `border-l-2 border-primary pl-5 font-display text-2xl italic leading-relaxed ${blockColorClass(block.color)} ${
      block.bold ? "font-semibold" : ""
    }`;

    return block.html ? (
      <blockquote className={className} dangerouslySetInnerHTML={{ __html: block.html }} />
    ) : (
      <blockquote
        className={className}
      >
        {block.text}
      </blockquote>
    );
  }

  const className = `text-base leading-8 ${blockColorClass(block.color)} ${block.bold ? "font-semibold" : ""}`;

  return block.html ? (
    <p className={className} dangerouslySetInnerHTML={{ __html: block.html }} />
  ) : (
    <p
      className={className}
    >
      {block.text}
    </p>
  );
}

function PublishedPostPage({ post }: { post: PublishedPost }) {
  const category = categories.find((item) => item.slug === post.categorySlug) ?? categories[0];

  return (
    <div className="min-h-screen">
      <Header />

      <main>
        <article>
          <section className="mx-auto max-w-5xl px-4 pb-10 pt-10 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <a
                href="/"
                className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-primary"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                voltar
              </a>
              <a
                href={`/escrever?edit=${post.slug}`}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
              >
                <Pencil className="h-3.5 w-3.5" />
                editar post
              </a>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-primary">
                <Tag className="h-3 w-3" />
                {category.name}
              </span>
              <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                {post.date}
              </span>
              <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {post.readTime} de leitura
              </span>
            </div>

            <h1 className="mt-6 max-w-4xl font-display text-5xl leading-[1.02] tracking-tight md:text-7xl">
              {post.title}
            </h1>

            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-muted-foreground md:text-xl">
              {post.excerpt}
            </p>

            <div className="mt-8 flex items-center gap-3">
              <img
                src={post.author.avatar}
                alt={post.author.name}
                className="h-11 w-11 rounded-full ring-2 ring-primary/30"
              />
              <div>
                <p className="text-sm font-medium">{post.author.name}</p>
                <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  publicado pelo editor
                </p>
              </div>
            </div>
          </section>

          {post.coverDataUrl && (
            <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                <img
                  src={post.coverDataUrl}
                  alt={post.title}
                  width={1536}
                  height={900}
                  className="aspect-[16/8] w-full object-cover"
                />
              </div>
            </section>
          )}

          <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="space-y-8">
              {post.blocks.map((block) => (
                <PublishedBlockView key={block.id} block={block} />
              ))}
            </div>
          </section>
        </article>
      </main>

      <Footer />
    </div>
  );
}

function PostPage() {
  const { slug } = Route.useParams();
  const post = getPostBySlug(slug);
  const [publishedPost, setPublishedPost] = useState<PublishedPost | null>(null);
  const [checkedPublishedPost, setCheckedPublishedPost] = useState(Boolean(post));

  useEffect(() => {
    if (post) {
      setCheckedPublishedPost(true);
      return;
    }

    let cancelled = false;
    const local = getLocalPublishedPost(slug);

    if (local) {
      setPublishedPost(local);
      setCheckedPublishedPost(true);
      return;
    }

    setCheckedPublishedPost(false);
    getPublishedPost({ data: { slug } })
      .then((serverPost) => {
        if (!cancelled) setPublishedPost(serverPost);
      })
      .finally(() => {
        if (!cancelled) setCheckedPublishedPost(true);
      });

    return () => {
      cancelled = true;
    };
  }, [post, slug]);

  if (!post && !checkedPublishedPost) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            carregando
          </p>
          <h1 className="mt-4 font-display text-5xl">Abrindo post</h1>
        </main>
      </div>
    );
  }

  if (!post && publishedPost) return <PublishedPostPage post={publishedPost} />;
  if (!post) return <PostNotFound />;

  const body = getPostBody(post);
  const relatedPosts = getRelatedPosts(post);

  return (
    <div className="min-h-screen">
      <Header />

      <main>
        <article>
          <section className="mx-auto max-w-5xl px-4 pb-10 pt-10 sm:px-6 lg:px-8">
            <a
              href="/"
              className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-primary"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              voltar
            </a>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-primary">
                <Tag className="h-3 w-3" />
                {post.category.name}
              </span>
              <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                {post.date}
              </span>
              <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {post.readTime} de leitura
              </span>
            </div>

            <h1 className="mt-6 max-w-4xl font-display text-5xl leading-[1.02] tracking-tight md:text-7xl">
              {post.title}
            </h1>

            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-muted-foreground md:text-xl">
              {body.deck}
            </p>

            <div className="mt-8 flex items-center gap-3">
              <img
                src={post.author.avatar}
                alt={post.author.name}
                className="h-11 w-11 rounded-full ring-2 ring-primary/30"
              />
              <div>
                <p className="text-sm font-medium">{post.author.name}</p>
                <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  rascunho ficticio
                </p>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
              <img
                src={post.cover}
                alt={post.title}
                width={1536}
                height={900}
                className="aspect-[16/8] w-full object-cover"
              />
            </div>
          </section>

          <section className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_280px] lg:px-8">
            <div className="max-w-3xl">
              {body.sections.map((section) => (
                <section key={section.title} className="mb-12">
                  <h2 className="font-display text-3xl leading-tight">
                    {section.title}
                  </h2>
                  <div className="mt-5 space-y-5 text-base leading-8 text-foreground/85">
                    {section.paragraphs.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                </section>
              ))}

              {body.code && (
                <div className="mb-12">
                  <CodeBlock
                    code={body.code.value}
                    filename={body.code.filename}
                    language={body.code.language}
                  />
                </div>
              )}
            </div>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-2xl border border-border bg-card/70 p-6">
                <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
                  notas da leitura
                </h2>
                <ul className="mt-5 space-y-4">
                  {body.takeaways.map((item) => (
                    <li key={item} className="flex gap-3 text-sm leading-relaxed text-foreground/85">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </section>
        </article>

        {relatedPosts.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
            <div className="mb-8">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                no mesmo canteiro
              </p>
              <h2 className="mt-2 font-display text-3xl">Leia tambem</h2>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {relatedPosts.map((item) => (
                <PostCard key={item.slug} post={item} />
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
