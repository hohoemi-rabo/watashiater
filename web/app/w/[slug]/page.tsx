import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { Curtain } from '@/components/curtain'
import { DeskBoard, type BoardItem } from '@/components/desk-board'
import { Polaroid } from '@/components/polaroid'
import { TicketCard } from '@/components/ticket-card'
import { BOARD, resolveBoardPlacements } from '@/lib/board-layout'
import { getMuseumBySlug } from '@/lib/museum'
import { getViewUrls } from '@/lib/worker-api'

// 閲覧内容は常に最新を出す（署名URLにも有効期限がある）。静的化させない
export const dynamic = 'force-dynamic'

/** じぶん史の奥付の日付。サーバーは UTC で動くので JST を明示する（アプリ側と同じ見た目にする） */
function formatJaDate(iso: string): string {
  return new Intl.DateTimeFormat('ja-JP', { dateStyle: 'long', timeZone: 'Asia/Tokyo' }).format(
    new Date(iso),
  )
}

export async function generateMetadata({ params }: PageProps<'/w/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  // getMuseumBySlug は React の cache() 済み。ページ本体と二重に取りに行かない
  const museum = await getMuseumBySlug(slug)
  return museum ? { title: `${museum.nickname}の はくぶつかん` } : {}
}

export default async function ViewPage({ params }: PageProps<'/w/[slug]'>) {
  const { slug } = await params
  const museum = await getMuseumBySlug(slug)
  if (!museum) {
    // 無効化された・存在しないスラッグ（REQUIREMENTS §3.5b の「リンクを止める」が即座に効く）
    notFound()
  }

  // 写真と録音の署名URLは1バッチで取る（タップしてから声が出るまでの無音を作らない。docs/15 と同じ）。
  // 失敗しても {} が返るだけで、文章は読める（lib/worker-api.ts の契約）
  const r2Keys = [
    ...museum.photos.map((photo) => photo.r2Key),
    ...museum.photos.flatMap((photo) => (photo.recordingR2Key ? [photo.recordingR2Key] : [])),
  ]
  const viewUrls = await getViewUrls(r2Keys, slug)

  // 配置はサーバー側で確定させる（board-layout.ts をクライアントバンドルに入れない）。
  // 入力は DB 行と同じ形（snake_case）＝アプリとまったく同じ関数に同じ値を渡すための契約
  const { placements, boardHeightFraction } = resolveBoardPlacements(
    museum.photos.map((photo) => ({
      id: photo.id,
      board_x: photo.boardX,
      board_y: photo.boardY,
      board_rotation: photo.boardRotation,
      board_z: photo.boardZ,
    })),
    museum.boardSeed,
  )

  // 重なりは z 昇順の描画順で表す（同値は作成順。app/app/gallery.tsx と同じ並べ替え）
  const boardItems: BoardItem[] = museum.photos
    .map((photo, index) => ({ photo, placement: placements[index], index }))
    .sort((a, b) => a.placement.z - b.placement.z || a.index - b.index)
    .map(({ photo, placement }) => ({
      photo: {
        id: photo.id,
        url: viewUrls[photo.r2Key],
        caption: photo.caption,
        bodyText: photo.bodyText,
        hasRecording: photo.recordingR2Key !== null,
        recordingUrl: photo.recordingR2Key ? viewUrls[photo.recordingR2Key] : undefined,
      },
      x: placement.x,
      y: placement.y,
      rotation: placement.rotation,
    }))

  return (
    <>
      {/*
       * 開幕を「もう見た」かどうかは、幕が描かれる前に決めないと赤画面が1フレーム出る。
       * このスクリプトは HTML の解析中＝下の <Curtain> の markup より先に実行される。
       * slug は /^[a-z2-7]{16}$/ を通ったものだけなので、そのまま埋め込んで安全
       */}
      <script
        dangerouslySetInnerHTML={{
          __html: `try{if(localStorage.getItem('wt:curtain:${slug}'))document.documentElement.dataset.curtain='seen'}catch(e){}`,
        }}
      />
      <Curtain slug={slug} />

      <main className="mx-auto max-w-[520px] pb-16">
        {/* ── 表紙（DESIGN §6.1：幕が開くと名前と代表写真が現れる） ── */}
        <header className="flex flex-col items-center gap-5 px-5 pb-10 pt-12">
          <p className="font-heading text-card-title text-curtain-red">ワタシアター</p>
          <h1 className="text-center font-heading text-screen-title">
            {museum.nickname}の はくぶつかん
          </h1>
          {museum.coverPhoto ? (
            // 完全な水平垂直を疑う（DESIGN §2）。机の上の傾きと同じ ±3°の範囲に収める
            <div className="w-2/3 -rotate-2">
              <Polaroid
                caption={museum.coverPhoto.caption}
                hasRecording={false}
                url={viewUrls[museum.coverPhoto.r2Key]}
              />
            </div>
          ) : null}
        </header>

        {/* ── 机の上（配置・傾き・重なりをアプリと同じに再現） ── */}
        {boardItems.length > 0 ? (
          <section>
            <h2 className="px-5 pb-4 font-heading text-card-title">机の上</h2>
            <DeskBoard
              heightFraction={boardHeightFraction}
              items={boardItems}
              polaroidWidthFraction={BOARD.POLAROID_W}
            />
            <p className="px-5 pt-3 text-caption text-text-soft">
              写真をおすと、大きくなります。声のある写真は聞けます。
            </p>
          </section>
        ) : null}

        {/* ── じぶん史（DESIGN §4「一冊の本」：空の上に浮かぶ生成りのページ。
             扉（題字＋飾り罫）・全角1字下げの段落・末尾に奥付＝アプリの story 画面と同じ体裁） ── */}
        {museum.lifeStoryBodyText !== null ? (
          <section className="px-5 pt-12">
            <h2 className="pb-4 font-heading text-card-title">じぶん史</h2>
            <div className="rounded-2xl bg-story-paper px-6 py-8 shadow-rest">
              {/* 内側の細い枠罫（木色）＝本のページの体裁 */}
              <div className="rounded-xl border border-desk-wood/50 px-5 py-6">
                {/* 扉。◆は絵文字ではなく記号グリフ（DESIGN §11 の絵文字禁止に抵触しない） */}
                <p className="text-center text-caption text-text-soft">{museum.nickname}</p>
                <p className="pt-1 text-center font-story text-screen-title font-normal tracking-[0.3em] text-stage-navy">
                  じぶん史
                </p>
                <div className="flex items-center gap-2 pb-5 pt-3">
                  <span aria-hidden className="h-px flex-1 bg-desk-wood/50" />
                  <span aria-hidden className="text-caption leading-none text-desk-wood">
                    ◆
                  </span>
                  <span aria-hidden className="h-px flex-1 bg-desk-wood/50" />
                </div>
                <div className="space-y-3">
                  {museum.lifeStoryBodyText
                    .split(/\n+/)
                    .map((paragraph) => paragraph.trim())
                    .filter((paragraph) => paragraph.length > 0)
                    .map((paragraph, index) => (
                      <p
                        className="indent-[1em] font-story text-story-body"
                        key={`${index}-${paragraph.slice(0, 8)}`}>
                        {paragraph}
                      </p>
                    ))}
                </div>
                {museum.lifeStoryGeneratedAt !== null ? (
                  <p className="pt-4 text-right text-caption text-text-soft">
                    {formatJaDate(museum.lifeStoryGeneratedAt)}につくりました
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {/* ── 演目札一覧 ── */}
        {museum.cards.length > 0 ? (
          <section className="px-5 pt-12">
            <h2 className="pb-4 font-heading text-card-title">お題</h2>
            <div className="flex flex-col gap-4">
              {museum.cards.map((card) => (
                <TicketCard
                  bodyText={card.bodyText}
                  hasRecording={card.hasRecording}
                  key={card.key}
                  thumbnailUrl={card.thumbnailR2Key ? viewUrls[card.thumbnailR2Key] : undefined}
                  title={card.title}
                />
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </>
  )
}
