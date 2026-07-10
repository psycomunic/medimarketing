import Link from "next/link";
import { Mail, MessageCircle, Instagram, MapPin } from "lucide-react";
import { Logo } from "@/components/logo";
import { navLinks, site } from "@/lib/site";
import { whatsappLink } from "@/lib/utils";

export function Footer() {
  const zap = whatsappLink(site.whatsapp, "Olá! Vim pelo site da Medi Marketing.");

  return (
    <footer className="bg-azul-profundo text-white/80">
      <div className="container grid gap-10 py-16 md:grid-cols-2 lg:grid-cols-4">
        {/* Marca */}
        <div className="lg:col-span-1">
          <Logo href="/" light />
          <p className="mt-4 max-w-xs text-sm text-white/60">
            Atendimento e marketing para médicos e clínicas. Você cuida da
            medicina, a gente cuida do resto.
          </p>
        </div>

        {/* Navegação */}
        <div>
          <h4 className="font-heading text-sm font-semibold uppercase tracking-wide text-white">
            Navegação
          </h4>
          <ul className="mt-4 space-y-2.5 text-sm">
            {navLinks.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="transition-colors hover:text-teal-claro">
                  {l.label}
                </a>
              </li>
            ))}
            <li>
              <Link href="/login" className="transition-colors hover:text-teal-claro">
                Área do Médico
              </Link>
            </li>
          </ul>
        </div>

        {/* Contato */}
        <div>
          <h4 className="font-heading text-sm font-semibold uppercase tracking-wide text-white">
            Contato
          </h4>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <a
                href={zap}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 transition-colors hover:text-teal-claro"
              >
                <MessageCircle className="size-4" /> WhatsApp
              </a>
            </li>
            <li>
              <a
                href={`mailto:${site.email}`}
                className="flex items-center gap-2 transition-colors hover:text-teal-claro"
              >
                <Mail className="size-4" /> {site.email}
              </a>
            </li>
            <li>
              <a
                href={site.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 transition-colors hover:text-teal-claro"
              >
                <Instagram className="size-4" /> Instagram
              </a>
            </li>
          </ul>
        </div>

        {/* Institucional */}
        <div>
          <h4 className="font-heading text-sm font-semibold uppercase tracking-wide text-white">
            Institucional
          </h4>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              {/* TODO: criar página de política de privacidade */}
              <Link href="/privacidade" className="transition-colors hover:text-teal-claro">
                Política de Privacidade
              </Link>
            </li>
            <li className="flex items-start gap-2 text-white/60">
              <MapPin className="mt-0.5 size-4 shrink-0" />
              {/* TODO: CNPJ e endereço reais */}
              CNPJ {site.cnpj}
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container flex flex-col items-center justify-between gap-2 py-6 text-xs text-white/50 sm:flex-row">
          <p>
            © {/* ano fixo p/ evitar hidratação; ajuste conforme necessário */}
            2025 {site.nome}. Todos os direitos reservados.
          </p>
          <p>Publicidade médica em conformidade com o CFM.</p>
        </div>
      </div>
    </footer>
  );
}
