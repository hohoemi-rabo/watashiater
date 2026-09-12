'use client'

/**
 * 「下にもあります」の案内（チケット33）。
 * このページは「表紙 → ギャラリー → じぶん史 → お題」と縦に長く、下に続きがあることに
 * 気づかれない。指が下へスワイプするしぐさで、スクロールを促す。
 *
 * 実装の判断：
 * - **開幕（components/curtain.tsx）が開き切るまで動かさない**。幕は z-50 で全面を覆うので、
 *   初回訪問でそのまま動かすと案内が幕の裏で3回動き終わってしまう。「もう見た」かどうかは
 *   描画前のインラインスクリプトが立てる `<html data-curtain="seen">` で分かる（page.tsx）
 * - 高さの測定は表示直前に行う（画像やフォントで伸びるため、マウント直後だと足りない）
 * - **一度スクロールしたら二度と出さない**。案内の役目（下に続きがあると教える）は済んでいるので、
 *   上に戻るたびに出し直すとしつこいだけ
 * - 見た目・動きは実機で見くらべて A 案（濃紺の丸に白い指）に決定（2026-09-12 ユーザー選択）。
 *   白いカードの上に重なっても確実に読めることを優先した
 * - **動きは3回で止まる**（DESIGN §8「装飾アニメの常時ループ禁止」との折り合い。keyframes は
 *   globals.css の `.scroll-hint-chip`）。止まったあとは指と文字が静かに残る
 * - しぐさで気づかない人のために押せるようにもしてある（押すと1画面ぶん近く下へ動く）。
 *   当たり判定は錠剤の中だけ＝外側の帯は `pointer-events-none` で下のページへ通す
 */
import { Pointer } from 'lucide-react'
import { useEffect, useState } from 'react'

/** 開幕の所要時間（curtain.tsx と同じ値）。初回訪問はこれを待ってから出す */
const CURTAIN_OPEN_MS = 1200
/** 幕が開き切ってから出すまでの余白 */
const AFTER_CURTAIN_MS = 200
/** 2回目以降の訪問で、レイアウトが落ち着くのを待つ時間 */
const SETTLE_MS = 300
/** この差より小さければ「1画面に収まっている」＝案内を出さない */
const OVERFLOW_MIN = 8
/** これだけ動いたら「気づいた」とみなして消す */
const SCROLLED_PAST = 40
/** 押したときに進む量（表示領域に対する割合） */
const SCROLL_STEP_RATIO = 0.8

export function ScrollHint() {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const seenCurtain = document.documentElement.dataset.curtain === 'seen'
    const delay = seenCurtain ? SETTLE_MS : CURTAIN_OPEN_MS + AFTER_CURTAIN_MS

    const timer = window.setTimeout(() => {
      const overflows =
        document.documentElement.scrollHeight > window.innerHeight + OVERFLOW_MIN
      if (overflows && window.scrollY < SCROLLED_PAST) {
        setShown(true)
      }
    }, delay)

    const handleScroll = () => {
      if (window.scrollY < SCROLLED_PAST) {
        return
      }
      window.clearTimeout(timer)
      setShown(false)
      window.removeEventListener('scroll', handleScroll)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  if (!shown) {
    return null
  }

  return (
    // 帯はタップを通す。押せるのは錠剤だけ
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center">
      <button
        aria-label="下にもあります"
        className="scroll-hint pointer-events-auto flex flex-col items-center gap-1"
        onClick={() =>
          window.scrollBy({ top: window.innerHeight * SCROLL_STEP_RATIO, behavior: 'smooth' })
        }
        type="button"
      >
        <span className="scroll-hint-chip flex h-12 w-12 items-center justify-center rounded-full bg-stage-navy shadow-raised">
          <Pointer aria-hidden="true" className="h-6 w-6 text-card-white" strokeWidth={2} />
        </span>
        <span className="text-caption font-medium text-stage-navy">下にもあります</span>
      </button>
    </div>
  )
}
