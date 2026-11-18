import {
  Award, BookOpen, CalendarCheck, Carrot, ChartLine, ChefHat, Cookie, Crown, Droplet, Dumbbell, Flag, Flame,
  Footprints, Gem, Heart, HeartPulse, Medal, Moon, Mountain, NotebookPen, PersonStanding, Scale, ScanBarcode,
  ShieldCheck, Sparkles, Sprout, Star, Swords, Target, Trophy, Utensils, Waves, Wheat, Zap, Leaf, Apple, Coffee,
  Bike, Brain, Bed, Sun, Salad, Timer, Smile, type LucideIcon, type LucideProps,
} from 'lucide-react';

/**
 * Named icons that can be stored in the database (quests, achievements).
 * Keep keys stable: they are persisted.
 */
export const ICONS: Record<string, LucideIcon> = {
  award: Award,
  'book-open': BookOpen,
  'calendar-check': CalendarCheck,
  carrot: Carrot,
  'line-chart': ChartLine,
  'chef-hat': ChefHat,
  cookie: Cookie,
  crown: Crown,
  droplet: Droplet,
  dumbbell: Dumbbell,
  flag: Flag,
  flame: Flame,
  footprints: Footprints,
  gem: Gem,
  heart: Heart,
  'heart-pulse': HeartPulse,
  medal: Medal,
  moon: Moon,
  mountain: Mountain,
  'notebook-pen': NotebookPen,
  'person-standing': PersonStanding,
  scale: Scale,
  'scan-barcode': ScanBarcode,
  'shield-check': ShieldCheck,
  sparkles: Sparkles,
  sprout: Sprout,
  star: Star,
  swords: Swords,
  target: Target,
  trophy: Trophy,
  utensils: Utensils,
  waves: Waves,
  wheat: Wheat,
  zap: Zap,
  leaf: Leaf,
  apple: Apple,
  coffee: Coffee,
  bike: Bike,
  brain: Brain,
  bed: Bed,
  sun: Sun,
  salad: Salad,
  timer: Timer,
  smile: Smile,
};

/** Icons offered in the quest editor. */
export const QUEST_ICON_CHOICES = [
  'star', 'swords', 'dumbbell', 'footprints', 'bike', 'heart-pulse', 'person-standing', 'mountain',
  'droplet', 'carrot', 'salad', 'apple', 'chef-hat', 'cookie', 'coffee', 'moon', 'bed', 'sun',
  'book-open', 'brain', 'timer', 'smile', 'target', 'flag', 'sparkles', 'leaf',
];

export function Icon({ name, ...props }: { name: string } & LucideProps) {
  const C = ICONS[name] ?? Star;
  return <C {...props} />;
}
