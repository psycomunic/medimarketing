import Link from "next/link";
import { ArrowLeft, CheckCircle2, Copy } from "lucide-react";
import { exigirModulo } from "@/lib/acesso";
import { getDuplicados } from "@/lib/supabase/pacientes";
import { GrupoDuplicado } from "@/components/app/pacientes/juntar";

export const metadata = { title: "Pacientes duplicados" };

export default async function DuplicadosPage() {
  const { role } = await exigirModulo("pacientes");
  const grupos = await getDuplicados();
  const podeJuntar = role === "gestor" || role === "super_admin";

  return (
    <div className="mx-auto grid max-w-4xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-8 sm:px-5 md:px-8 md:py-10">
      <Link href="/app/pacientes" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-cinza-suave hover:text-azul-medico">
        <ArrowLeft className="size-4" /> Pacientes
      </Link>
      <header className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-verde-menta text-teal">
          <Copy className="size-6" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl">Possíveis duplicados</h1>
          <p className="mt-1 text-cinza-suave">
            Fichas com o mesmo nome ou o mesmo e-mail. Confira e junte as que forem da mesma pessoa: as consultas e o histórico
            vão todos para a ficha que fica.
            {!podeJuntar && " Só o dono da clínica pode juntar fichas."}
          </p>
        </div>
      </header>

      {grupos.length ? (
        <div className="grid gap-4">
          {grupos.map((g) => (
            <GrupoDuplicado key={g.map((p) => p.id).join("|")} grupo={g} podeJuntar={podeJuntar} />
          ))}
        </div>
      ) : (
        <div className="grid justify-items-center gap-2 rounded-xl border border-border bg-white px-6 py-12 text-center shadow-soft">
          <CheckCircle2 className="size-10 text-teal" />
          <p className="font-heading text-lg font-semibold text-azul-medico">Nenhum duplicado encontrado</p>
          <p className="text-sm text-cinza-suave">Cada paciente tem uma ficha só.</p>
        </div>
      )}
    </div>
  );
}
