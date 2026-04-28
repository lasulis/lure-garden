import { Link } from "@tanstack/react-router";
import { Github, Twitter, Linkedin, Rss, Mail, Heart } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border/60 bg-card/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-glow text-primary-foreground">
              <Heart className="h-4 w-4" fill="currentColor" />
            </span>
            <span className="font-display text-xl">
              lure<span className="italic text-muted-foreground">.garden</span>
            </span>
          </div>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
            Um <em className="font-display italic text-foreground/80">jardim digital</em> da Luiza —
            registro de estudos sobre dados, IA generativa, engenharia, e algumas coisas aleatórias
            que ainda estão crescendo.
          </p>
        </div>

        <div>
          <h4 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
            Explorar
          </h4>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link to="/" className="hover:text-primary">Últimos posts</Link></li>
            <li><Link to="/categorias" className="hover:text-primary">Categorias</Link></li>
            <li><Link to="/sobre" className="hover:text-primary">Sobre mim</Link></li>
            <li><a href="#" className="hover:text-primary">RSS</a></li>
          </ul>
        </div>

        <div>
          <h4 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
            Encontre-me
          </h4>
          <div className="mt-4 flex gap-2">
            {[
              { i: Github, label: "GitHub" },
              { i: Twitter, label: "Twitter" },
              { i: Linkedin, label: "LinkedIn" },
              { i: Rss, label: "RSS" },
              { i: Mail, label: "Email" },
            ].map(({ i: Icon, label }) => (
              <a
                key={label}
                href="#"
                aria-label={label}
                className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-secondary/40 text-muted-foreground transition-all hover:border-primary/50 hover:text-primary"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
          <p className="mt-6 font-mono text-xs text-muted-foreground">
            © {new Date().getFullYear()} — feito com café frio.
          </p>
        </div>
      </div>
    </footer>
  );
}
