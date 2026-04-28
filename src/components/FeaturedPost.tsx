import { ArrowUpRight } from "lucide-react";
import type { Post } from "@/lib/posts";

export function FeaturedPost({ post }: { post: Post }) {
  const postHref = `/posts/${post.slug}`;

  return (
    <article className="group relative overflow-hidden rounded-3xl border border-border bg-card shadow-card">
      <div className="grid lg:grid-cols-5">
        <div className="relative lg:col-span-3">
          <a href={postHref} className="block aspect-[16/3] sm:aspect-[16/10] lg:aspect-auto lg:h-full">
            <img
              src={post.cover}
              alt={post.title}
              width={1536}
              height={1024}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            />
          </a>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-background/80 via-background/20 to-transparent lg:bg-gradient-to-r" />
        </div>

        <div className="relative flex flex-col justify-between gap-4 p-4 sm:gap-8 sm:p-8 lg:col-span-2 lg:p-12">
          <div>
            <div className="flex items-center gap-3">
              <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-primary">
                Em destaque
              </span>
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                {post.category.name}
              </span>
            </div>

            <h1 className="mt-3 font-display text-base leading-[1.15] tracking-tight sm:mt-6 sm:text-4xl sm:leading-[1.05] md:text-5xl">
              <a href={postHref} className="transition-colors hover:text-primary">
                Cultivando um <em className="italic text-gradient">jardim digital</em>: notas em vez de posts perfeitos
              </a>
            </h1>

            <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted-foreground sm:mt-5 sm:text-base">
              {post.excerpt}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={post.author.avatar} alt={post.author.name} className="h-10 w-10 rounded-full ring-2 ring-primary/40" />
              <div>
                <p className="hidden text-sm font-medium sm:block">{post.author.name}</p>
                <p className="font-mono text-[11px] text-muted-foreground">
                  {post.date} · {post.readTime} de leitura
                </p>
              </div>
            </div>
            <a
              href={postHref}
              className="grid h-12 w-12 place-items-center rounded-full bg-gradient-glow text-primary-foreground transition-transform group-hover:rotate-45"
              aria-label="Ler post em destaque"
            >
              <ArrowUpRight className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
