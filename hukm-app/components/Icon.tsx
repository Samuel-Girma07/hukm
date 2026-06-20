/**
 * HUKM — Icon component (Phosphor-backed, Material-Symbols-compatible API).
 *
 * Renders @phosphor-icons/react glyphs at `weight="regular"` by default.
 * The legacy `<Icon name="…">` callsites work unchanged because every
 * Material-Symbol name still resolves through the table below.
 *
 * Rules
 *   - Pass a Material-Symbols name (e.g. "gavel", "arrow_forward").
 *   - `size` is in px (square).
 *   - `filled` switches to Phosphor's `fill` weight.
 *   - `weight` accepts the legacy 100–700 number for back-compat; we
 *     translate it to a Phosphor weight string.
 *   - Unknown names render a 1px tinted dot — visible enough during
 *     QA, never a dashed placeholder square in production.
 */

import {
  ArrowLeft,
  ArrowRight,
  ArrowsClockwise,
  ArrowsLeftRight,
  Bank,
  Books,
  Brain,
  CaretDown,
  CaretRight,
  CaretUp,
  CaretUpDown,
  ChartBar,
  ChartLineUp,
  ChatsCircle,
  Check,
  CloudSlash,
  CheckCircle,
  Clock,
  Cpu,
  Envelope,
  Eye,
  FilePdf,
  FileText,
  Flag,
  GraduationCap,
  Gavel,
  Gear,
  Headset,
  House,
  Info,
  Lightning,
  List,
  MagnifyingGlass,
  MagnifyingGlassMinus,
  MapTrifold,
  Paperclip,
  PaperPlaneTilt,
  Phone,
  Plus,
  Scales,
  SealCheck,
  ShareNetwork,
  SignOut,
  SlidersHorizontal,
  ThumbsDown,
  ThumbsUp,
  Translate,
  Trash,
  Warning,
  WarningCircle,
  WarningOctagon,
  X,
  type Icon as PhosphorIcon,
  type IconWeight,
} from "@phosphor-icons/react";

interface IconProps {
  name: string;
  /** Pixel size for both width/height. Default 20. */
  size?: number;
  /** Renders the Phosphor `fill` weight. Default false. */
  filled?: boolean;
  /** Legacy 100..700 weight; mapped to a Phosphor weight string. */
  weight?: number;
  className?: string;
  ariaLabel?: string;
}

/** Material-Symbols name → Phosphor component. */
const ICONS: Record<string, PhosphorIcon> = {
  // navigation / chevrons
  arrow_back: ArrowLeft,
  arrow_forward: ArrowRight,
  chevron_right: CaretRight,
  expand_more: CaretDown,
  expand_less: CaretUp,
  unfold_more: CaretUpDown,
  home: House,

  // actions / state
  add: Plus,
  check: Check,
  check_circle: CheckCircle,
  close: X,
  delete: Trash,
  refresh: ArrowsClockwise,
  send: PaperPlaneTilt,
  search: MagnifyingGlass,
  search_off: MagnifyingGlassMinus,
  cloud_off: CloudSlash,
  attach_file: Paperclip,
  tune: SlidersHorizontal,
  settings: Gear,
  thumb_up: ThumbsUp,
  thumb_down: ThumbsDown,

  // status / alerts
  info: Info,
  warning: Warning,
  error: WarningCircle,
  report: WarningOctagon,
  verified: SealCheck,

  // contact / share
  call: Phone,
  mail: Envelope,
  share: ShareNetwork,
  visibility: Eye,
  forum: ChatsCircle,

  // domain / brand
  gavel: Gavel,
  flag: Flag,
  balance: Scales,
  route: MapTrifold,
  psychology: Brain,
  bolt: Lightning,
  speed: Lightning,
  brain: Brain,
  analytics: ChartLineUp,
  bar_chart: ChartBar,
  compare_arrows: ArrowsLeftRight,
  account_balance: Bank,
  school: GraduationCap,
  auto_stories: Books,

  // chrome / utility
  menu: List,
  translate: Translate,
  description: FileText,
  picture_as_pdf: FilePdf,
  schedule: Clock,
  support_agent: Headset,
  logout: SignOut,
  model: Cpu,
};

function resolveWeight(weight: number | undefined, filled: boolean): IconWeight {
  if (filled) return "fill";
  if (weight === undefined) return "regular";
  if (weight <= 200) return "thin";
  if (weight <= 350) return "light";
  if (weight <= 500) return "regular";
  if (weight <= 600) return "bold";
  return "bold";
}

export function Icon({
  name,
  size = 20,
  filled = false,
  weight,
  className = "",
  ariaLabel,
}: IconProps): React.ReactElement {
  const Component = ICONS[name];
  const phosphorWeight = resolveWeight(weight, filled);

  if (!Component) {
    /* Unmapped name — render a tiny tinted dot. Visible to QA but
       indistinguishable from intentional empty space in production. */
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(`[Icon] missing mapping for "${name}"`);
    }
    return (
      <span
        role="img"
        aria-label={ariaLabel ?? `missing icon: ${name}`}
        className={`inline-block shrink-0 align-middle rounded-full bg-current opacity-30 ${className}`}
        style={{ width: 4, height: 4, margin: (size - 4) / 2 }}
      />
    );
  }

  return (
    <Component
      size={size}
      weight={phosphorWeight}
      className={`inline-block shrink-0 align-middle ${className}`}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    />
  );
}
