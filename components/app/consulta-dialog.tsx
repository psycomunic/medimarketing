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
  Loader2,
  Save,
} from "lucide-react";
import type { Consulta, StatusConsulta } from "@/lib/supabase/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  rotuloStatus,
  rotuloTipo,
  calcularIdade,
  formatarValor,
} from "@/lib/agenda";
import { atualizarStatus, salvarObservacao } from "@/lib/actions/consultas";
import { AnexosManager } from "@/components/app/anexos-manager";

export function ConsultaDialog({
  consulta,
  demo = false,
  onOpenChange,
}: {
  consulta: Consulta | null;
  demo?: boolean;
  onOpenChange: (aberto: boolean) => void;
}) {
  const router = useRouter();
  const [obs, setObs] = useState("");
  const [pending, startTransition] = useTransition();
  const [salvandoObs, setSalvandoObs] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setObs(consulta?.observacao ?? "");
    setErro(null);
  }, [consulta]);

  if (!consulta) return null;

  function mudarStatus(status: StatusConsulta) {
    if (!consulta) return;
    setErro(null);
    startTransition(async () => {
      const res = await atualizarStatus(consulta.id, status);
      if (res.ok) {
        router.refresh();
        onOpenChange(false);
      } else setErro(res.erro);
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
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>{consulta.paciente_nome}</DialogTitle>
            <Badge variant={consulta.status}>{rotuloStatus[consulta.status]}</Badge>
          </div>
          <DialogDescription className="capitalize">
            {format(data, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })} · {format(data, "HH:mm")}
          </DialogDescription>
        </DialogHeader>

        {/* Dados em duas colunas */}
        <div className="grid gap-4 sm:grid-cols-2">
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
          {consulta.status !== "cancelada" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => mudarStatus("cancelada")}
              disabled={pending}
              className="text-coral hover:bg-coral/10"
            >
              <XCircle className="size-4" /> Cancelar
            </Button>
          )}
        </div>
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
    <div className="rounded-lg bg-branco-clinico p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal">
        {titulo}
      </p>
      <div className="grid gap-2 text-sm">{children}</div>
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
      <span className="min-w-0 flex-1 break-words font-medium text-cinza-texto">
        {valor && valor.trim() ? valor : <span className="text-cinza-suave/60">—</span>}
      </span>
    </div>
  );
}
