"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, CheckCircle2, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { enviarLead } from "@/lib/actions/leads";

const schema = z.object({
  nome: z.string().min(2, "Informe seu nome"),
  especialidade: z.string().optional(),
  whatsapp: z
    .string()
    .min(8, "Informe um WhatsApp válido")
    .regex(/[0-9]/, "Use apenas números com DDD"),
  cidade: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function LeadForm({ origem = "landing" }: { origem?: string }) {
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  function onSubmit(data: FormData) {
    setErro(null);
    startTransition(async () => {
      const res = await enviarLead({
        nome: data.nome,
        especialidade: data.especialidade ?? "",
        whatsapp: data.whatsapp,
        cidade: data.cidade ?? "",
        origem,
      });
      if (res.ok) setEnviado(true);
      else setErro(res.erro);
    });
  }

  if (enviado) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg bg-white p-8 text-center shadow-card">
        <CheckCircle2 className="size-12 text-sucesso" />
        <h3 className="text-xl font-semibold text-azul-medico">
          Recebemos seu contato!
        </h3>
        <p className="text-cinza-suave">
          Nosso time vai falar com você pelo WhatsApp em breve. Enquanto isso,
          respira — o resto é com a gente.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="grid gap-4 rounded-lg bg-white p-6 shadow-card sm:p-8"
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="nome">Nome</Label>
          <Input id="nome" placeholder="Dr(a). seu nome" {...register("nome")} />
          {errors.nome && (
            <span className="text-xs text-coral">{errors.nome.message}</span>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="especialidade">Especialidade</Label>
          <Input
            id="especialidade"
            placeholder="Ex.: Dermatologia"
            {...register("especialidade")}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="whatsapp">WhatsApp</Label>
          <Input
            id="whatsapp"
            inputMode="tel"
            placeholder="(11) 99999-9999"
            {...register("whatsapp")}
          />
          {errors.whatsapp && (
            <span className="text-xs text-coral">{errors.whatsapp.message}</span>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cidade">Cidade</Label>
          <Input id="cidade" placeholder="Sua cidade" {...register("cidade")} />
        </div>
      </div>

      {erro && (
        <p className="rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">
          {erro}
        </p>
      )}

      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="size-5 animate-spin" /> Enviando...
          </>
        ) : (
          <>
            Quero começar agora <Send className="size-5" />
          </>
        )}
      </Button>
      <p className="text-center text-xs text-cinza-suave">
        Ao enviar, você concorda em ser contatado pela nossa equipe. Seus dados
        ficam seguros. {/* TODO: link para Política de Privacidade */}
      </p>
    </form>
  );
}
