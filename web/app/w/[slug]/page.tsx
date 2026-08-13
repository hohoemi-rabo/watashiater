import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { getMuseumBySlug } from '@/lib/museum'
import { getViewUrls } from '@/lib/worker-api'

// 閲覧内容は常に最新を出す（署名URLにも有効期限がある）。静的化させない
export const dynamic = 'force-dynamic'

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

  // 写真と録音の署名URLは1バッチで取る（タップしてから声が出るまでの無音を作らない。チケット15と同じ）。
  // 失敗しても {} が返るだけで、文章は読める（lib/worker-api.ts の契約）
  const r2Keys = [
    ...museum.photos.map((photo) => photo.r2Key),
    ...museum.photos.flatMap((photo) => (photo.recordingR2Key ? [photo.recordingR2Key] : [])),
  ]
  const viewUrls = await getViewUrls(r2Keys, slug)

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-10 px-5 py-10">
      {/* ── 表紙（チケット21で開幕演出＋代表写真を載せる） ── */}
      <header>
        <h1 className="font-heading text-screen-title">{museum.nickname}の はくぶつかん</h1>
      </header>

      {/* ── 机の上（チケット21で board-layout の座標どおりに並べる） ── */}
      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-card-title">しゃしん（{museum.photos.length}まい）</h2>
        {museum.photos.map((photo) => {
          const photoUrl = viewUrls[photo.r2Key]
          const recordingUrl = photo.recordingR2Key ? viewUrls[photo.recordingR2Key] : undefined
          return (
            <figure key={photo.id} className="rounded-2xl bg-card-white p-4 shadow-rest">
              {photoUrl ? (
                // next/image を使わない：署名URLは毎回変わり1時間で失効するため、
                // URL をキーにする画像最適化キャッシュとは相性が悪い（毎回ミス＋課金）
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt={photo.caption} className="w-full rounded-lg" />
              ) : (
                <p className="text-caption text-text-soft">写真をよみこめませんでした。</p>
              )}
              <figcaption className="mt-3 font-heading">{photo.caption}</figcaption>
              {photo.bodyText !== '' && <p className="mt-2 text-body">{photo.bodyText}</p>}
              {photo.recordingR2Key !== null &&
                (recordingUrl ? (
                  <audio controls src={recordingUrl} className="mt-3 w-full" />
                ) : (
                  <p className="mt-3 text-caption text-text-soft">声をよみこめませんでした。</p>
                ))}
              {/* 生データ確認用（チケット20の完了条件）。チケット21のボード実装で消す */}
              <p className="mt-3 text-caption text-text-soft">
                board: x={String(photo.boardX)} y={String(photo.boardY)} rot=
                {String(photo.boardRotation)} z={String(photo.boardZ)}
              </p>
            </figure>
          )
        })}
      </section>

      {/* ── じぶん史（チケット21で紙背景＋明朝の読み物にする） ── */}
      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-card-title">じぶん史</h2>
        {museum.lifeStoryBodyText !== null ? (
          <div className="whitespace-pre-wrap rounded-2xl bg-story-paper p-5 font-story text-story-body shadow-rest">
            {museum.lifeStoryBodyText}
          </div>
        ) : (
          <p className="text-body text-text-soft">まだ ありません。</p>
        )}
      </section>

      {/* ── 演目札一覧（チケット21で半券のカードにする） ── */}
      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-card-title">お題</h2>
        {museum.cards.map((card) => (
          <article key={card.key} className="rounded-2xl bg-card-white p-5 shadow-rest">
            <h3 className="font-heading text-card-title">{card.title}</h3>
            {card.bodyText !== '' ? (
              <p className="mt-2 whitespace-pre-wrap text-body">{card.bodyText}</p>
            ) : (
              <p className="mt-2 text-caption text-text-soft">声で こたえています。</p>
            )}
          </article>
        ))}
      </section>
    </main>
  )
}
