/**
 * 閲覧Webの補助ボタン。app/components/secondary-button.tsx の移植
 * （白カード面＋stage-navy 文字・タップターゲット48px以上・押すとわずかに沈む＝DESIGN §5）。
 * 閲覧Webのボタンは「聞く」「とじる」など読む行為の補助だけなので、
 * curtain-red の主役ボタンは作らない（DESIGN §3：curtain-red は各画面で1つだけ）。
 */
import type { LucideIcon } from 'lucide-react'

type ActionButtonProps = {
  label: string
  onClick: () => void
  icon?: LucideIcon
}

export function ActionButton({ label, onClick, icon: Icon }: ActionButtonProps) {
  return (
    <button
      className="flex min-h-[48px] min-w-[48px] items-center justify-center gap-2 rounded-xl bg-card-white px-5 py-3 font-heading text-card-title text-stage-navy shadow-raised transition-transform active:scale-[0.98] active:shadow-rest"
      onClick={onClick}
      type="button"
    >
      {Icon ? <Icon size={22} strokeWidth={2} /> : null}
      {label}
    </button>
  )
}
