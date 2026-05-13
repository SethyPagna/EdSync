import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  const remainingMins = mins % 60
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}

export function formatRelativeTime(dateString: string): string {
  const now = new Date()
  const date = new Date(dateString)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(dateString)
}

export function getMasteryColor(mastery: number): string {
  if (mastery >= 0.8) return 'text-edsync-emerald'
  if (mastery >= 0.6) return 'text-edsync-amber'
  if (mastery >= 0.4) return 'text-yellow-400'
  return 'text-edsync-red'
}

export function getMasteryBg(mastery: number): string {
  if (mastery >= 0.8) return 'bg-edsync-emerald/20 border-edsync-emerald/30'
  if (mastery >= 0.6) return 'bg-edsync-amber/20 border-edsync-amber/30'
  if (mastery >= 0.4) return 'bg-yellow-500/20 border-yellow-500/30'
  return 'bg-edsync-red/20 border-edsync-red/30'
}

export function getStatusBadge(status: string): { label: string; className: string } {
  const map: Record<string, { label: string; className: string }> = {
    draft: { label: 'Draft', className: 'bg-edsync-muted/50 text-edsync-subtle' },
    published: { label: 'Published', className: 'bg-edsync-emerald/20 text-edsync-emerald border border-edsync-emerald/30' },
    archived: { label: 'Archived', className: 'bg-edsync-muted/30 text-edsync-subtle/50' },
    not_started: { label: 'Not Started', className: 'bg-edsync-muted/30 text-edsync-subtle' },
    in_progress: { label: 'In Progress', className: 'bg-edsync-blue/20 text-edsync-blue border border-edsync-blue/30' },
    completed: { label: 'Completed', className: 'bg-edsync-emerald/20 text-edsync-emerald border border-edsync-emerald/30' },
  }
  return map[status] || { label: status, className: 'bg-edsync-muted/30 text-edsync-subtle' }
}

export function getDifficultyColor(difficulty: string): string {
  const map: Record<string, string> = {
    beginner: 'text-edsync-emerald',
    intermediate: 'text-edsync-amber',
    advanced: 'text-edsync-red',
  }
  return map[difficulty] || 'text-edsync-subtle'
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

export function generateInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function getAlertColor(alertType: string): string {
  const map: Record<string, string> = {
    struggling: 'text-edsync-red border-edsync-red/30 bg-edsync-red/10',
    intervention: 'text-edsync-amber border-edsync-amber/30 bg-edsync-amber/10',
    achievement: 'text-edsync-emerald border-edsync-emerald/30 bg-edsync-emerald/10',
    completion: 'text-edsync-blue border-edsync-blue/30 bg-edsync-blue/10',
  }
  return map[alertType] || 'text-edsync-subtle border-edsync-border'
}
