import { User, Stethoscope, Phone, IdCard } from "lucide-react";
import { getSessao } from "@/lib/supabase/queries";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Perfil" };

// FASE 2: edição de perfil (nome, especialidade, CRM, telefone, foto).
// Campos exibidos em modo leitura; a persistência será conectada na Fase 2.
export default async function PerfilPage() {
  const { profile } = await getSessao();

  const campos = [
    { id: "nome", label: "Nome", icon: User, valor: profile?.nome ?? "", ph: "Seu nome" },
    { id: "especialidade", label: "Especialidade", icon: Stethoscope, valor: profile?.especialidade ?? "", ph: "Ex.: Dermatologia" },
    { id: "crm", label: "CRM", icon: IdCard, valor: profile?.crm ?? "", ph: "CRM/UF 000000" },
    { id: "telefone", label: "Telefone", icon: Phone, valor: profile?.telefone ?? "", ph: "(11) 99999-9999" },
  ];

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 md:px-8 md:py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl">Meu perfil</h1>
          <p className="mt-1 text-cinza-suave">Seus dados profissionais.</p>
        </div>
        <span className="rounded-full bg-alerta/12 px-3 py-1 text-xs font-semibold text-alerta">
          Edição em breve
        </span>
      </header>

      <div className="mt-8 rounded-lg border border-border bg-white p-6 shadow-soft">
        <div className="mb-6 flex items-center gap-4">
          <span className="grid size-16 place-items-center rounded-full bg-azul-medico text-xl font-semibold text-white">
            {(profile?.nome ?? "M").charAt(0).toUpperCase()}
          </span>
          <div>
            <p className="font-heading text-lg font-semibold text-azul-medico">
              {profile?.nome || "Médico(a)"}
            </p>
            <p className="text-sm text-cinza-suave">
              {profile?.especialidade || "Especialidade não informada"}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {campos.map((c) => (
            <div key={c.id} className="grid gap-1.5">
              <Label htmlFor={c.id}>{c.label}</Label>
              <div className="relative">
                <c.icon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-cinza-suave" />
                <Input
                  id={c.id}
                  defaultValue={c.valor}
                  placeholder={c.ph}
                  className="pl-10"
                  disabled
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="marca" disabled>
            Salvar alterações
          </Button>
        </div>
      </div>
    </div>
  );
}
