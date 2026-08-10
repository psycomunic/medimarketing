"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, CheckCircle2, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { enviarLead } from "@/lib/actions/leads";
import { faixasFaturamento } from "@/lib/conteudo";

const schema = z.object({
  nome: z.string().min(2, "Informe seu nome"),
  especialidade: z.string().min(2, "Informe sua especialidade"),
  whatsapp: z
    .string()
    .min(8, "Informe um WhatsApp válido")
    .regex(/[0-9]/, "Use apenas números com DDD"),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  cidade: z.string().min(2, "Informe sua cidade"),
  faturamento: z.string().optional(),
  equipeComercial: z.enum(["sim", "nao", "nao_informado"]).default("nao_informado"),
  consentimento: z.literal(true, {
    errorMap: () => ({ message: "É preciso concordar para enviar." }),
  }),
});

type FormData = z.infer<typeof schema>;

/** Formulário de diagnóstico — grava o lead direto na tabela `leads`. */
export function LeadForm({ origem = "landing" }: { origem?: string }) {
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { equipeComercial: "nao_informado" },
  });

  function onSubmit(data: FormData) {
    setErro(null);
    startTransition(async () => {
      const res = await enviarLead({
        nome: data.nome,
        especialidade: data.especialidade,
        whatsapp: data.whatsapp,
        email: data.email ?? "",
        cidade: data.cidade,
        faturamento_medio: data.faturamento ?? "",
        tem_equipe_comercial:
          data.equipeComercial === "nao_informado"
            ? undefined
            : data.equipeComercial === "sim",
        origem,
        consentimento: data.consentimento,
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
          Nosso time vai falar com você pelo WhatsApp em breve para agendar o
          diagnóstico. Enquanto isso, respira — o resto é com a gente.
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
          {errors.especialidade && (
            <span className="text-xs text-coral">
              {errors.especialidade.message}
            </span>
          )}
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
          {errors.cidade && (
            <span className="text-xs text-coral">{errors.cidade.message}</span>
          )}
        </div>

        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="email">
            E-mail <span className="text-cinza-suave">(opcional)</span>
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="voce@clinica.com.br"
            {...register("email")}
          />
          {errors.email && (
            <span className="text-xs text-coral">{errors.email.message}</span>
          )}
        </div>

        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="faturamento">Faturamento médio mensal</Label>
          <Select id="faturamento" defaultValue="" {...register("faturamento")}>
            <option value="" disabled>
              Selecione uma faixa
            </option>
            {faixasFaturamento.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
        </div>

        <fieldset className="grid gap-2 sm:col-span-2">
          <legend className="mb-1 text-sm font-medium text-cinza-texto">
            Já tem equipe comercial ou secretária que faz o agendamento?
          </legend>
          <div className="flex flex-wrap gap-4">
            {[
              { valor: "sim", rotulo: "Sim, já tenho" },
              { valor: "nao", rotulo: "Não tenho" },
              { valor: "nao_informado", rotulo: "Prefiro não informar" },
            ].map((op) => (
              <label
                key={op.valor}
                className="flex cursor-pointer items-center gap-2 text-sm text-cinza-suave"
              >
                <input
                  type="radio"
                  value={op.valor}
                  className="size-4 accent-teal"
                  {...register("equipeComercial")}
                />
                {op.rotulo}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {/* Consentimento LGPD — registrado junto com o lead */}
      <label className="flex cursor-pointer items-start gap-2.5 text-xs text-cinza-suave">
        <input
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 accent-teal"
          {...register("consentimento")}
        />
        <span>
          Autorizo a Medi Marketing a entrar em contato pelos dados informados e
          concordo com a{" "}
          <Link
            href="/privacidade"
            className="font-semibold text-teal hover:underline"
          >
            Política de Privacidade
          </Link>
          .
        </span>
      </label>
      {errors.consentimento && (
        <span className="text-xs text-coral">{errors.consentimento.message}</span>
      )}

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
            Quero meu diagnóstico gratuito <Send className="size-5" />
          </>
        )}
      </Button>
    </form>
  );
}
