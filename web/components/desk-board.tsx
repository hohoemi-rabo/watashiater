'use client'

/**
 * 机の上ボードの閲覧版（DESIGN.md §5・§7。app/app/gallery.tsx の閲覧モード相当）。
 * 木目の上に、アプリとまったく同じ座標・傾き・重なりでポラロイドを並べる。
 *
 * 実装の判断：
 * - **配置計算はサーバー側**（page.tsx が web/lib/board-layout.ts の resolveBoardPlacements を呼ぶ）。
 *   ここには確定した数値だけが props で届くので、レイアウト計算はクライアントバンドルに入らない
 * - **JS で寸法を測らない**。座標契約（ボード幅=1の正規化値・中心座標）は CSS の % だけで満たせる：
 *     ボード高さ … aspect-ratio: 1 / H        （H = boardHeightFraction）
 *     ポラロイド … width: 42%                  （高さは中身から決まり、幅+20px になる）
 *     中心座標  … left: x*100% / top: (y/H)*100% ＋ transform: translate(-50%,-50%)
 *   top の % がコンテナ**高さ**基準になるぶんを y/H で吸収するのが要。
 *   回転は translate のあとに続けるので、中心まわりの回転になる（契約どおり）
 * - **重なりは z 昇順の描画順**で表す（z-index を使わない＝app と同じ）。items は昇順で届く
 * - **机の縁は作らない**（DESIGN §5。チケット13でユーザーが削除を判断）
 */
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { PhotoLightbox, type LightboxPhoto } from '@/components/photo-lightbox'
import { Polaroid } from '@/components/polaroid'

export type BoardItem = {
  photo: LightboxPhoto
  /** 正規化配置（board-layout.ts の契約）。x,y はポラロイド外形の中心、rotation は度 */
  x: number
  y: number
  rotation: number
}

type DeskBoardProps = {
  /** z 昇順（＝奥から手前）に並べ替え済み */
  items: BoardItem[]
  /** ボード高さ ÷ ボード幅 */
  heightFraction: number
  /** ポラロイド幅 ÷ ボード幅（board-layout.ts の BOARD.POLAROID_W） */
  polaroidWidthFraction: number
}

export function DeskBoard({ items, heightFraction, polaroidWidthFraction }: DeskBoardProps) {
  const router = useRouter()
  const [openId, setOpenId] = useState<string | null>(null)
  const openPhoto = items.find(({ photo }) => photo.id === openId)?.photo ?? null

  return (
    <>
      <div
        className="desk-grain relative w-full bg-desk-wood"
        style={{ aspectRatio: `1 / ${heightFraction}` }}
      >
        {items.map(({ photo, x, y, rotation }) => (
          <button
            aria-label={`「${photo.caption}」の写真を大きく見る`}
            className="absolute block"
            key={photo.id}
            onClick={() => setOpenId(photo.id)}
            style={{
              left: `${x * 100}%`,
              top: `${(y / heightFraction) * 100}%`,
              width: `${polaroidWidthFraction * 100}%`,
              transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
            }}
            type="button"
          >
            <Polaroid caption={photo.caption} hasRecording={photo.hasRecording} url={photo.url} />
          </button>
        ))}
      </div>

      {openPhoto ? (
        <PhotoLightbox
          key={openPhoto.id}
          onClose={() => setOpenId(null)}
          // 署名URLは1時間で失効する。サーバーコンポーネントを流し直して取り直す
          onRetry={() => router.refresh()}
          photo={openPhoto}
        />
      ) : null}
    </>
  )
}
