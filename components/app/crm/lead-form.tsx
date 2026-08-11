"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { EtapaFunil, LeadComContexto, Profile } from "@/lib/supabase/types";
import { salvarLead } from "@/lib/actions/crm";
import { ETAPAS_FUNIL, rotuloEtapa, rotuloOrigem } from "@/lib/rotulos";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/** "2026-08-10T14:30" — formato aceito pelo input datetime-local. */
function paraInputLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const ORIGENS = ["meta_ads", "google_ads", "instagram", "indicacao", "site", "whatsapp", "outro"];

/** Cadastro e edição de lead. Sem `lead`, cria um novo. */
export function LeadForm({
  aberto,
  onOpenChange,
  equipe,
  organizationId,
  lead,
}: {
  aberto: boolean;
  onOpenChange: (aberto: boolean) => void;
  equipe: Profile[];
  organizationId: string | null;
  lead?: LeadComContexto;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const inicial = {
    nome: lead?.nome ?? "",
    whatsapp: lead?.whatsapp ?? "",
    email: lead?.email ?? "",
    cidade: lead?.cidade ?? "",
    origem: lead?.origem ?? "indicacao",
    etapa: (lead?.etapa_funil ?? "novo") as EtapaFunil,
    responsavelId: lead?.responsavel_id ?? "",
    valorEstimado: lead?.valor_estimado ? String(lead.valor_estimado) : "",
    tags: lead?.tags.join(", ") ?? "",
    proximoContato: paraInputLocal(lead?.proximo_contato ?? null),
    mensagem: lead?.mensagem ?? "",
    motivoPerda: lead?.motivo_perda ?? "",
  };

  const [v, setV] = useState(inicial);

  // Reabrir o diálogo com outro lead precisa recarregar os campos
  useEffect(() => {
    if (aberto) setV(inicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, lead?.id]);

  function enviar() {
    setErro(null);
    startTransition(async () => {
      const res = await salvarLead({
        id: lead?.id,
        organizationId: organizationId ?? undefined,
        nome: v.nome,
        whatsapp: v.whatsapp,
        email: v.email,
        cidade: v.cidade,
        origem: v.origem,
        etapa: v.etapa,
        responsavelId: v.responsavelId,
        valorEstimado: v.valorEstimado ? Number(v.valorEstimado) : undefined,
        tags: v.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        proximoContato: v.proximoContato,
        mensagem: v.mensagem,
        motivoPerda: v.motivoPerda,
      });

      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lead ? "Editar lead" : "Novo lead"}</DialogTitle>
          <DialogDescription>
            {lead
              ? "Ajuste os dados e o estágio do lead no funil."
              : "Cadastre quem chegou por indicação, telefone ou balcão. Leads de campanha entram sozinhos."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Nome" id="nome" className="sm:col-span-2">
            <Input
              id="nome"
              value={v.nome}
              onChange={(e) => setV({ ...v, nome: e.target.value })}
              placeholder="Nome completo"
            />
          </Campo>

          <Campo label="WhatsApp" id="whatsapp">
            <Input
              id="whatsapp"
              value={v.whatsapp}
              onChange={(e) => setV({ ...v, whatsapp: e.target.value })}
              placeholder="(11) 99999-9999"
            />
          </Campo>

          <Campo label="E-mail (opcional)" id="email">
            <Input
              id="email"
              type="email"
              value={v.email}
              onChange={(e) => setV({ ...v, email: e.target.value })}
              placeholder="paciente@email.com"
            />
          </Campo>

          <Campo label="Cidade (opcional)" id="cidade">
            <Input
              id="cidade"
              value={v.cidade}
              onChange={(e) => setV({ ...v, cidade: e.target.value })}
              placeholder="São Paulo, SP"
            />
          </Campo>

          <Campo label="Origem" id="origem">
            <Select
              id="origem"
              value={v.origem}
              onChange={(e) => setV({ ...v, origem: e.target.value })}
            >
              {ORIGENS.map((o) => (
                <option key={o} value={o}>
                  {rotuloOrigem[o] ?? o}
                </option>
              ))}
            </Select>
          </Campo>

          <Campo label="Etapa do funil" id="etapa">
            <Select
              id="etapa"
              value={v.etapa}
              onChange={(e) => setV({ ...v, etapa: e.target.value as EtapaFunil })}
            >
              {[...ETAPAS_FUNIL, "perdido" as const].map((e) => (
                <option key={e} value={e}>
                  {rotuloEtapa[e]}
                </option>
              ))}
            </Select>
          </Campo>

          <Campo label="Responsável" id="responsavel">
            <Select
              id="responsavel"
              value={v.responsavelId}
              onChange={(e) => setV({ ...v, responsavelId: e.target.value })}
            >
              <option value="">Sem responsável</option>
              {equipe.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </Select>
          </Campo>

          <Campo label="Valor estimado (R$)" id="valor">
            <Input
              id="valor"
              inputMode="decimal"
              value={v.valorEstimado}
              onChange={(e) =>
                setV({ ...v, valorEstimado: e.target.value.replace(",", ".") })
              }
              placeholder="0"
            />
          </Campo>

          <Campo label="Próximo contato" id="proximo">
            <Input
              id="proximo"
              type="datetime-local"
              value={v.proximoContato}
              onChange={(e) => setV({ ...v, proximoContato: e.target.value })}
            />
          </Campo>

          <Campo
            label="Tags (separadas por vírgula)"
            id="tags"
            className="sm:col-span-2"
          >
            <Input
              id="tags"
              value={v.tags}
              onChange={(e) => setV({ ...v, tags: e.target.value })}
              placeholder="botox, alta prioridade"
            />
          </Campo>

          <Campo label="Observações" id="mensagem" className="sm:col-span-2">
            <Textarea
              id="mensagem"
              rows={2}
              value={v.mensagem}
              onChange={(e) => setV({ ...v, mensagem: e.target.value })}
              placeholder="O que o paciente procura, o que ele disse no primeiro contato..."
            />
          </Campo>

          {v.etapa === "perdido" && (
            <Campo label="Motivo da perda" id="motivo" className="sm:col-span-2">
              <Textarea
                id="motivo"
                rows={2}
                value={v.motivoPerda}
                onChange={(e) => setV({ ...v, motivoPerda: e.target.value })}
                placeholder="Preço, distância, escolheu outra clínica, sumiu..."
              />
            </Campo>
          )}
        </div>

        {erro && (
          <p className="rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">{erro}</p>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="marca" onClick={enviar} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {lead ? "Salvar alterações" : "Cadastrar lead"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Campo({
  label,
  id,
  className,
  children,
}: {
  label: string;
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`grid gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
