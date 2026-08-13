/**
 * 演目札の閲覧版（DESIGN.md §6.2。ワタシアターの顔のひとつ）。
 * app/components/prompt-card.tsx の移植：左端に半券のミシン目（点線）と上下の半円切り欠き。
 *
 * 実装の判断：
 * - 切り欠きは CSS マスクで**本当に抜く**（globals.css の .ticket-notch）。背景の空グラデが透ける。
 *   マスクは影も削るので、影は外側の要素に持たせ、紙の面だけをマスクする。
 *   切り欠き部分は影が直線のまま通るが、半径9px なので許容する（app と同じ判断）
 * - **「済」スタンプは出さない**。閲覧側に並ぶのは回答済みのカードだけなので、
 *   全枚に「済」が付くと情報量ゼロのノイズになる（DESIGN §6.2 はアプリの一覧の話）。
 *   代わりに半券部へ DESIGN §6.2 のもう一方の要素＝その回答の写真サムネイルを置き、
 *   写真が無く声だけの回答にはスピーカーバッジを出す
 * - 本文は省略せず全文出す。閲覧Webには回答の詳細ページが無く、ここが読む場所
 */
import { Volume2 } from 'lucide-react'

/** 半券部の幅。globals.css の --stub-w と一致させること（app の STUB_WIDTH=64） */
const STUB_WIDTH = 64

type TicketCardProps = {
  title: string
  bodyText: string
  thumbnailUrl: string | undefined
  hasRecording: boolean
}

export function TicketCard({ title, bodyText, thumbnailUrl, hasRecording }: TicketCardProps) {
  return (
    <article className="relative shadow-rest">
      <div className="ticket-notch paper absolute inset-0 rounded-2xl" />
      {/* ミシン目は切り欠きの内側だけに引く（app は半径9px＋4px の余白ぶん短くしている） */}
      <div className="ticket-perforation absolute inset-y-[13px]" style={{ left: STUB_WIDTH }} />

      <div className="relative flex items-stretch">
        <div
          className="flex shrink-0 items-center justify-center p-2"
          style={{ width: STUB_WIDTH }}
        >
          {thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt=""
              className="h-11 w-11 bg-card-white object-cover p-0.5 shadow-rest"
              src={thumbnailUrl}
            />
          ) : hasRecording ? (
            <span
              aria-hidden="true"
              className="grid h-6 w-6 place-items-center rounded-full bg-spot-yellow"
            >
              <Volume2 className="text-stage-navy" size={14} strokeWidth={2} />
            </span>
          ) : null}
        </div>

        <div className="flex-1 px-4 py-4">
          <h3 className="font-heading text-card-title">{title}</h3>
          {bodyText.trim() !== '' ? (
            <p className="mt-2 whitespace-pre-wrap text-body">{bodyText}</p>
          ) : (
            <p className="mt-2 text-caption text-text-soft">声で こたえています。</p>
          )}
        </div>
      </div>
    </article>
  )
}
