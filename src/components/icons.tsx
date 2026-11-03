import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Calendar,
  Check,
  ChevronLeft,
  Copy,
  ChevronRight,
  Download,
  FileText,
  type LucideIcon,
  Minus,
  MousePointer2,
  Move,
  PenLine,
  Plus,
  RotateCw,
  ScanSearch,
  Trash2,
  Type,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

/*
  Single import point for icons. Screens reference these app-level names so
  they stay decoupled from lucide's exact export names; swapping the underlying
  icon is a one-line change here. Sizing and color are the caller's job via
  token classes, never set in this module.
*/
export const Icons = {
  select: MousePointer2,
  upload: Upload,
  download: Download,
  file: FileText,
  plus: Plus,
  close: X,
  check: Check,
  copy: Copy,
  minus: Minus,
  move: Move,
  signature: PenLine,
  type: Type,
  calendar: Calendar,
  trash: Trash2,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  zoomIn: ZoomIn,
  zoomOut: ZoomOut,
  rotate: RotateCw,
  scan: ScanSearch,
  alignLeft: AlignLeft,
  alignCenter: AlignCenter,
  alignRight: AlignRight,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof Icons;

export type { LucideIcon, LucideProps } from "lucide-react";
