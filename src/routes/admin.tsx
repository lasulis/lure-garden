import { createFileRoute } from "@tanstack/react-router";
import { Edit3, FilePlus2, LogOut, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { useAdminSession } from "@/hooks/use-admin-session";
import { deletePublishedPost, loadPublishedPosts, removeLocalPublishedPost } from "@/lib/publishing";
import type { Post } from "@/lib/posts";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — lure.garden" },
      { name: "description", content: "Painel administrativo do lure.garden." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { accessToken, admin, isAdmin, isLoading, signOut } = useAdminSession();
  const [posts, setPosts] = useState<Post[]>([]);
  const [status, setStatus] = useState("");

  const refreshPosts = () => {
    loadPublishedPosts()
      .then(setPosts)
      .catch(() => setPosts([]));
  };

  useEffect(() => {
    if (isAdmin) refreshPosts();
  }, [isAdmin]);

  const removePost = async (post: Post) => {
    if (!window.confirm(`Apagar "${post.title}"?`)) return;

    setStatus("Apagando post...");

    try {
      await deletePublishedPost({ data: { slug: post.slug, adminToken: accessToken } });
      removeLocalPublishedPost(post.slug);
      setStatus("Post apagado.");
      refreshPosts();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Nao consegui apagar.");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="mx-auto max-w-5xl px-4 py-16 text-muted-foreground">Verificando acesso...</main>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="mx-auto max-w-xl px-4 py-16">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">area restrita</p>
          <h1 className="mt-3 font-display text-5xl italic">Admin</h1>
          <p className="mt-4 text-muted-foreground">Entre com sua conta de administradora para acessar este painel.</p>
          <a
            href="/login?redirect=/admin"
            className="mt-8 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Fazer login
          </a>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 border-b border-border pb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              logada como {admin?.email}
            </p>
            <h1 className="mt-3 font-display text-5xl italic">Painel admin</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href="/escrever"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-gradient-glow px-4 text-sm font-medium text-primary-foreground"
            >
              <FilePlus2 className="h-4 w-4" />
              Novo post
            </a>
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </div>

        {status && (
          <p className="mt-6 rounded-xl border border-border bg-card/70 px-4 py-3 text-sm text-muted-foreground">
            {status}
          </p>
        )}

        <section className="mt-10">
          <div className="mb-5 flex items-baseline justify-between">
            <h2 className="font-display text-3xl">Posts publicados</h2>
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              {posts.length} {posts.length === 1 ? "post" : "posts"}
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card/50">
            {posts.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">Nenhum post publicado ainda.</p>
            ) : (
              posts.map((post) => (
                <div
                  key={post.slug}
                  className="flex flex-col gap-3 border-b border-border/60 p-4 last:border-b-0 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-display text-xl leading-snug">{post.title}</p>
                    <p className="mt-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                      {post.category.name} · {post.date} · {post.readTime}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <a
                      href={`/escrever?edit=${post.slug}`}
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm text-muted-foreground hover:text-primary"
                    >
                      <Edit3 className="h-4 w-4" />
                      Editar
                    </a>
                    <button
                      type="button"
                      onClick={() => void removePost(post)}
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-destructive/30 px-3 text-sm text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                      Apagar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
