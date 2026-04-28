import { categories, popularPosts } from "@/lib/posts";
import { useState } from "react";
import { Sparkles } from "lucide-react";

const dotColor: Record<string, string> = {
  crimson: "bg-crimson",
  leaf: "bg-leaf",
  moss: "bg-moss",
  clay: "bg-clay",
  sand: "bg-sand",
};

export function Sidebar() {
  const [email, setEmail] = useState("");
  const [cat, setCat] = useState(categories[0].slug);
  const [done, setDone] = useState(false);

  return (
    <aside className="space-y-8">
      {/* Categorias */}
      <section className="rounded-2xl border border-border bg-card/60 p-6">
        <h3 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          Categorias
        </h3>
        <ul className="mt-4 space-y-1">
          {categories.map((c) => (
            <li key={c.slug}>
              <a
                href="#"
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground"
              >
                <span className="flex items-center gap-3">
                  <span className={`h-2 w-2 rounded-full ${dotColor[c.color]}`} />
                  {c.name}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{c.count}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* Mais lidos */}
      <section className="rounded-2xl border border-border bg-card/60 p-6">
        <h3 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          Mais lidos
        </h3>
        <ol className="mt-4 space-y-4">
          {popularPosts.map((p, i) => (
            <li key={p.slug} className="flex gap-4">
              <span className="font-display text-3xl italic leading-none text-gradient">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <a href={`/posts/${p.slug}`} className="text-sm leading-snug text-foreground hover:text-primary">
                  {p.title}
                </a>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">{p.views} leituras</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Newsletter por categoria */}
      <section className="relative overflow-hidden rounded-2xl border border-primary/30 bg-card p-6 shadow-glow">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-display text-sm uppercase tracking-widest text-primary">
              Avise-me
            </h3>
          </div>
          <p className="mt-3 font-display text-lg italic leading-snug">
            Quero saber quando sair algo novo sobre…
          </p>
          {done ? (
            <p className="mt-4 rounded-lg border border-leaf/40 bg-leaf/10 p-3 text-sm text-leaf">
              Pronto. Você está na lista 🌱
            </p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setDone(true);
              }}
              className="mt-4 space-y-3"
            >
              <select
                value={cat}
                onChange={(e) => setCat(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-input/40 px-3 text-sm focus:border-primary/60 focus:outline-none"
              >
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.name}</option>
                ))}
              </select>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="h-10 w-full rounded-lg border border-border bg-input/40 px-3 text-sm placeholder:text-muted-foreground/70 focus:border-primary/60 focus:outline-none"
              />
              <button
                type="submit"
                className="h-10 w-full rounded-lg bg-gradient-glow text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02]"
              >
                Me avisa
              </button>
            </form>
          )}
        </div>
      </section>
    </aside>
  );
}
