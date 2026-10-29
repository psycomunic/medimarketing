"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, ShieldCheck, UserPlus, X } from "lucide-react";
import { salvarPaciente } from "@/lib/actions/pacientes";
import { nomeOrigem } from "@/lib/rotulos";
import type { Paciente } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const ORIGENS = ["instagram", "meta_ads", "google_ads", "indicacao", "site", "whatsapp", "organico", "outro"];
const CANAIS = [
  { v: "presencial", r: "Na recepção" },
  { v: "whatsapp", r: "Pelo WhatsApp" },
  { v: "formulario", r: "Formulário / ficha assinada" },
  { v: "email", r: "Por e-mail" },
];

type Props = {
  paciente?: Paciente;
  sugestoesTags?: string[];
  /** Super admin: em qual clínica cadastrar. */
  organizationId?: string;
};

/** Botão + formulário de cadastro (sem paciente) ou edição (com paciente). */
export function PacienteDialog({ paciente, sugestoesTags = [], organizationId }: Props) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      {paciente ? (
        <Button variant="outline" size="sm" onClick={() => setAberto(true)}>
          <Pencil className="size-4" /> Editar ficha
        </Button>
      ) : (
        <Button variant="marca" size="sm" onClick={() => setAberto(true)}>
          <UserPlus className="size-4" /> Novo paciente
        </Button>
      )}
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-2xl">
          {aberto && (
            <Formulario
              paciente={paciente}
              sugestoesTags={sugestoesTags}
              organizationId={organizationId}
              onFechar={() => setAberto(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Formulario({ paciente: p, sugestoesTags, organizationId, onFechar }: Props & { onFechar: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({
    nome: p?.nome ?? "",
    telefone: p?.telefone ?? "",
    email: p?.email ?? "",
    nascimento: p?.nascimento ?? "",
    cpf: p?.cpf ?? "",
    sexo: p?.sexo ?? "",
    cidade: p?.cidade ?? "",
    convenio: p?.convenio ?? "",
    carteirinha: p?.carteirinha ?? "",
    origem: p?.origem ?? "",
    observacoes: p?.observacoes ?? "",
    consentimentoMarketing: p ? p.consentimento_marketing && !p.descadastrado_em : false,
    consentimentoCanal: p?.consentimento_canal ?? "presencial",
  });
  const [tags, setTags] = useState<string[]>(p?.tags ?? []);
  const [novaTag, setNovaTag] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const campo = (k: keyof typeof v) => ({
    id: `p-${k}`,
    value: String(v[k] ?? ""),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value }),
  });

  function addTag(t: string) {
    const limpa = t.trim().replace(/,$/, "");
    if (limpa && !tags.includes(limpa)) setTags([...tags, limpa]);
    setNovaTag("");
  }

  function salvar() {
    setErro(null);
    startTransition(async () => {
      const r = await salvarPaciente({
        id: p?.id,
        organizationId,
        ...v,
        sexo: v.sexo as "" | "feminino" | "masculino" | "outro",
        tags,
      });
      if (!r.ok) return setErro(r.erro);
      onFechar();
      if (p) router.refresh();
      else router.push(`/app/pacientes/${r.id}`);
    });
  }

  return (
    <div className="grid gap-5">
      <DialogHeader>
        <DialogTitle>{p ? "Editar ficha" : "Novo paciente"}</DialogTitle>
        <DialogDescription>
          {p ? "As consultas e o histórico continuam ligados a esta ficha." : "Pacientes marcados na agenda entram aqui sozinhos. Use para quem ainda não tem consulta."}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="p-nome">Nome completo</Label>
          <Input {...campo("nome")} autoFocus={!p} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="p-telefone">WhatsApp / telefone</Label>
          <Input {...campo("telefone")} inputMode="tel" placeholder="(11) 99999-0000" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="p-email">E-mail</Label>
          <Input {...campo("email")} type="email" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="p-nascimento">Nascimento</Label>
          <Input {...campo("nascimento")} type="date" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="p-sexo">Sexo</Label>
          <Select {...campo("sexo")}>
            <option value="">Não informado</option>
            <option value="feminino">Feminino</option>
            <option value="masculino">Masculino</option>
            <option value="outro">Outro</option>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="p-cpf">CPF (opcional)</Label>
          <Input {...campo("cpf")} inputMode="numeric" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="p-cidade">Cidade</Label>
          <Input {...campo("cidade")} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="p-convenio">Convênio</Label>
          <Input {...campo("convenio")} placeholder="Particular" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="p-carteirinha">Carteirinha</Label>
          <Input {...campo("carteirinha")} />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="p-origem">Como conheceu a clínica</Label>
          <Select {...campo("origem")}>
            <option value="">Não informado</option>
            {ORIGENS.map((o) => (
              <option key={o} value={o}>
                {nomeOrigem(o)}
              </option>
            ))}
            {v.origem && !ORIGENS.includes(v.origem) && <option value={v.origem}>{nomeOrigem(v.origem)}</option>}
          </Select>
        </div>

        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="p-tag">Etiquetas</Label>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full bg-verde-menta px-2.5 py-1 text-xs font-medium text-azul-medico">
                {t}
                <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={`Tirar ${t}`}>
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
          <Input
            id="p-tag"
            list="p-tags-sugestoes"
            value={novaTag}
            onChange={(e) => (e.target.value.endsWith(",") ? addTag(e.target.value) : setNovaTag(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag(novaTag);
              }
            }}
            onBlur={() => novaTag && addTag(novaTag)}
            placeholder="Ex.: VIP, Estética, Retorno em março. Enter para adicionar."
          />
          <datalist id="p-tags-sugestoes">
            {(sugestoesTags ?? []).filter((t) => !tags.includes(t)).map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>

        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="p-observacoes">Observações</Label>
          <Textarea {...campo("observacoes")} rows={3} placeholder="Preferências, como gosta de ser chamado, melhor horário…" />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-branco-clinico p-4">
        <label className="flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={v.consentimentoMarketing}
            onChange={(e) => setV({ ...v, consentimentoMarketing: e.target.checked })}
            className="mt-0.5 size-4 accent-teal"
          />
          <span className="text-sm text-cinza-texto">
            <span className="flex items-center gap-1.5 font-medium">
              <ShieldCheck className="size-4 text-teal" /> Aceita receber novidades e campanhas da clínica
            </span>
            <span className="mt-0.5 block text-xs text-cinza-suave">
              Exigência da LGPD: só marque se o paciente concordou. Lembretes de consulta e retornos combinados não dependem disso.
            </span>
          </span>
        </label>
        {v.consentimentoMarketing && (
          <div className="mt-3 grid gap-1.5 sm:max-w-xs">
            <Label htmlFor="p-consentimentoCanal">Como o paciente concordou</Label>
            <Select {...campo("consentimentoCanal")}>
              {CANAIS.map((c) => (
                <option key={c.v} value={c.v}>
                  {c.r}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {erro && <p className="rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">{erro}</p>}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onFechar} disabled={pending}>
          Cancelar
        </Button>
        <Button variant="marca" onClick={salvar} disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {p ? "Salvar ficha" : "Cadastrar paciente"}
        </Button>
      </div>
    </div>
  );
}
