"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  User,
  Phone,
  Mail,
  Cake,
  ShieldCheck,
  Clock,
  Hourglass,
  CalendarCheck,
  Stethoscope,
  DollarSign,
  CheckCircle2,
  XCircle,
  UserX,
  MessageSquareHeart,
  Contact,
  Loader2,
  Save,
  Tag,
  UserRound,
  Trash2,
} from "lucide-react";
import type { Consulta, PrecoProcedimento, StatusConsulta } from "@/lib/supabase/types";
import { catalogoServicos, porCategoria, precoDoServico } from "@/lib/servicos";
import { temFaixa } from "@/lib/financeiro/precos";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { linkPesquisa } from "@/lib/actions/avaliacoes";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  rotuloStatus,
  rotuloTipo,
  calcularIdade,
  formatarValor,
} from "@/lib/agenda";
import { apagarConsulta, atualizarStatus, salvarObservacao, trocarProfissional, trocarServico } from "@/lib/actions/consultas";
import { ocupacaoDoIntervalo } from "@/lib/agenda-capacidade";
import { AnexosManager } from "@/components/app/anexos-manager";
import { PagamentoConsulta } from "@/components/app/financeiro/pagamento-consulta";
import {
  BlocoConfirmacao,
  type ConfirmacaoDaConsulta,
} from "@/components/app/confirmacoes/bloco-consulta";

export function ConsultaDialog({
  consulta,
  confirmacao,
  envioAutomatico = false,
  demo = false,
  servicos = [],
  profissionais = [],
  consultas = [],
  podeApagar = false,
  onOpenChange,
}: {
  /** Gestor: pode apagar a consulta de vez (a RLS também exige). */
  podeApagar?: boolean;
  consulta: Consulta | null;
  /** Quem atende na clínica, para passar a consulta a outro profissional. */
  profissionais?: { id: string; nome: string; organization_id: string | null }[];
  /** Consultas carregadas: dizem quem está livre no horário. */
  consultas?: Consulta[];
  /** Tabela de preços, para trocar o serviço da consulta. */
  servicos?: PrecoProcedimento[];
  /** Estado da confirmação desta consulta, se já existir uma. */
  confirmacao?: ConfirmacaoDaConsulta | null;
  envioAutomatico?: boolean;
  demo?: boolean;
  onOpenChange: (aberto: boolean) => void;
}) {
  const router = useRouter();
  const [obs, setObs] = useState("");
  const [pending, startTransition] = useTransition();
  const [salvandoObs, setSalvandoObs] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [apagando, setApagando] = useState(false);

  useEffect(() => {
    setObs(consulta?.observacao ?? "");
    setErro(null);
    setCancelando(false);
    setApagando(false);
  }, [consulta]);

  if (!consulta) return null;

  function enviarPesquisa() {
    if (!consulta) return;
    setErro(null);
    // A aba abre no clique; senão o navegador trata como pop-up e bloqueia
    const aba = consulta.paciente_telefone ? window.open("", "_blank") : null;
    startTransition(async () => {
      const r = await linkPesquisa(consulta.id);
      if (!r.ok) {
        aba?.close();
        return setErro(r.erro);
      }
      if (r.whatsapp && aba) {
        aba.opener = null;
        aba.location.href = r.whatsapp;
      } else {
        aba?.close();
        await navigator.clipboard?.writeText(r.texto).catch(() => {});
        setErro("Paciente sem telefone: a mensagem com o link foi copiada para você colar onde preferir.");
      }
    });
  }

  function mudarStatus(status: StatusConsulta, avisarPaciente?: boolean) {
    if (!consulta) return;
    setErro(null);
    startTransition(async () => {
      const res = await atualizarStatus(consulta.id, status, { avisarPaciente });
      if (res.ok) {
        router.refresh();
        onOpenChange(false);
      } else setErro(res.erro);
    });
  }

  function apagar() {
    if (!consulta) return;
    setErro(null);
    startTransition(async () => {
      const res = await apagarConsulta(consulta.id);
      if (res.ok) {
        router.refresh();
        onOpenChange(false);
      } else {
        setErro(res.erro);
        setApagando(false);
      }
    });
  }

  async function onSalvarObs() {
    if (!consulta) return;
    setSalvandoObs(true);
    setErro(null);
    const res = await salvarObservacao(consulta.id, obs);
    setSalvandoObs(false);
    if (res.ok) router.refresh();
    else setErro(res.erro);
  }

  const data = new Date(consulta.data_hora);
  const idade = calcularIdade(consulta.paciente_nascimento);

  return (
    <Dialog open={!!consulta} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>{consulta.paciente_nome}</DialogTitle>
            <Badge variant={consulta.status}>{rotuloStatus[consulta.status]}</Badge>
            {consulta.paciente_id && (
              <Link
                href={`/app/pacientes/${consulta.paciente_id}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-teal hover:underline"
              >
                <Contact className="size-3.5" /> Ver ficha
              </Link>
            )}
          </div>
          <DialogDescription className="capitalize">
            {format(data, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })} · {format(data, "HH:mm")}
          </DialogDescription>
        </DialogHeader>

        {/* Dados em duas colunas */}
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Bloco titulo="Paciente">
            <Item icon={User} label="Nome" valor={consulta.paciente_nome} />
            <Item
              icon={Cake}
              label="Idade"
              valor={
                idade != null
                  ? `${idade} anos${consulta.paciente_nascimento ? ` (${format(new Date(consulta.paciente_nascimento), "dd/MM/yyyy")})` : ""}`
                  : "Não informada"
              }
            />
            <Item icon={Phone} label="Telefone" valor={consulta.paciente_telefone} />
            <Item icon={Mail} label="E-mail" valor={consulta.paciente_email} />
            <Item icon={ShieldCheck} label="Convênio" valor={consulta.convenio} />
          </Bloco>

          <Bloco titulo="Consulta">
            <Item icon={Clock} label="Horário" valor={format(data, "HH:mm")} />
            <Item
              icon={Hourglass}
              label="Duração"
              valor={consulta.duracao_min ? `${consulta.duracao_min} min` : null}
            />
            <ServicoDaConsulta key={consulta.id} consulta={consulta} servicos={servicos} demo={demo} />
            <ProfissionalDaConsulta
              key={`p-${consulta.id}`}
              consulta={consulta}
              profissionais={profissionais}
              consultas={consultas}
              demo={demo}
            />
            <Item icon={CalendarCheck} label="Tipo" valor={rotuloTipo[consulta.tipo]} />
            <Item icon={Stethoscope} label="Motivo" valor={consulta.motivo} />
            <Item icon={DollarSign} label="Valor" valor={formatarValor(consulta.valor)} />
          </Bloco>
        </div>

        {/* Observação clínica */}
        <div className="grid gap-1.5">
          <Label htmlFor="obs">Observação clínica</Label>
          <Textarea
            id="obs"
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Anote informações relevantes sobre a consulta…"
          />
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={onSalvarObs}
              disabled={salvandoObs || obs === (consulta.observacao ?? "")}
            >
              {salvandoObs ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Salvar observação
            </Button>
          </div>
        </div>

        {/* Confirmação do paciente */}
        <BlocoConfirmacao
          consultaId={consulta.id}
          confirmacao={confirmacao ?? null}
          telefone={consulta.paciente_telefone}
          envioAutomatico={envioAutomatico}
          semClinica={!consulta.organization_id}
          demo={demo}
        />

        {/* Pagamento: some para o médico e no modo demonstração */}
        <PagamentoConsulta
          consultaId={consulta.id}
          valor={consulta.valor != null ? Number(consulta.valor) : null}
          convenio={consulta.convenio}
          demo={demo}
        />

        {/* Anexos / documentos */}
        <div className="border-t border-border pt-4">
          <AnexosManager consultaId={consulta.id} demo={demo} />
        </div>

        {erro && (
          <p className="rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">{erro}</p>
        )}

        {/* Ações de status */}
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          {consulta.status !== "realizada" && (
            <Button
              variant="teal"
              size="sm"
              onClick={() => mudarStatus("realizada")}
              disabled={pending}
            >
              <CheckCircle2 className="size-4" /> Marcar como realizada
            </Button>
          )}
          {consulta.status === "pendente" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => mudarStatus("confirmada")}
              disabled={pending}
            >
              <CalendarCheck className="size-4" /> Confirmar
            </Button>
          )}
          {consulta.status === "realizada" && (
            <Button variant="outline" size="sm" onClick={enviarPesquisa} disabled={pending}>
              <MessageSquareHeart className="size-4" /> Enviar pesquisa
            </Button>
          )}
          {/* Falta só faz sentido depois do horário */}
          {(consulta.status === "pendente" || consulta.status === "confirmada") &&
            new Date(consulta.data_hora).getTime() < Date.now() && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => mudarStatus("faltou")}
                disabled={pending}
                className="text-[#6D28D9] hover:bg-[#8B5CF6]/10"
              >
                <UserX className="size-4" /> Paciente faltou
              </Button>
            )}
          {consulta.status !== "cancelada" && consulta.status !== "faltou" && !cancelando && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setApagando(false);
                setCancelando(true);
              }}
              disabled={pending}
              className="text-coral hover:bg-coral/10"
            >
              <XCircle className="size-4" /> Cancelar
            </Button>
          )}
          {podeApagar && !apagando && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCancelando(false);
                setApagando(true);
              }}
              disabled={pending}
              className="ml-auto text-cinza-suave hover:bg-coral/10 hover:text-coral"
            >
              <Trash2 className="size-4" /> Apagar
            </Button>
          )}
        </div>

        {/* Apagar é sem volta: sempre pergunta antes */}
        {apagando && (
          <div role="alertdialog" aria-labelledby="apagar-titulo" className="rounded-lg border border-coral/40 bg-coral/5 p-4">
            <p id="apagar-titulo" className="text-sm font-semibold text-azul-medico">
              Tem certeza que quer apagar esta consulta?
            </p>
            <p className="mt-1 text-xs text-cinza-suave">
              A consulta de <strong className="text-cinza-texto">{consulta.paciente_nome}</strong> em{" "}
              {format(data, "dd/MM 'às' HH:mm")} some da agenda de vez, com os documentos e a confirmação. Não dá para
              desfazer, e ninguém é avisado. Se o paciente precisa saber, use Cancelar.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={apagar}
                disabled={pending}
                className="bg-coral text-white hover:bg-coral/90"
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                Sim, apagar de vez
              </Button>
              <Button variant="outline" size="sm" autoFocus onClick={() => setApagando(false)} disabled={pending}>
                Não, voltar
              </Button>
            </div>
          </div>
        )}

        {/* O profissional é avisado sempre; o paciente, se a equipe quiser */}
        {cancelando && (
          <div className="rounded-lg border border-coral/30 bg-coral/5 p-4">
            <p className="text-sm font-semibold text-azul-medico">Cancelar esta consulta?</p>
            <p className="mt-1 text-xs text-cinza-suave">
              O profissional é avisado. Escolha se o paciente também recebe a mensagem de
              cancelamento.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => mudarStatus("cancelada", true)}
                disabled={pending}
                className="bg-coral text-white hover:bg-coral/90"
              >
                Cancelar e avisar o paciente
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => mudarStatus("cancelada", false)}
                disabled={pending}
              >
                Cancelar sem avisar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setCancelando(false)} disabled={pending}>
                Voltar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---------- blocos auxiliares ---------- */
function Bloco({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-lg bg-branco-clinico p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal">
        {titulo}
      </p>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-2 text-sm">{children}</div>
    </div>
  );
}

/**
 * Profissional da consulta, com troca no mesmo horário. A lista diz quem
 * está livre: num horário com vários atendimentos, é isso que a recepção
 * precisa ver para trocar sem criar conflito.
 */
function ProfissionalDaConsulta({
  consulta,
  profissionais,
  consultas,
  demo,
}: {
  consulta: Consulta;
  profissionais: { id: string; nome: string; organization_id: string | null }[];
  consultas: Consulta[];
  demo: boolean;
}) {
  const router = useRouter();
  const [trocando, setTrocando] = useState(false);
  // A agenda manda a consulta com o nome do profissional; a ficha do paciente, sem
  const [nome, setNome] = useState(
    (consulta as Consulta & { medico_nome?: string | null }).medico_nome ??
      profissionais.find((p) => p.id === consulta.medico_id)?.nome ??
      null
  );
  const [erro, setErro] = useState<{ texto: string; encaixe: string | null } | null>(null);
  const [pending, startTransition] = useTransition();
  const daClinica = profissionais.filter((p) => p.organization_id === consulta.organization_id);
  const podeTrocar = daClinica.length > 1 && consulta.status !== "realizada" && consulta.status !== "cancelada" && !demo;
  const ocupados = ocupacaoDoIntervalo(consultas, new Date(consulta.data_hora), consulta.duracao_min ?? 30, consulta.id).ocupados;

  function trocar(id: string, encaixe = false) {
    if (!id || id === consulta.medico_id) return setTrocando(false);
    setErro(null);
    startTransition(async () => {
      const r = await trocarProfissional(consulta.id, id, { encaixe });
      if (!r.ok) {
        const podeEncaixar = "codigo" in r && r.erro.includes("Confirme o encaixe");
        return setErro({ texto: r.erro, encaixe: podeEncaixar ? id : null });
      }
      setNome(daClinica.find((p) => p.id === id)?.nome ?? null);
      setTrocando(false);
      router.refresh();
    });
  }

  return (
    <div className="flex items-start gap-2">
      <UserRound className="mt-0.5 size-4 shrink-0 text-teal" />
      <span className="w-20 shrink-0 text-cinza-suave">Profissional</span>
      <div className="min-w-0 flex-1">
        {trocando ? (
          <select
            autoFocus
            disabled={pending}
            defaultValue={consulta.medico_id}
            onChange={(e) => trocar(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-white px-2 text-sm text-cinza-texto"
          >
            {daClinica.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
                {p.id !== consulta.medico_id && ocupados.has(p.id) ? " (ocupado nesse horário)" : ""}
              </option>
            ))}
          </select>
        ) : (
          <span className="font-medium text-cinza-texto [overflow-wrap:anywhere]">
            {nome || <span className="text-cinza-suave/60">—</span>}
            {podeTrocar && (
              <button type="button" onClick={() => setTrocando(true)} className="ml-2 text-xs font-semibold text-teal hover:underline">
                Trocar
              </button>
            )}
          </span>
        )}
        {pending && <Loader2 className="mt-1 size-3.5 animate-spin text-cinza-suave" />}
        {erro && (
          <p className="mt-1 text-xs text-coral">
            {erro.texto}
            {erro.encaixe && (
              <button
                type="button"
                onClick={() => trocar(erro.encaixe!, true)}
                className="ml-1.5 font-semibold text-teal hover:underline"
              >
                Encaixar mesmo assim
              </button>
            )}
          </p>
        )}
        {trocando && !pending && (
          <p className="mt-1 text-[11px] text-cinza-suave">O paciente e os dois profissionais são avisados da troca.</p>
        )}
      </div>
    </div>
  );
}

/** Serviço da consulta, com troca rápida (o valor acompanha quando a tabela tem preço fixo). */
function ServicoDaConsulta({ consulta, servicos, demo }: { consulta: Consulta; servicos: PrecoProcedimento[]; demo: boolean }) {
  const router = useRouter();
  const [trocando, setTrocando] = useState(false);
  // A ficha aberta não recarrega sozinha: mostra o nome novo na hora
  const [nome, setNome] = useState(consulta.servico_nome ?? null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const catalogo = catalogoServicos(servicos.filter((p) => p.organization_id === consulta.organization_id));
  const podeTrocar = catalogo.length > 0 && consulta.status !== "realizada" && !demo;

  function trocar(id: string) {
    setErro(null);
    const s = catalogo.find((x) => x.id === id) ?? null;
    const p = s ? precoDoServico(s, consulta.convenio) : null;
    const valor = p && !temFaixa(p) && Number(p.valor) ? Number(p.valor) : undefined;
    startTransition(async () => {
      const r = await trocarServico(consulta.id, s?.id ?? null, valor);
      if (!r.ok) return setErro(r.erro);
      setNome(s?.nome ?? null);
      setTrocando(false);
      router.refresh();
    });
  }

  return (
    <div className="flex items-start gap-2">
      <Tag className="mt-0.5 size-4 shrink-0 text-teal" />
      <span className="w-20 shrink-0 text-cinza-suave">Serviço</span>
      <div className="min-w-0 flex-1">
        {trocando ? (
          <select
            autoFocus
            disabled={pending}
            defaultValue={catalogo.find((x) => x.nome === nome)?.id ?? ""}
            onChange={(e) => trocar(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-white px-2 text-sm text-cinza-texto"
          >
            <option value="">Outro serviço (fora da tabela)</option>
            {porCategoria(catalogo).map(([categoria, lista]) => (
              <optgroup key={categoria} label={categoria}>
                {lista.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nome}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        ) : (
          <span className="font-medium text-cinza-texto [overflow-wrap:anywhere]">
            {nome || <span className="text-cinza-suave/60">—</span>}
            {podeTrocar && (
              <button type="button" onClick={() => setTrocando(true)} className="ml-2 text-xs font-semibold text-teal hover:underline">
                {nome ? "Trocar" : "Escolher"}
              </button>
            )}
          </span>
        )}
        {pending && <Loader2 className="mt-1 size-3.5 animate-spin text-cinza-suave" />}
        {erro && <p className="mt-1 text-xs text-coral">{erro}</p>}
      </div>
    </div>
  );
}

function Item({
  icon: Icon,
  label,
  valor,
}: {
  icon: React.ElementType;
  label: string;
  valor: string | null;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-teal" />
      <span className="w-20 shrink-0 text-cinza-suave">{label}</span>
      <span className="min-w-0 flex-1 font-medium text-cinza-texto [overflow-wrap:anywhere]">
        {valor && valor.trim() ? valor : <span className="text-cinza-suave/60">—</span>}
      </span>
    </div>
  );
}
