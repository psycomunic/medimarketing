import { Badge } from "@/components/ui/badge";
import { Clock, Video, MapPin } from "lucide-react";

/** Mockup estático da agenda usado na landing (ilustração de produto). */
const consultas = [
  { hora: "08:30", nome: "Ana Ribeiro", tipo: "Primeira consulta", status: "confirmada" as const, canal: "presencial" },
  { hora: "09:15", nome: "Carlos Menezes", tipo: "Retorno", status: "confirmada" as const, canal: "presencial" },
  { hora: "10:00", nome: "Juliana Faria", tipo: "Teleconsulta", status: "pendente" as const, canal: "video" },
  { hora: "11:00", nome: "Marcos Lima", tipo: "Retorno", status: "confirmada" as const, canal: "presencial" },
];

const rotulo: Record<string, string> = {
  confirmada: "Confirmada",
  pendente: "Pendente",
};

export function AgendaMockup() {
  return (
    <div className="rounded-2xl border border-border bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-teal">
            Hoje
          </p>
          <p className="font-heading text-lg font-semibold text-azul-medico">
            Quinta, 10 de julho
          </p>
        </div>
        <span className="rounded-full bg-verde-menta px-3 py-1 text-sm font-semibold text-azul-medico">
          4 consultas
        </span>
      </div>

      <div className="space-y-2.5">
        {consultas.map((c) => (
          <div
            key={c.hora}
            className="flex items-center gap-3 rounded-xl border border-border bg-branco-clinico p-3"
          >
            <div className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-white py-1.5 shadow-sm">
              <span className="text-sm font-bold text-azul-medico">{c.hora}</span>
              <Clock className="size-3 text-cinza-suave" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-cinza-texto">{c.nome}</p>
              <p className="flex items-center gap-1 truncate text-xs text-cinza-suave">
                {c.canal === "video" ? (
                  <Video className="size-3" />
                ) : (
                  <MapPin className="size-3" />
                )}
                {c.tipo}
              </p>
            </div>
            <Badge variant={c.status}>{rotulo[c.status]}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
