"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  BellRing,
  Building2,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Pencil,
  Power,
} from "lucide-react";
import type { Organization } from "@/lib/supabase/types";
import { ativarClinica } from "@/lib/actions/identidade";
import { salvarClinica, type ConexaoDisponivel } from "@/lib/actions/configuracoes";
import { FormLogo } from "@/components/app/configuracoes/form-logo";
import { FormBanner } from "@/components/app/configuracoes/form-banner";
import { ConexaoWhatsApp } from "@/components/app/configuracoes/conexao-whatsapp";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Aba = "dados" | "marca" | "whatsapp" | "lembretes";

const ABAS: { id: Aba; label: string; icone: typeof Building2 }[] = [
  { id: "dados", label: "Dados", icone: Building2 },
  { id: "marca", label: "Visual", icone: ImageIcon },
  { id: "whatsapp", label: "WhatsApp", icone: MessageCircle },
  { id: "lembretes", label: "Lembretes", icone: BellRing },
];

const CAMPOS = [
  { chave: "nome", label: "Nome da clínica", ph: "Instituto Correr", tipo: "text" },
  { chave: "especialidade", label: "Especialidade", ph: "Quiropraxia", tipo: "text" },
  { chave: "responsavel", label: "Responsável", ph: "Dr(a). Nome", tipo: "text" },
  { chave: "cnpj", label: "CNPJ", ph: "00.000.000/0001-00", tipo: "text" },
  { chave: "telefone", label: "Telefone", ph: "(41) 99999-0000", tipo: "tel" },
  { chave: "email", label: "E-mail", ph: "contato@clinica.com.br", tipo: "email" },
  { chave: "cidade", label: "Cidade", ph: "Curitiba, PR", tipo: "text" },
  { chave: "endereco", label: "Endereço", ph: "Rua, número, bairro", tipo: "text" },
  { chave: "site", label: "Site", ph: "https://suaclinica.com.br", tipo: "url" },
  { chave: "instagram", label: "Instagram", ph: "@suaclinica", tipo: "text" },
] as const;

function valoresDe(o: Organization) {
  return {
    nome: o.nome,
    especialidade: o.especialidade ?? "",
    responsavel: o.responsavel ?? "",
    cnpj: o.cnpj ?? "",
    telefone: o.telefone ?? "",
    email: o.email ?? "",
    cidade: o.cidade ?? "",
    endereco: o.endereco ?? "",
    site: o.site ?? "",
    instagram: o.instagram ?? "",
    plano: o.plano,
    mensagemLembrete: o.mensagem_lembrete ?? "",
    lembreteAtivo: o.lembrete_ativo ?? true,
    lembreteDiasUteis: String(o.lembrete_dias_uteis ?? 1),
    lembreteHora: String(o.lembrete_hora ?? 9),
  };
}

/**
 * Configuração completa de uma clínica pela equipe Medi Marketing.
 *
 * O super admin não pertence a clínica nenhuma, então Configurações não
 * serve para ele. Aqui ele ajusta tudo direto da carteira — status, dados
 * cadastrais, plano, logo, WhatsApp e lembretes — sem entrar na conta de
 * ninguém. Logo e WhatsApp salvam sozinhos; dados e lembretes saem juntos
 * no mesmo botão, porque são uma única gravação.
 */
export function EditarMarca({
  clinica,
  conexoes,
  mergeDisponivel,
  demo,
}: {
  clinica: Organization;
  conexoes: ConexaoDisponivel[];
  mergeDisponivel: boolean;
  demo: boolean;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [aba, setAba] = useState<Aba>("dados");
  const [v, setV] = useState(() => valoresDe(clinica));
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pending, startTransition] = useTransition();
  const [mudandoStatus, setMudandoStatus] = useState(false);

  const ativa = clinica.ativo;

  function campo<K extends keyof typeof v>(k: K, valor: (typeof v)[K]) {
    setV((atual) => ({ ...atual, [k]: valor }));
    setSalvo(false);
  }

  function alternarStatus() {
    setErro(null);
    setMudandoStatus(true);
    startTransition(async () => {
      const res = await ativarClinica(clinica.id, !ativa);
      setMudandoStatus(false);
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      router.refresh();
    });
  }

  function salvar() {
    setErro(null);
    setSalvo(false);
    startTransition(async () => {
      const res = await salvarClinica({
        organizationId: clinica.id,
        ...v,
        lembreteDiasUteis: Number(v.lembreteDiasUteis || 1),
        lembreteHora: Number(v.lembreteHora || 9),
      });
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      setSalvo(true);
      router.refresh();
    });
  }

  const comFormulario = aba === "dados" || aba === "lembretes";

  return (
    <Dialog
      open={aberto}
      onOpenChange={(abrir) => {
        setAberto(abrir);
        if (abrir) {
          setV(valoresDe(clinica));
          setAba("dados");
          setErro(null);
          setSalvo(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`Editar ${clinica.nome}`}>
          <Pencil className="size-4" />
          Editar
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl gap-0 p-0">
        {/* Cabeçalho e abas ficam presos no topo enquanto o conteúdo rola */}
        <div className="sticky top-0 z-10 border-b border-border bg-white px-5 pb-0 pt-5 sm:px-6">
          <DialogHeader>
            <DialogTitle className="truncate">Configurar clínica</DialogTitle>
            <DialogDescription className="truncate">{clinica.nome}</DialogDescription>
          </DialogHeader>
          <nav className="mt-4 grid grid-cols-4 sm:flex sm:gap-1" aria-label="Seções">
            {ABAS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAba(a.id)}
                aria-current={aba === a.id ? "page" : undefined}
                className={cn(
                  "inline-flex min-w-0 items-center justify-center gap-1.5 border-b-2 px-1 pb-2.5 pt-1 text-sm font-medium transition-colors sm:px-3",
                  aba === a.id
                    ? "border-teal text-azul-medico"
                    : "border-transparent text-cinza-suave hover:text-azul-medico"
                )}
              >
                <a.icone className="hidden size-4 shrink-0 sm:block" />
                <span className="truncate">{a.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="grid gap-5 px-5 py-5 sm:px-6">
          {aba === "dados" && (
            <>
              <div
                className={cn(
                  "flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3",
                  ativa ? "border-teal/25 bg-verde-menta" : "border-dashed border-border bg-branco-clinico"
                )}
              >
                <div className="flex min-w-0 items-start gap-2.5">
                  <Power className={cn("mt-0.5 size-4 shrink-0", ativa ? "text-teal" : "text-cinza-suave")} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-azul-medico">
                      {ativa ? "Clínica ativa" : "Cadastro ainda não liberado"}
                    </p>
                    <p className="text-xs text-cinza-suave">
                      {ativa
                        ? "Conta na carteira e entra na rotina diária de lembretes."
                        : "Enquanto inativa, nenhum lembrete de véspera é disparado."}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant={ativa ? "ghost" : "primary"}
                  size="sm"
                  disabled={demo || mudandoStatus}
                  onClick={alternarStatus}
                >
                  {mudandoStatus ? <Loader2 className="size-4 animate-spin" /> : ativa ? "Desativar" : "Ativar clínica"}
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {CAMPOS.map((c) => (
                  <div key={c.chave} className="grid gap-1.5">
                    <Label htmlFor={`${c.chave}-${clinica.id}`}>{c.label}</Label>
                    <Input
                      id={`${c.chave}-${clinica.id}`}
                      type={c.tipo}
                      value={v[c.chave]}
                      onChange={(e) => campo(c.chave, e.target.value)}
                      placeholder={c.ph}
                      disabled={demo}
                    />
                  </div>
                ))}
                <div className="grid gap-1.5">
                  <Label htmlFor={`plano-${clinica.id}`}>Plano contratado</Label>
                  <Select
                    id={`plano-${clinica.id}`}
                    value={v.plano}
                    onChange={(e) => campo("plano", e.target.value as Organization["plano"])}
                    disabled={demo}
                  >
                    <option value="essencial">Essencial</option>
                    <option value="performance">Performance</option>
                    <option value="full">Full / Parceria</option>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-cinza-suave">
                O nome é o que o paciente vê no remetente do e-mail, na assinatura do WhatsApp e na
                página de confirmação.
              </p>
            </>
          )}

          {aba === "marca" && (
            <FormLogo
              organizationId={clinica.id}
              nome={v.nome || clinica.nome}
              logoUrl={clinica.logo_url}
              demo={demo}
              className="border-0 p-0 shadow-none"
            />
          )}
          {aba === "marca" && (
            <FormBanner
              organizationId={clinica.id}
              nome={v.nome || clinica.nome}
              bannerUrl={clinica.banner_url ?? null}
              bannerLink={clinica.banner_link ?? null}
              demo={demo}
              className="mt-6 rounded-none border-0 border-t p-0 pt-6 shadow-none"
            />
          )}

          {aba === "whatsapp" && (
            <ConexaoWhatsApp
              organizationId={clinica.id}
              conexoes={conexoes}
              disponivel={mergeDisponivel}
              escolhida={clinica.merge_connection_id}
              demo={demo}
            />
          )}

          {aba === "lembretes" && (
            <>
              <label className="flex items-start gap-2.5 rounded-md border border-border bg-branco-clinico px-4 py-3">
                <input
                  type="checkbox"
                  checked={v.lembreteAtivo}
                  onChange={(e) => campo("lembreteAtivo", e.target.checked)}
                  className="mt-0.5 size-4 accent-teal"
                  disabled={demo}
                />
                <span className="text-sm text-cinza-texto">
                  Enviar lembretes automaticamente
                  <span className="mt-0.5 block text-xs text-cinza-suave">
                    Desligado, os pedidos continuam sendo criados e ficam na fila de Confirmações
                    para envio manual.
                  </span>
                </span>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid content-start gap-1.5">
                  <Label htmlFor={`dias-${clinica.id}`}>Quantos dias úteis antes</Label>
                  <Input
                    id={`dias-${clinica.id}`}
                    type="number"
                    min={1}
                    max={10}
                    value={v.lembreteDiasUteis}
                    onChange={(e) => campo("lembreteDiasUteis", e.target.value)}
                    disabled={demo}
                  />
                  <p className="text-xs text-cinza-suave">
                    Consulta de segunda avisa na sexta, para a mensagem não cair no sábado.
                  </p>
                </div>
                <div className="grid content-start gap-1.5">
                  <Label htmlFor={`hora-${clinica.id}`}>Horário de referência</Label>
                  <Select
                    id={`hora-${clinica.id}`}
                    value={v.lembreteHora}
                    onChange={(e) => campo("lembreteHora", e.target.value)}
                    disabled={demo}
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={String(h)}>
                        {String(h).padStart(2, "0")}:00
                      </option>
                    ))}
                  </Select>
                  <p className="text-xs text-cinza-suave">
                    A rotina roda uma vez por dia, de manhã: a mensagem pode sair antes deste
                    horário, nunca depois.
                  </p>
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor={`msg-${clinica.id}`}>Mensagem</Label>
                <Textarea
                  id={`msg-${clinica.id}`}
                  rows={4}
                  value={v.mensagemLembrete}
                  onChange={(e) => campo("mensagemLembrete", e.target.value)}
                  placeholder="Olá, {paciente}! Confirmando sua consulta em {data} às {hora}."
                  disabled={demo}
                />
                <p className="text-xs text-cinza-suave">
                  {"{paciente}"}, {"{data}"}, {"{hora}"} e {"{clinica}"} são preenchidos
                  automaticamente. Em branco, vale a mensagem padrão.
                </p>
              </div>
            </>
          )}

          {erro && <p className="rounded-md bg-coral/10 px-4 py-2.5 text-sm text-coral">{erro}</p>}
        </div>

        {/* Rodapé fixo: salvar sempre à vista, sem rolar até o fim */}
        <div className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-border bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Link
            href={`/app/clinicas/${clinica.id}`}
            className="inline-flex items-center justify-center gap-1 text-sm font-medium text-teal hover:underline sm:justify-start"
          >
            Acessos, diagnóstico e evolução <ArrowUpRight className="size-4" />
          </Link>
          {comFormulario ? (
            <div className="flex items-center justify-end gap-3">
              {salvo && (
                <span className="inline-flex items-center gap-1.5 text-sm text-teal">
                  <CheckCircle2 className="size-4" /> Salvo
                </span>
              )}
              <Button type="button" onClick={salvar} disabled={demo || pending || !v.nome.trim()}>
                {pending && <Loader2 className="size-4 animate-spin" />}
                Salvar alterações
              </Button>
            </div>
          ) : (
            <p className="text-right text-xs text-cinza-suave">
              {aba === "marca" ? "Logo e banner são salvos ao enviar." : "O número é salvo ao escolher."}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
