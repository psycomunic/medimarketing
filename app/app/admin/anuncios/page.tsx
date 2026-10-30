import { Info, Megaphone, Plug } from "lucide-react";
import { exigirModulo } from "@/lib/acesso";
import { emModoDemo } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";
import { getClinicasDisponiveis } from "@/lib/supabase/usuarios";
import { listarContasMeta, metaConfigurado, type ContaMeta } from "@/lib/marketing/meta-api";
import { ContasAnuncio, type LinhaConta } from "@/components/app/admin/contas-anuncio";
import { Painel } from "@/components/app/financeiro/ui";
import type { ContaAnuncio } from "@/lib/supabase/types";

export const metadata = { title: "Contas de anúncio" };

/**
 * Conexão de mídia da Medi Marketing: a BM principal enxerga as contas de
 * anúncio dos clientes; aqui cada conta é ligada à clínica dona dela.
 */
export default async function AdminAnunciosPage() {
  await exigirModulo("admin-anuncios");
  const demo = await emModoDemo();
  const clinicas = await getClinicasDisponiveis({ organizationId: null, ehSuperAdmin: true });
  const configurado = demo || metaConfigurado();

  let daApi: ContaMeta[] = [];
  let erroApi: string | null = null;
  let salvas: ContaAnuncio[] = [];
  let semTabela = false;
  if (demo) {
    daApi = [
      { id: "act_882014557", nome: "Clínica Vida Derma · Anúncios", status: 1, moeda: "BRL", bm: "Medi Marketing" },
      { id: "act_550912873", nome: "Sorriso Prime · Anúncios", status: 1, moeda: "BRL", bm: "Medi Marketing" },
      { id: "act_330018446", nome: "Conta de testes", status: 2, moeda: "BRL", bm: "Medi Marketing" },
    ];
    salvas = [
      {
        id: "demo-conta-1",
        plataforma: "meta",
        conta_id: "act_882014557",
        nome: "Clínica Vida Derma · Anúncios",
        organization_id: clinicas[0]?.id ?? null,
        ativo: true,
        ultima_sincronizacao: new Date(Date.now() - 2 * 3600_000).toISOString(),
        ultimo_erro: null,
        created_at: new Date().toISOString(),
      },
    ];
  } else {
    const supabase = await createClient();
    const { data, error } = await supabase.from("contas_anuncio").select("*").order("nome");
    semTabela = !!error;
    salvas = (data ?? []) as ContaAnuncio[];
    if (configurado) {
      try {
        daApi = await listarContasMeta();
      } catch (e) {
        erroApi = e instanceof Error ? e.message : "Não foi possível listar as contas do Meta.";
      }
    }
  }

  // Contas do Meta mais as já ligadas que sumiram da BM (acesso removido)
  const porId = new Map(salvas.filter((s) => s.plataforma === "meta").map((s) => [s.conta_id, s]));
  const linhas: LinhaConta[] = [
    ...daApi.map((c) => {
      const s = porId.get(c.id);
      return {
        plataforma: "meta" as const,
        contaId: c.id,
        nome: c.nome,
        bm: c.bm,
        ativaNaPlataforma: c.status === 1,
        acessivel: true,
        organizationId: s?.organization_id ?? null,
        ultimaSincronizacao: s?.ultima_sincronizacao ?? null,
        ultimoErro: s?.ultimo_erro ?? null,
      };
    }),
    ...salvas
      .filter((s) => s.plataforma === "meta" && !daApi.some((c) => c.id === s.conta_id) && !erroApi)
      .map((s) => ({
        plataforma: "meta" as const,
        contaId: s.conta_id,
        nome: s.nome,
        bm: null,
        ativaNaPlataforma: true,
        acessivel: false,
        organizationId: s.organization_id,
        ultimaSincronizacao: s.ultima_sincronizacao,
        ultimoErro: s.ultimo_erro,
      })),
  ];
  const ligadas = linhas.filter((l) => l.organizationId).length;

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-8 sm:px-5 md:px-8 md:py-10">
      <header className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-verde-menta text-teal">
          <Megaphone className="size-6" />
        </span>
        <div>
          <h1 className="text-2xl md:text-3xl">Contas de anúncio</h1>
          <p className="mt-1 max-w-2xl text-cinza-suave">
            A BM da Medi Marketing enxerga as contas dos clientes. Ligue cada conta à clínica dona dela: os números aparecem no Marketing da
            clínica e se atualizam sozinhos a cada 6 horas.
          </p>
        </div>
      </header>

      {semTabela && (
        <p className="flex items-start gap-2 rounded-lg border border-alerta/40 bg-alerta/8 px-4 py-3 text-sm text-cinza-texto">
          <Info className="mt-0.5 size-4 shrink-0 text-alerta" /> Rode o SQL da conexão de mídia (Fase 2) no Supabase.
        </p>
      )}

      <Painel
        titulo="Meta Ads · BM principal"
        descricao={configurado ? `${linhas.length} conta${linhas.length === 1 ? "" : "s"} visíve${linhas.length === 1 ? "l" : "is"} · ${ligadas} ligada${ligadas === 1 ? "" : "s"} a clínicas` : "Ainda não conectada."}
        corpo="p-0"
      >
        {!configurado ? (
          <div className="grid gap-3 px-5 py-5 text-sm text-cinza-texto">
            <p className="flex items-center gap-2 font-semibold text-azul-medico">
              <Plug className="size-4 text-teal" /> Para conectar a BM principal
            </p>
            <ol className="list-decimal space-y-1.5 pl-5 text-cinza-suave">
              <li>
                Em <strong className="text-cinza-texto">developers.facebook.com</strong>, crie um app do tipo <strong className="text-cinza-texto">Empresa</strong> e
                adicione o produto <strong className="text-cinza-texto">API de Marketing</strong>.
              </li>
              <li>
                Na BM da Medi, em <strong className="text-cinza-texto">Configurações do negócio › Usuários › Usuários do sistema</strong>, crie um usuário do sistema
                (função Funcionário basta).
              </li>
              <li>
                Em <strong className="text-cinza-texto">Atribuir ativos</strong>, dê a ele acesso às contas de anúncio dos clientes (permissão de ver desempenho) e ao app.
              </li>
              <li>
                Clique em <strong className="text-cinza-texto">Gerar novo token</strong>, escolha o app, a validade <strong className="text-cinza-texto">Nunca</strong> e a
                permissão <strong className="text-cinza-texto">ads_read</strong>.
              </li>
              <li>
                No Vercel, em <strong className="text-cinza-texto">Settings › Environment Variables</strong>, crie <code className="rounded bg-branco-clinico px-1">META_SYSTEM_USER_TOKEN</code>{" "}
                com o token e faça um novo deploy.
              </li>
            </ol>
            <p className="text-xs text-cinza-suave">O token fica só no servidor: não passa pelo navegador nem pelo banco.</p>
          </div>
        ) : erroApi ? (
          <p className="px-5 py-5 text-sm text-coral">{erroApi}</p>
        ) : (
          <ContasAnuncio contas={linhas} clinicas={clinicas.map((c) => ({ id: c.id, nome: c.nome }))} demo={demo} />
        )}
      </Painel>

      <Painel titulo="Google Ads · MCC" descricao="Próxima etapa: depende do token de desenvolvedor aprovado pelo Google.">
        <p className="text-sm text-cinza-suave">
          Enquanto isso, os números do Google entram pelo relatório importado no Marketing de cada clínica.
        </p>
      </Painel>
    </div>
  );
}
