"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  User,
  Phone,
  Clock,
  CheckCircle2,
  XCircle,
  CalendarCheck,
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
import { rotuloStatus, rotuloTipo } from "@/lib/agenda";
import { atualizarStatus, salvarObservacao } from "@/lib/actions/consultas";

export function ConsultaDialog({
  consulta,
  onOpenChange,
}: {
  consulta: Consulta | null;
  onOpenChange: (aberto: boolean) => void;
}) {
  const router = useRouter();
  const [obs, setObs] = useState("");
  const [pending, startTransition] = useTransition();
  const [salvandoObs, setSalvandoObs] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Sincroniza a observação ao abrir uma nova consulta
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

  return (
    <Dialog open={!!consulta} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>{consulta.paciente_nome}</DialogTitle>
            <Badge variant={consulta.status}>{rotuloStatus[consulta.status]}</Badge>
          </div>
          <DialogDescription>
            {format(data, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </DialogDescription>
        </DialogHeader>

        {/* Detalhes */}
        <div className="grid gap-3 rounded-lg bg-branco-clinico p-4 text-sm">
          <Linha icon={Clock} label="Horário" valor={format(data, "HH:mm")} />
          <Linha icon={CalendarCheck} label="Tipo" valor={rotuloTipo[consulta.tipo]} />
          <Linha icon={User} label="Paciente" valor={consulta.paciente_nome} />
          {consulta.paciente_telefone && (
            <Linha icon={Phone} label="Telefone" valor={consulta.paciente_telefone} />
          )}
        </div>

        {/* Observação */}
        <div className="grid gap-1.5">
          <Label htmlFor="obs">Observação</Label>
          <Textarea
            id="obs"
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Anote informações relevantes sobre a consulta..."
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

function Linha({
  icon: Icon,
  label,
  valor,
}: {
  icon: React.ElementType;
  label: string;
  valor: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-4 text-teal" />
      <span className="text-cinza-suave">{label}:</span>
      <span className="font-medium text-cinza-texto">{valor}</span>
    </div>
  );
}
