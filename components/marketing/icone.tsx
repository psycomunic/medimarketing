/**
 * Mapa nome -> ícone do lucide.
 *
 * O conteúdo do site (lib/conteudo.ts) guarda apenas o nome do ícone em
 * texto, para que a revisão de copy não precise mexer em imports. Este
 * componente resolve o nome para o componente real (sem import dinâmico,
 * que atrapalharia o tree-shaking).
 */
import {
  Banknote,
  BarChart3,
  BellRing,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  CalendarX,
  GraduationCap,
  Headset,
  HeartHandshake,
  Hourglass,
  Layers,
  LineChart,
  Mail,
  Megaphone,
  MessageSquareX,
  MessagesSquare,
  MonitorSmartphone,
  MousePointerClick,
  PhoneMissed,
  Repeat,
  ShieldCheck,
  Smartphone,
  Stethoscope,
  Target,
  TrendingDown,
  Unplug,
  UserRoundX,
  Users,
  type LucideIcon,
} from "lucide-react";

const ICONES: Record<string, LucideIcon> = {
  Banknote,
  BarChart3,
  BellRing,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  CalendarX,
  GraduationCap,
  Headset,
  HeartHandshake,
  Hourglass,
  Layers,
  LineChart,
  Mail,
  Megaphone,
  MessageSquareX,
  MessagesSquare,
  MonitorSmartphone,
  MousePointerClick,
  PhoneMissed,
  Repeat,
  ShieldCheck,
  Smartphone,
  Stethoscope,
  Target,
  TrendingDown,
  Unplug,
  UserRoundX,
  Users,
};

export function Icone({
  nome,
  className,
}: {
  nome: string;
  className?: string;
}) {
  const Componente = ICONES[nome] ?? ShieldCheck;
  return <Componente className={className} />;
}
