import { Coffee, Flame, Gift, Landmark, Sailboat, TreePalm, Utensils, Wallet, type LucideIcon } from 'lucide-react'
import { motion } from 'motion/react'
import type { Category } from '@/data/places'
import { useLang } from '@/app/i18n'

export const categoryMeta: Record<Category, { icon: LucideIcon; bg: string; fg: string }> = {
  Kainan: { icon: Utensils, bg: '#FF6A00', fg: '#2B130A' },
  Pasyalan: { icon: Landmark, bg: '#1B8A3A', fg: '#FFFFFF' },
  'Budget Meals': { icon: Wallet, bg: '#FFB400', fg: '#2B130A' },
  Kapihan: { icon: Coffee, bg: '#6B3A22', fg: '#FFFFFF' },
  'Street Food': { icon: Flame, bg: '#D32F2F', fg: '#FFFFFF' },
  Resorts: { icon: TreePalm, bg: '#0B7F96', fg: '#FFFFFF' },
  Tours: { icon: Sailboat, bg: '#C84A00', fg: '#FFFFFF' },
  Pasalubong: { icon: Gift, bg: '#C2185B', fg: '#FFFFFF' },
}

export const categories = Object.keys(categoryMeta) as Category[]

export function CategoryTile({ category, onClick }: { category: Category; onClick?: () => void }) {
  const m = categoryMeta[category]
  const Icon = m.icon
  const { t } = useLang()
  const labels: Record<Category, [string, string]> = {
    Kainan: ['Kainan', 'Dining'],
    Pasyalan: ['Pasyalan', 'Places'],
    'Budget Meals': ['Tipid', 'Budget'],
    Kapihan: ['Kapihan', 'Cafes'],
    'Street Food': ['Pagkaing kalye', 'Street food'],
    Resorts: ['Mga resort', 'Resorts'],
    Tours: ['Mga paglilibot', 'Tours'],
    Pasalubong: ['Pasalubong', 'Souvenirs'],
  }
  return (
    <motion.button whileTap={{ scale: 0.94 }} onClick={onClick} className="flex min-w-0 flex-col items-center gap-1.5 rounded-2xl py-1">
      <span
        className="flex aspect-square w-full max-w-[64px] items-center justify-center rounded-[18px] shadow-[inset_0_-3px_0_rgba(0,0,0,0.12)]"
        style={{ background: m.bg, color: m.fg }}
      >
        <Icon size={28} strokeWidth={1.75} />
      </span>
      <span className="w-full truncate text-center font-display text-[12.5px] font-medium leading-tight text-fg">{t(...labels[category])}</span>
    </motion.button>
  )
}
