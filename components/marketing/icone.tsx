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
  Bot,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  CalendarX,
  Globe,
  GraduationCap,
  Headset,
  HeartHandshake,
  Hourglass,
  Layers,
  LayoutDashboard,
  LineChart,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  MessageSquareX,
  MessagesSquare,
  MonitorSmartphone,
  MousePointerClick,
  PenLine,
  PhoneMissed,
  Repeat,
  ScrollText,
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
  ScrollText,
  MessageCircle,
  LayoutDashboard,
  Banknote,
  BarChart3,
  BellRing,
  Bot,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  CalendarX,
  Globe,
  GraduationCap,
  Headset,
  HeartHandshake,
  Hourglass,
  Layers,
  LineChart,
  Mail,
  MapPin,
  Megaphone,
  MessageSquareX,
  MessagesSquare,
  MonitorSmartphone,
  MousePointerClick,
  PenLine,
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
