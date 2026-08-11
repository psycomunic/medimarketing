import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Award } from "lucide-react";
import { Logo } from "@/components/logo";
import { exigirModulo } from "@/lib/acesso";
import {
  getAulasConcluidas,
  getDataConclusao,
  getTrilha,
} from "@/lib/supabase/academy";
import { rotuloPapel } from "@/lib/rbac";

export const metadata = { title: "Certificado" };

export default async function CertificadoPage({
  params,
}: {
  params: { slug: string };
}) {
  const { profile, organizacao } = await exigirModulo("academy");
  const trilha = await getTrilha(params.slug);
  if (!trilha) notFound();

  const publicadas = trilha.aulas.filter((a) => a.publicado);
  const concluidas = await getAulasConcluidas(profile.id);
  const feitas = publicadas.filter((a) => concluidas.has(a.id));

  // Sem trilha completa não há certificado
  if (!publicadas.length || feitas.length < publicadas.length) {
    redirect(`/app/academy/${params.slug}`);
  }

  const horas = Math.max(
    1,
    Math.round(publicadas.reduce((s, a) => s + (a.duracao_min ?? 0), 0) / 60)
  );
  const dataIso = await getDataConclusao(
    profile.id,
    publicadas.map((a) => a.id)
  );
  const conclusao = new Date(dataIso ?? Date.now()).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 md:px-8 md:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/app/academy/${params.slug}`}
          className="inline-flex items-center gap-1.5 text-sm text-cinza-suave transition-colors hover:text-teal"
        >
          <ArrowLeft className="size-4" /> Voltar à trilha
        </Link>
        {/* Impressão em PDF fica por conta do próprio navegador */}
        <p className="text-sm text-cinza-suave">
          Use <strong className="text-azul-medico">Ctrl + P</strong> para salvar
          em PDF ou imprimir.
        </p>
      </div>

      <article className="mt-6 overflow-hidden rounded-2xl border-4 border-teal/30 bg-white p-10 text-center shadow-card md:p-14">
        <div className="flex justify-center">
          <Logo href="/app" />
        </div>

        <Award className="mx-auto mt-8 size-14 text-teal" />

        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-cinza-suave">
          Certificado de conclusão
        </p>

        <p className="mt-8 text-cinza-suave">Certificamos que</p>
        <p className="mt-2 font-heading text-3xl font-bold text-azul-medico md:text-4xl">
          {profile.nome ?? "Aluno(a)"}
        </p>
        {organizacao && (
          <p className="mt-1 text-sm text-cinza-suave">
            {rotuloPapel(profile.role)} · {organizacao.nome}
          </p>
        )}

        <p className="mx-auto mt-8 max-w-lg leading-relaxed text-cinza-suave">
          concluiu a trilha{" "}
          <strong className="text-azul-medico">{trilha.curso.titulo}</strong> da
          Medi Academy, com {publicadas.length} aulas e carga horária aproximada
          de {horas} {horas === 1 ? "hora" : "horas"}.
        </p>

        <div className="mt-12 flex flex-col items-center gap-1">
          <div className="h-px w-56 bg-border" />
          <p className="mt-2 text-sm font-semibold text-azul-medico">
            Medi Marketing
          </p>
          <p className="text-xs text-cinza-suave">Concluído em {conclusao}</p>
        </div>
      </article>
    </div>
  );
}
