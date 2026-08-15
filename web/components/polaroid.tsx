/**
 * ポラロイド1枚（DESIGN.md §5「質感」）。app/components/board-polaroid.tsx の移植。
 * 白フチは上下左右8px・下だけ28px、角丸なし、手書き風フォントは使わない（Zen Maru Gothic）。
 *
 * 寸法の約束（web/lib/board-layout.ts の座標契約が前提にしている）：
 *   全高 = 幅 + 20px  … 写真が正方形なので 上8 + 下28 − 左右16 = 20
 * 写真を aspect-square にしてフチを padding で作れば、この関係は CSS が自動で満たす。
 * だから机の上は JS で寸法を測らずに済む（desk-board.tsx）。
 *
 * この約束は board variant だけのもの。lightbox variant は写真を切り抜かず
 * 実際の縦横比で全体を見せる（2026-08-15 ユーザー決定。正方形 cover だと縦写真の
 * 頭と足が切れる）。フチは w-fit で写真に吸い付かせ、JS で測らず CSS だけで満たす。
 * app/components/photo-lightbox.tsx と方針を一致させること
 */
import { Volume2 } from 'lucide-react'

/** 白フチ（px 固定。DESIGN §5）。app/components/board-polaroid.tsx の POLAROID_FRAME と一致させること */
export const POLAROID_FRAME = { side: 8, top: 8, bottom: 28 } as const

type PolaroidProps = {
  /** 署名URL。取れなかったときは undefined（割れ画像ではなく空枠を出す） */
  url: string | undefined
  caption: string
  hasRecording: boolean
  /** 拡大表示はキャプションを大きく2行まで見せる（app/components/photo-lightbox.tsx と同じ） */
  variant?: 'board' | 'lightbox'
}

export function Polaroid({ url, caption, hasRecording, variant = 'board' }: PolaroidProps) {
  const lightbox = variant === 'lightbox'
  return (
    <div
      className={`bg-card-white ${lightbox ? 'w-fit max-w-full shadow-lifted' : 'shadow-rest'}`}
      style={{
        paddingLeft: POLAROID_FRAME.side,
        paddingRight: POLAROID_FRAME.side,
        paddingTop: POLAROID_FRAME.top,
      }}
    >
      <div className="relative">
        {url ? (
          // next/image を使わない：署名URLは毎回変わり1時間で失効するため、
          // URL をキーにする画像最適化キャッシュと相性が悪い（毎回ミス＋課金）
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={hasRecording ? `「${caption}」の写真（声つき）` : `「${caption}」の写真`}
            className={
              lightbox
                ? // 切り抜かない：実比率のまま「幅いっぱい」と「高さ45vh」の両方に収める
                  'block max-h-[45vh] w-auto max-w-full bg-sky-bottom'
                : 'aspect-square w-full bg-sky-bottom object-cover'
            }
            src={url}
          />
        ) : (
          <div
            className={
              lightbox
                ? // 空枠は幅の当てが無いので高さ起点の正方形にする
                  'aspect-square h-[40vh] max-w-full bg-sky-bottom'
                : 'aspect-square w-full bg-sky-bottom'
            }
          />
        )}
        {hasRecording ? (
          // 音声つきの目印（DESIGN §7「小さな spot-yellow のスピーカーバッジ」）
          <span
            aria-hidden="true"
            className="absolute bottom-1 right-1 grid h-6 w-6 place-items-center rounded-full bg-spot-yellow"
          >
            <Volume2 className="text-stage-navy" size={14} strokeWidth={2} />
          </span>
        ) : null}
      </div>
      <div
        // lightbox の w-0 min-w-full：長いキャプションがフチを写真より広げないための定石
        // （幅の決定には参加させず、決まった幅いっぱいに広がる）
        className={
          lightbox ? 'flex w-0 min-w-full items-center justify-center py-2' : 'flex items-center justify-center'
        }
        style={{ minHeight: POLAROID_FRAME.bottom, height: lightbox ? undefined : POLAROID_FRAME.bottom }}
      >
        <p
          className={`px-1 text-center font-heading ${lightbox ? 'text-card-title' : 'truncate text-caption'}`}
        >
          {caption}
        </p>
      </div>
    </div>
  )
}
