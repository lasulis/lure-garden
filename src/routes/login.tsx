import { createFileRoute } from "@tanstack/react-router";
import { LockKeyhole } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { useAdminSession } from "@/hooks/use-admin-session";
import { checkAdminSession } from "@/lib/publishing";
import { supabase } from "@/lib/supabase-client";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login admin — lure.garden" },
      { name: "description", content: "Area restrita de administracao do lure.garden." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { isAdmin, isLoading, refresh } = useAdminSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && isAdmin && typeof window !== "undefined") {
      const redirect = new URLSearchParams(window.location.search).get("redirect") || "/admin";
      window.location.href = redirect.startsWith("/") ? redirect : "/admin";
    }
  }, [isAdmin, isLoading]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("");

    if (!supabase) {
      setStatus("Supabase Auth nao esta configurado neste ambiente.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const token = data.session?.access_token;
      if (!token) throw new Error("Nao consegui criar uma sessao.");

      await checkAdminSession({ data: { adminToken: token } });
      await refresh();

      const redirect = new URLSearchParams(window.location.search).get("redirect") || "/admin";
      window.location.href = redirect.startsWith("/") ? redirect : "/admin";
    } catch (error) {
      await supabase.auth.signOut();
      setStatus(error instanceof Error ? error.message : "Nao consegui fazer login.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-4 py-16">
        <div className="rounded-2xl border border-border bg-card/70 p-6 shadow-card">
          <div className="mb-6 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <LockKeyhole className="h-5 w-5" />
            </span>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">area restrita</p>
              <h1 className="font-display text-3xl italic">Login admin</h1>
            </div>
          </div>

          <form className="space-y-4" onSubmit={submit}>
            <label className="block">
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 h-11 w-full rounded-lg border border-border bg-input/40 px-3 text-sm outline-none focus:border-primary/60"
                autoComplete="email"
                required
              />
            </label>

            <label className="block">
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Senha</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 h-11 w-full rounded-lg border border-border bg-input/40 px-3 text-sm outline-none focus:border-primary/60"
                autoComplete="current-password"
                required
              />
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="h-11 w-full rounded-lg bg-gradient-glow text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Entrando..." : "Entrar"}
            </button>
          </form>

          {status && (
            <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {status}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

