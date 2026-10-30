import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { exigirModulo } from "@/lib/acesso";
import { getSegmentos } from "@/lib/supabase/followup";
import { getPrecos } from "@/lib/supabase/financeiro-dados";
import { NovoDisparo } from "@/components/app/disparos/novo-disparo";

export const metadata = { title: "Novo disparo" };

const CHAVES = ["busca", "situacao", "convenio", "profissional", "tag", "servico"] as const;

export default async function NovoDisparoPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const { organizacao } = await exigirModulo("disparos");
  const [segmentos, precos] = await Promise.all([getSegmentos(), getPrecos(organizacao?.id ?? null).catch(() => [])]);
  // Vindo da lista de pacientes com um filtro aberto
  const filtros = Object.fromEntries(CHAVES.filter((k) => searchParams[k]).map((k) => [k, String(searchParams[k])]));

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-8 sm:px-5 md:px-8 md:py-10">
      <Link href="/app/disparos" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-cinza-suave hover:text-azul-medico">
        <ArrowLeft className="size-4" /> Disparos
      </Link>
      <header>
        <h1 className="text-2xl md:text-3xl">Novo disparo</h1>
        <p className="mt-1 text-cinza-suave">Escolha quem recebe, escreva a mensagem e o sistema envia aos poucos, no horário comercial.</p>
      </header>
      <NovoDisparo
        segmentos={segmentos}
        filtrosIniciais={Object.keys(filtros).length ? filtros : null}
        clinica={organizacao?.nome ?? "Clínica"}
        nomesServicos={Object.fromEntries(precos.map((p) => [p.id, p.procedimento]))}
      />
    </div>
  );
}
