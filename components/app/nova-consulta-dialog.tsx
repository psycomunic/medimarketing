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
import { rotuloTipo } from "@/lib/agenda";
import { criarConsulta } from "@/lib/actions/consultas";

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

  // Valores do formulário
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [dia, setDia] = useState("");
  const [hora, setHora] = useState("09:00");
  const [tipo, setTipo] = useState<TipoConsulta>("primeira");

  // Preenche a data ao abrir
  useEffect(() => {
    if (aberto) {
      const base = data ?? new Date();
      setDia(format(base, "yyyy-MM-dd"));
      setErro(null);
    }
  }, [aberto, data]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!nome.trim()) {
      setErro("Informe o nome do paciente.");
      return;
    }
    const dataHora = new Date(`${dia}T${hora}:00`);
    startTransition(async () => {
      const res = await criarConsulta({
        paciente_nome: nome,
        paciente_telefone: telefone,
        data_hora: dataHora.toISOString(),
        tipo,
      });
      if (res.ok) {
        // Limpa e fecha
        setNome("");
        setTelefone("");
        onOpenChange(false);
        router.refresh();
      } else setErro(res.erro);
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova consulta</DialogTitle>
          <DialogDescription>
            Normalmente as consultas são criadas pela nossa equipe. Use isto para
            registrar encaixes ou testar sua agenda.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="paciente">Nome do paciente</Label>
            <Input
              id="paciente"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Ana Ribeiro"
              autoFocus
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="telefone">Telefone (opcional)</Label>
            <Input
              id="telefone"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="(11) 99999-9999"
              inputMode="tel"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
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
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="tipo">Tipo</Label>
            <select
              id="tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoConsulta)}
              className="flex h-11 w-full rounded-md border border-input bg-white px-4 text-sm text-cinza-texto shadow-sm focus-visible:border-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              {(Object.keys(rotuloTipo) as TipoConsulta[]).map((t) => (
                <option key={t} value={t}>
                  {rotuloTipo[t]}
                </option>
              ))}
            </select>
          </div>

          {erro && (
            <p className="rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">
              {erro}
            </p>
          )}

          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Criando...
              </>
            ) : (
              <>
                <Plus className="size-4" /> Criar consulta
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
