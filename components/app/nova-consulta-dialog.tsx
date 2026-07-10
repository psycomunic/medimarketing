"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Loader2, Plus } from "lucide-react";
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

export function NovaConsultaDialog({
  aberto,
  data,
  onOpenChange,
}: {
  aberto: boolean;
  data: Date | null;
  onOpenChange: (aberto: boolean) => void;
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
      });
      if (res.ok) {
        limpar();
        onOpenChange(false);
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
