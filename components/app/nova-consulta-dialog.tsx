"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { differenceInCalendarDays, format, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarCheck, Loader2, Plus, TriangleAlert } from "lucide-react";
import type { TipoConsulta } from "@/lib/supabase/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { rotuloTipo } from "@/lib/agenda";
import { criarConsulta } from "@/lib/actions/consultas";
import { cn } from "@/lib/utils";

// Convênios sugeridos (o campo aceita texto livre via datalist)
const CONVENIOS = [
  "Particular",
  "Unimed",
  "Bradesco Saúde",
  "SulAmérica",
  "Amil",
  "NotreDame Intermédica",
  "Hapvida",
  "Porto Seguro",
];

const DURACOES = [15, 20, 30, 40, 45, 60, 90];

const selectClass =
  "flex h-11 w-full rounded-md border border-input bg-white px-4 text-sm text-cinza-texto shadow-sm focus-visible:border-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

export type OpcaoProfissional = {
  id: string;
  nome: string;
  organization_id: string | null;
};

export function NovaConsultaDialog({
  onCriada,
  aberto,
  data,
  onOpenChange,
  profissionais = [],
  clinicas = [],
  usuarioId,
  organizationId,
}: {
  aberto: boolean;
  data: Date | null;
  onOpenChange: (aberto: boolean) => void;
  /** Equipe que pode atender. Vazio = só quem está criando. */
  profissionais?: OpcaoProfissional[];
  /** Só tem mais de uma para o super admin. */
  clinicas?: { id: string; nome: string }[];
  usuarioId?: string;
  /** Clínica de quem está criando; nula para o super admin. */
  organizationId?: string | null;
  /** Avisa a data criada, para a agenda ir até ela. */
  onCriada?: (quando: Date) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  // --- Campos do formulário ---
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [convenio, setConvenio] = useState("Particular");
  const [dia, setDia] = useState("");
  const [hora, setHora] = useState("09:00");
  const [duracao, setDuracao] = useState(30);
  const [tipo, setTipo] = useState<TipoConsulta>("primeira");
  const [motivo, setMotivo] = useState("");
  const [valor, setValor] = useState("");
  const [observacao, setObservacao] = useState("");
  const [clinicaId, setClinicaId] = useState(organizationId ?? clinicas[0]?.id ?? "");
  // Só pré-seleciona a si mesmo quem de fato atende na clínica
  const [medicoId, setMedicoId] = useState(
    profissionais.some((p) => p.id === usuarioId) ? usuarioId ?? "" : ""
  );

  // Trocar de clínica invalida um profissional de outra
  const daClinica = profissionais.filter(
    (p) => !clinicaId || p.organization_id === clinicaId
  );
  const precisaEscolherClinica = clinicas.length > 1;
  const souProfissionalDaqui = daClinica.some((p) => p.id === usuarioId);

  // O bloco só some quando não há nada a decidir: uma clínica só e o
  // próprio usuário como único profissional (o médico marcando encaixe).
  const precisaEscolherAtendimento =
    precisaEscolherClinica || daClinica.length > 1 || !souProfissionalDaqui;

  // Reinicia o formulário ao abrir, preenchendo a data escolhida
  useEffect(() => {
    if (aberto) {
      const base = data ?? new Date();
      setDia(format(base, "yyyy-MM-dd"));
      setErro(null);
    }
  }, [aberto, data]);

  function limpar() {
    setNome("");
    setTelefone("");
    setEmail("");
    setNascimento("");
    setConvenio("Particular");
    setDuracao(30);
    setTipo("primeira");
    setMotivo("");
    setValor("");
    setObservacao("");
  }

  /*
   * Conferência do que foi escolhido, escrita por extenso.
   *
   * O <input type="date"> desenha o formato conforme o idioma do
   * navegador, não o da página: num Chrome em inglês ele mostra
   * mm/dd/yyyy, e quem digita "12/08" pensando em 12 de agosto marca
   * 8 de dezembro. Como as duas datas são válidas, nada reclama — a
   * consulta simplesmente não aparece no dia esperado.
   *
   * Não dá para mudar o formato do campo. Dá para escrever a data
   * escolhida por extenso, em português, onde é impossível não ver.
   */
  const escolhida = new Date(`${dia}T${hora || "00:00"}:00`);
  const dataValida = isValid(escolhida);
  const diasAdiante = dataValida ? differenceInCalendarDays(escolhida, new Date()) : 0;

  const porExtenso = dataValida
    ? format(escolhida, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
    : null;

  const distancia = !dataValida
    ? null
    : diasAdiante === 0
      ? "hoje"
      : diasAdiante === 1
        ? "amanhã"
        : diasAdiante === -1
          ? "ontem"
          : diasAdiante < 0
            ? `${Math.abs(diasAdiante)} dias atrás`
            : `daqui a ${diasAdiante} dias`;

  // Passado é quase sempre engano; muito longe costuma ser dia/mês trocados
  const suspeita = dataValida && (diasAdiante < 0 || diasAdiante > 120);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!nome.trim()) {
      setErro("Informe o nome do paciente.");
      return;
    }
    const dataHora = new Date(`${dia}T${hora}:00`);
    const valorNum = valor.trim() ? Number(valor.replace(",", ".")) : undefined;

    startTransition(async () => {
      const res = await criarConsulta({
        paciente_nome: nome,
        paciente_telefone: telefone,
        paciente_email: email,
        paciente_nascimento: nascimento || undefined,
        convenio,
        data_hora: dataHora.toISOString(),
        duracao_min: duracao,
        tipo,
        motivo,
        observacao,
        valor: Number.isFinite(valorNum) ? valorNum : undefined,
        medico_id: medicoId || undefined,
        organization_id: clinicaId || undefined,
      });
      if (res.ok) {
        limpar();
        onOpenChange(false);
        // Leva a agenda até a consulta criada. Sem isso, marcar num mês
        // que não é o que está na tela parece que a consulta sumiu.
        onCriada?.(dataHora);
        router.refresh();
      } else setErro(res.erro);
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova consulta</DialogTitle>
          <DialogDescription>
            Normalmente as consultas são criadas pela nossa equipe. Use isto para
            registrar encaixes ou testar sua agenda.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="grid gap-5">
          {/* ---------- Bloco: Atendimento ----------
              Vem primeiro porque define o resto: a clínica determina
              quais profissionais aparecem, e é ela que liga a consulta
              ao financeiro, aos indicadores e à confirmação. */}
          {precisaEscolherAtendimento && (
            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-teal">
                Atendimento
              </legend>

              {precisaEscolherClinica && (
                <div className="grid gap-1.5">
                  <Label htmlFor="clinica">
                    Clínica <span className="text-coral">*</span>
                  </Label>
                  <select
                    id="clinica"
                    className={selectClass}
                    value={clinicaId}
                    onChange={(e) => {
                      setClinicaId(e.target.value);
                      // O profissional escolhido pode não ser desta clínica
                      const aindaVale = profissionais.some(
                        (p) => p.id === medicoId && p.organization_id === e.target.value
                      );
                      if (!aindaVale) setMedicoId("");
                    }}
                  >
                    <option value="">Selecione…</option>
                    {clinicas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {clinicaId && daClinica.length === 0 ? (
                <p className="rounded-md border border-dashed border-alerta/40 bg-alerta/5 px-3 py-2.5 text-xs text-cinza-suave sm:col-span-2">
                  Esta clínica ainda não tem nenhum profissional cadastrado.
                  Crie o acesso do médico em{" "}
                  <a
                    href="/app/admin/usuarios"
                    className="font-semibold text-teal hover:underline"
                  >
                    Usuários
                  </a>{" "}
                  antes de marcar a consulta — é ele que aparece na agenda e
                  na mensagem enviada ao paciente.
                </p>
              ) : (
                <div className="grid gap-1.5">
                  <Label htmlFor="profissional">
                    Profissional <span className="text-coral">*</span>
                  </Label>
                  <select
                    id="profissional"
                    className={selectClass}
                    value={medicoId}
                    onChange={(e) => setMedicoId(e.target.value)}
                  >
                    <option value="">Selecione…</option>
                    {daClinica.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                        {p.id === usuarioId ? " (você)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </fieldset>
          )}

          {/* ---------- Bloco: Paciente ---------- */}
          <fieldset className="grid gap-4">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-teal">
              Paciente
            </legend>

            <div className="grid gap-1.5">
              <Label htmlFor="paciente">
                Nome do paciente <span className="text-coral">*</span>
              </Label>
              <Input
                id="paciente"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Ana Ribeiro"
                autoFocus
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  inputMode="tel"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="paciente@email.com"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="nascimento">Data de nascimento</Label>
                <Input
                  id="nascimento"
                  type="date"
                  value={nascimento}
                  onChange={(e) => setNascimento(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="convenio">Convênio</Label>
                <Input
                  id="convenio"
                  list="convenios"
                  value={convenio}
                  onChange={(e) => setConvenio(e.target.value)}
                  placeholder="Particular"
                />
                <datalist id="convenios">
                  {CONVENIOS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </div>
          </fieldset>

          {/* ---------- Bloco: Consulta ---------- */}
          <fieldset className="grid gap-4 border-t border-border pt-4">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-teal">
              Consulta
            </legend>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label htmlFor="dia">Data</Label>
                <Input
                  id="dia"
                  type="date"
                  value={dia}
                  onChange={(e) => setDia(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="hora">Horário</Label>
                <Input
                  id="hora"
                  type="time"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="duracao">Duração</Label>
                <select
                  id="duracao"
                  value={duracao}
                  onChange={(e) => setDuracao(Number(e.target.value))}
                  className={selectClass}
                >
                  {DURACOES.map((d) => (
                    <option key={d} value={d}>
                      {d} min
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* A data por extenso: é aqui que um dia/mês trocado aparece */}
            {porExtenso && (
              <p
                className={cn(
                  "flex items-start gap-2 rounded-md border px-3.5 py-2.5 text-sm",
                  suspeita
                    ? "border-alerta/40 bg-alerta/8 text-cinza-texto"
                    : "border-border bg-branco-clinico text-cinza-suave"
                )}
              >
                {suspeita ? (
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-alerta" />
                ) : (
                  <CalendarCheck className="mt-0.5 size-4 shrink-0 text-teal" />
                )}
                <span>
                  <strong className="font-semibold capitalize text-azul-medico">
                    {porExtenso}
                  </strong>{" "}
                  às {hora} — {distancia}.
                  {suspeita && (
                    <>
                      {" "}
                      Confira: o campo de data segue o idioma do seu navegador,
                      e nele o dia pode estar no lugar do mês.
                    </>
                  )}
                </span>
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="tipo">Tipo</Label>
                <select
                  id="tipo"
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as TipoConsulta)}
                  className={selectClass}
                >
                  {(Object.keys(rotuloTipo) as TipoConsulta[]).map((t) => (
                    <option key={t} value={t}>
                      {rotuloTipo[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="valor">Valor (R$)</Label>
                <Input
                  id="valor"
                  inputMode="decimal"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="0,00 (deixe vazio se for convênio)"
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="motivo">Motivo / queixa</Label>
              <Input
                id="motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex.: Avaliação de manchas na pele"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="obs">Observação (opcional)</Label>
              <Textarea
                id="obs"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Informações adicionais para a equipe…"
                className="min-h-[64px]"
              />
            </div>
          </fieldset>

          {erro && (
            <p className={cn("rounded-md bg-coral/10 px-3 py-2 text-sm text-coral")}>
              {erro}
            </p>
          )}

          <Button type="submit" variant="primary" size="lg" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="size-5 animate-spin" /> Criando...
              </>
            ) : (
              <>
                <Plus className="size-5" /> Criar consulta
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
