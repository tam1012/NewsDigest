import { Globe, MessageCircle, Rss, TrendingUp, Youtube } from 'lucide-svelte'
import type { Source } from '$lib/types'

const relativeTime = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

export function formatRelativeTime(value: string | null) {
  if (!value) return 'Never fetched'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'

  const diffMs = date.getTime() - Date.now()
  const absMs = Math.abs(diffMs)
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  if (absMs < hour)
    return relativeTime.format(Math.round(diffMs / minute), 'minute')
  if (absMs < day)
    return relativeTime.format(Math.round(diffMs / hour), 'hour')
  return relativeTime.format(Math.round(diffMs / day), 'day')
}

export function getTypeIcon(type: Source['type']) {
  const map: Record<
    string,
    { icon: any; color: string; label: string }
  > = {
    rss: {
      icon: Rss,
      color: 'text-amber-600 dark:text-amber-400',
      label: 'RSS',
    },
    reddit: {
      icon: null,
      color: 'text-orange-600 dark:text-orange-400',
      label: 'Reddit',
    },
    youtube: {
      icon: Youtube,
      color: 'text-red-600 dark:text-red-400',
      label: 'YouTube',
    },
    voz: {
      icon: MessageCircle,
      color: 'text-sky-600 dark:text-sky-400',
      label: 'VOZ',
    },
    'github-trending': {
      icon: TrendingUp,
      color: 'text-zinc-700 dark:text-zinc-300',
      label: 'GitHub',
    },
    html: {
      icon: Globe,
      color: 'text-emerald-600 dark:text-emerald-400',
      label: 'HTML',
    },
  }
  return map[type] ?? map.html
}

export type SourcePreview = {
  resolved_url: string
  detected_type: Source['type']
  detection_method: string
  requested_url: string
}
