"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AtSign,
  Award,
  CheckCircle2,
  IdCard,
  KeyRound,
  Loader2,
  Mail,
  Phone,
  Stethoscope,
  User,
} from "lucide-react";
import type { Profile } from "@/lib/supabase/types";
import { alterarSenha, salvarPerfil } from "@/lib/actions/perfil";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const ESPECIALIDADES = [
  "Clínica médica",
  "Dermatologia",
  "Cardiologia",
  "Ginecologia e obstetrícia",
  "Pediatria",
  "Ortopedia",
  "Oftalmologia",
  "Otorrinolaringologia",
  "Endocrinologia",
  "Gastroenterologia",
  "Neurologia",
  "Psiquiatria",
  "Urologia",
  "Nutrologia",
  "Cirurgia plástica",
  "Medicina do esporte",
  "Odontologia",
  "Psicologia",
  "Nutrição",
  "Fisioterapia",
];

/** (11) 99999-9999 enquanto digita. */
function mascaraTelefone(bruto: string): string {
  const d = bruto.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function Grupo({ titulo, descricao, children }: { titulo: string; descricao?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-4 border-t border-border pt-5 first:border-t-0 first:pt-0 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-8">
      <div>
        <h3 className="text-sm font-semibold text-azul-medico">{titulo}</h3>
        {descricao && <p className="mt-1 text-xs leading-relaxed text-cinza-suave">{descricao}</p>}
      </div>
      <div className="grid min-w-0 gap-4">{children}</div>
    </div>
  );
}

function Campo({
  id,
  label,
  icone: Icone,
  children,
  dica,
}: {
  id: string;
  label: string;
  icone?: typeof User;
  children: React.ReactElement<{ className?: string }>;
  dica?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        {Icone && <Icone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-cinza-suave" />}
        {children}
      </div>
      {dica && <p className="text-xs text-cinza-suave">{dica}</p>}
    </div>
  );
}

export function FormPerfil({
  profile,
  email,
  demo,
}: {
  profile: Profile;
  /** E-mail de login, só para mostrar. */
  email: string | null;
  demo: boolean;
}) {
  const router = useRouter();
  const inicial = {
    nome: profile.nome ?? "",
    tratamento: (profile.tratamento ?? "") as "" | "Dr." | "Dra.",
    especialidade: profile.especialidade ?? "",
    crm: profile.crm ?? "",
    rqe: profile.rqe ?? "",
    telefone: profile.telefone ?? "",
    instagram: profile.instagram ?? "",
    bio: profile.bio ?? "",
  };
  const [v, setV] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pending, startTransition] = useTransition();

  const mudou = (Object.keys(inicial) as (keyof typeof inicial)[]).some((k) => v[k] !== inicial[k]);
  const atendente = profile.role === "secretaria";

  function set<K extends keyof typeof v>(k: K, valor: (typeof v)[K]) {
    setV({ ...v, [k]: valor });
    setSalvo(false);
  }

  function enviar() {
    setErro(null);
    setSalvo(false);
    startTransition(async () => {
      const res = await salvarPerfil(v);
      if (!res.ok) {
        setErro(res.erro);
        router.refresh();
        return;
      }
      setSalvo(true);
      router.refresh();
    });
  }

  const comTitulo = [v.tratamento, v.nome.trim()].filter(Boolean).join(" ");

  return (
    <section className="rounded-xl border border-border bg-white shadow-soft">
      <header className="border-b border-border px-6 py-4">
        <h2 className="text-lg font-semibold text-azul-medico">Editar perfil</h2>
        <p className="mt-0.5 text-sm text-cinza-suave">
          É o que aparece para a sua equipe, na agenda e nas mensagens das consultas.
        </p>
      </header>

      <div className="grid gap-6 px-6 py-6">
        <Grupo titulo="Identificação" descricao="Como você aparece no painel e para o paciente.">
          <div className="grid gap-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
            <div className="grid gap-1.5">
              <Label htmlFor="tratamento">Tratamento</Label>
              <Select
                id="tratamento"
                value={v.tratamento}
                onChange={(e) => set("tratamento", e.target.value as typeof v.tratamento)}
              >
                <option value="">Nenhum</option>
                <option value="Dr.">Dr.</option>
                <option value="Dra.">Dra.</option>
              </Select>
            </div>
            <Campo id="nome" label="Nome completo" icone={User}>
              <Input
                id="nome"
                value={v.nome}
                onChange={(e) => set("nome", e.target.value)}
                placeholder="Seu nome completo"
                className="pl-10"
              />
            </Campo>
          </div>
          {comTitulo && (
            <p className="-mt-1 text-xs text-cinza-suave">
              Aparece como <strong className="text-azul-medico">{comTitulo}</strong>
            </p>
          )}
        </Grupo>

        {!atendente && (
          <Grupo titulo="Atuação" descricao="Especialidade e registros profissionais.">
            <Campo id="especialidade" label="Especialidade" icone={Stethoscope}>
              <Input
                id="especialidade"
                list="especialidades"
                value={v.especialidade}
                onChange={(e) => set("especialidade", e.target.value)}
                placeholder="Escolha ou digite"
                className="pl-10"
              />
            </Campo>
            <datalist id="especialidades">
              {ESPECIALIDADES.map((e) => (
                <option key={e} value={e} />
              ))}
            </datalist>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo id="crm" label="CRM" icone={IdCard}>
                <Input
                  id="crm"
                  value={v.crm}
                  onChange={(e) => set("crm", e.target.value.toUpperCase())}
                  placeholder="CRM/SP 000000"
                  className="pl-10"
                />
              </Campo>
              <Campo id="rqe" label="RQE (opcional)" icone={Award}>
                <Input
                  id="rqe"
                  value={v.rqe}
                  onChange={(e) => set("rqe", e.target.value)}
                  placeholder="00000"
                  className="pl-10"
                />
              </Campo>
            </div>
          </Grupo>
        )}

        <Grupo titulo="Contato" descricao="O telefone recebe os avisos da agenda pelo WhatsApp.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="telefone" label="WhatsApp" icone={Phone}>
              <Input
                id="telefone"
                value={v.telefone}
                onChange={(e) => set("telefone", mascaraTelefone(e.target.value))}
                placeholder="(11) 99999-9999"
                inputMode="tel"
                className="pl-10"
              />
            </Campo>
            <Campo id="instagram" label="Instagram" icone={AtSign}>
              <Input
                id="instagram"
                value={v.instagram}
                onChange={(e) => set("instagram", e.target.value)}
                placeholder="@seuperfil"
                className="pl-10"
              />
            </Campo>
          </div>
          <Campo id="email-conta" label="E-mail de acesso" icone={Mail} dica="É o seu login. Para trocar, fale com a equipe Medi Marketing.">
            <Input id="email-conta" value={email ?? ""} readOnly disabled className="pl-10" />
          </Campo>
        </Grupo>

        <Grupo titulo="Sobre você" descricao="Uma apresentação curta, em poucas linhas.">
          <div className="grid gap-1.5">
            <Label htmlFor="bio">Apresentação</Label>
            <Textarea
              id="bio"
              value={v.bio}
              onChange={(e) => set("bio", e.target.value.slice(0, 400))}
              placeholder={
                atendente
                  ? "Ex.: Cuido da agenda e do atendimento aos pacientes da clínica."
                  : "Ex.: Dermatologista com 10 anos de experiência em dermatologia clínica e estética."
              }
              className="min-h-[96px]"
            />
            <p className="text-right text-xs text-cinza-suave">{v.bio.length}/400</p>
          </div>
        </Grupo>
      </div>

      <footer className="flex flex-col-reverse gap-3 rounded-b-xl border-t border-border bg-branco-clinico px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-h-5 text-sm">
          {erro ? (
            <span className="text-coral">{erro}</span>
          ) : salvo ? (
            <span className="flex items-center gap-1.5 text-sucesso">
              <CheckCircle2 className="size-4" /> Perfil atualizado.
            </span>
          ) : demo ? (
            <span className="text-xs text-cinza-suave">Modo demonstração: as alterações não são salvas.</span>
          ) : mudou ? (
            <span className="text-xs text-alerta">Você tem alterações não salvas.</span>
          ) : null}
        </div>
        <div className="flex gap-2">
          {mudou && (
            <Button variant="ghost" onClick={() => setV(inicial)} disabled={pending}>
              Descartar
            </Button>
          )}
          <Button variant="marca" onClick={enviar} disabled={pending || !mudou}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Salvar alterações
          </Button>
        </div>
      </footer>
    </section>
  );
}

/* ---------------------------- Troca de senha ---------------------------- */

/** Força da senha em quatro faixas, para dar retorno enquanto a pessoa digita. */
function forcaSenha(senha: string): { nivel: number; rotulo: string; cor: string } {
  let pontos = 0;
  if (senha.length >= 8) pontos++;
  if (senha.length >= 12) pontos++;
  if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) pontos++;
  if (/\d/.test(senha)) pontos++;
  if (/[^A-Za-z0-9]/.test(senha)) pontos++;

  if (pontos <= 1) return { nivel: 1, rotulo: "fraca", cor: "bg-coral" };
  if (pontos === 2) return { nivel: 2, rotulo: "razoável", cor: "bg-alerta" };
  if (pontos === 3) return { nivel: 3, rotulo: "boa", cor: "bg-teal" };
  return { nivel: 4, rotulo: "forte", cor: "bg-sucesso" };
}

export function FormSenha({ demo }: { demo: boolean }) {
  const [v, setV] = useState({ senhaAtual: "", novaSenha: "", confirmacao: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pending, startTransition] = useTransition();

  const forca = forcaSenha(v.novaSenha);

  function enviar() {
    setErro(null);
    setSalvo(false);
    startTransition(async () => {
      const res = await alterarSenha(v);
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      setSalvo(true);
      setV({ senhaAtual: "", novaSenha: "", confirmacao: "" });
    });
  }

  const campos = [
    { chave: "senhaAtual", label: "Senha atual", auto: "current-password" },
    { chave: "novaSenha", label: "Nova senha", auto: "new-password" },
    { chave: "confirmacao", label: "Confirme a nova senha", auto: "new-password" },
  ] as const;

  return (
    <section className="mt-6 rounded-lg border border-border bg-white p-6 shadow-soft">
      <div className="flex items-center gap-2">
        <KeyRound className="size-5 text-teal" />
        <h2 className="text-lg font-semibold text-azul-medico">Trocar senha</h2>
      </div>
      <p className="mt-1 text-sm text-cinza-suave">
        Pedimos a senha atual porque ela é a única prova de que é você mesmo
        de frente para a tela.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {campos.map((c) => (
          <div key={c.chave} className="grid gap-1.5">
            <Label htmlFor={c.chave}>{c.label}</Label>
            <Input
              id={c.chave}
              type="password"
              autoComplete={c.auto}
              value={v[c.chave]}
              onChange={(e) => setV({ ...v, [c.chave]: e.target.value })}
              placeholder="••••••••"
            />
          </div>
        ))}
      </div>

      {v.novaSenha && (
        <div className="mt-3">
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((n) => (
              <span
                key={n}
                className={`h-1.5 flex-1 rounded-full ${
                  n <= forca.nivel ? forca.cor : "bg-border"
                }`}
              />
            ))}
          </div>
          <p className="mt-1.5 text-xs text-cinza-suave">
            Senha {forca.rotulo}. Misture maiúsculas, números e um símbolo para
            ficar mais difícil de adivinhar.
          </p>
        </div>
      )}

      {erro && (
        <p className="mt-4 rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">{erro}</p>
      )}
      {salvo && (
        <p className="mt-4 flex items-center gap-2 rounded-md bg-sucesso/10 px-3 py-2 text-sm text-sucesso">
          <CheckCircle2 className="size-4" /> Senha alterada.
        </p>
      )}
      {demo && (
        <p className="mt-4 rounded-md border border-dashed border-border bg-branco-clinico px-3 py-2 text-xs text-cinza-suave">
          Modo demonstração: a senha das contas de teste é fixa e não pode ser
          trocada.
        </p>
      )}

      <div className="mt-5 flex justify-end">
        <Button
          variant="outline"
          onClick={enviar}
          disabled={pending || !v.senhaAtual || !v.novaSenha || !v.confirmacao}
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          Alterar senha
        </Button>
      </div>
    </section>
  );
}
