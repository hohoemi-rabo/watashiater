'use client'

/**
 * 開幕（DESIGN.md §6.1。ワタシアターの顔のひとつ）。
 * 孫が URL を開いた瞬間、朱色の緞帳が左右に開いて表紙が現れる。
 * 1.2秒・タップでスキップ・**初回訪問だけ**・`prefers-reduced-motion` 時は最初から開いた状態。
 *
 * 実装の判断：
 * - 幕はサーバー側で「閉じた姿」として描く。**JS で後から消すとハイドレーション前に
 *   赤画面が1フレーム出る**ため、「もう見た」と「モーション低減」の2つの非表示経路は
 *   描画前に走るインラインスクリプト（page.tsx）＋CSS だけで閉じる（globals.css の .curtain）
 * - 開き方は CSS transition（app の curtain-overlay.tsx と同じく、完了は所要時間の
 *   setTimeout で進める。transitionend は要素が非表示のとき発火しない）
 * - 開き切ったらアンマウントする。透明な当たり判定を画面に残さない
 * - localStorage は slug ごと（別の博物館を開いたら、その館の開幕は見られる）
 */
import { useEffect, useState } from 'react'

/** 開幕の所要時間（DESIGN §6.1「1.2秒」。globals.css の transition と一致させること） */
const CURTAIN_OPEN_MS = 1200

export function curtainSeenKey(slug: string): string {
  return `wt:curtain:${slug}`
}

export function Curtain({ slug }: { slug: string }) {
  const [state, setState] = useState<'closed' | 'opening' | 'gone'>('closed')

  useEffect(() => {
    try {
      localStorage.setItem(curtainSeenKey(slug), '1')
    } catch {
      // プライベートモード等で書けなくても開幕自体は見せる（毎回開くだけ）
    }
    // 閉じた姿で1フレーム描いてから開く（同じフレームで状態を変えると transition が走らない）
    const raf = requestAnimationFrame(() => setState('opening'))
    const timer = setTimeout(() => setState('gone'), CURTAIN_OPEN_MS)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [slug])

  if (state === 'gone') {
    return null
  }

  return (
    <button
      aria-label="開幕をとばす"
      className="curtain fixed inset-0 z-50 cursor-default"
      data-state={state}
      onClick={() => setState('gone')}
      type="button"
    >
      <span className="curtain-panel curtain-panel-left left-0" />
      <span className="curtain-panel curtain-panel-right right-0" />
    </button>
  )
}
