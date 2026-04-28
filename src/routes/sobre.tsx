import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre — lure.garden" },
      { name: "description", content: "Quem cuida deste jardim digital de notas sobre dados, IA e engenharia." },
      { property: "og:title", content: "Sobre — lure.garden" },
      { property: "og:description", content: "Sobre Luiza e o porquê de um blog em formato de jardim." },
    ],
  }),
  component: SobrePage,
});

function SobrePage() {
  return (
    <div className="min-h-screen">
      <Header />
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          sobre
        </p>
        <h1 className="mt-3 font-display text-5xl leading-tight md:text-6xl">
          Oi, eu sou <em className="italic text-gradient">Lure</em>.
        </h1>
        <div className="prose prose-invert mt-8 space-y-6 text-lg leading-relaxed text-foreground/85">
          <p>
            Luiza Reixach Castro — Junior Data Scientist. Aprendo melhor quando consigo
            <em className="font-display italic"> explicar para alguém</em>, e este blog é a
            tentativa de fazer isso em público.
          </p>
          <p>
            Aqui você encontra anotações sobre IA generativa, modelos de RAG, experimentos com
            embeddings, truques de pandas, divagações sobre hardware — e, de vez em quando, um
            post aleatório sobre um livro, um café, ou uma planta.
          </p>
          <p className="font-display text-xl italic text-muted-foreground">
            “Um jardim digital não tem fim. Ele só muda de estação.”
          </p>
        </div>
      </section>
      <Footer />
    </div>
  );
}
