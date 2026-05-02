import type { Post } from "@/lib/posts";

const colorMap: Record<string, string> = {
  crimson: "bg-crimson/15 text-crimson border-crimson/30",
  leaf: "bg-leaf/15 text-leaf border-leaf/30",
  moss: "bg-moss/20 text-moss border-moss/30",
  clay: "bg-clay/15 text-clay border-clay/30",
  sand: "bg-sand/15 text-sand border-sand/30",
};

export function PostCard({ post }: { post: Post }) {
  return (
    <article className="group relative flex min-w-0 w-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-glow">
      <a href={`/posts/${post.slug}`} className="flex h-full min-w-0 flex-col">
        <div className="relative aspect-[16/5] w-full overflow-hidden sm:aspect-[16/10]">
          <img
            src={post.cover}
            alt={post.title}
            loading="lazy"
            width={1024}
            height={768}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
          <span
            className={`absolute left-4 top-4 max-w-[calc(100%-2rem)] rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-widest backdrop-blur-md ${colorMap[post.category.color]}`}
          >
            {post.category.name}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3.5 sm:gap-3 sm:p-6">
          <h3 className="min-w-0 break-words font-display text-base leading-snug text-foreground transition-colors group-hover:text-primary sm:text-xl">
            {post.title}
          </h3>
          <p className="min-w-0 break-words text-[13px] leading-relaxed text-muted-foreground sm:text-sm">
            {post.excerpt}
          </p>

          <div className="mt-auto flex min-w-0 flex-col gap-1.5 border-t border-border/60 pt-2.5 sm:flex-row sm:items-center sm:justify-between sm:pt-4">
            <div className="hidden items-center gap-2 sm:flex">
              <img src={post.author.avatar} alt={post.author.name} className="h-5 w-5 rounded-full sm:h-7 sm:w-7" />
              <span className="text-[10px] text-muted-foreground sm:text-xs">{post.author.name}</span>
            </div>
            <span className="min-w-0 break-words font-mono text-[10px] leading-relaxed text-muted-foreground sm:text-[11px]">
              {post.date} · {post.readTime}
            </span>
          </div>
        </div>
      </a>
    </article>
  );
}
