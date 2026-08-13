// 閲覧URL（/w/[slug]）が指す博物館データの取得（チケット20）。
//
// slug の検証と読み取りをこの1本にまとめる。ページ側は「null なら notFound()」だけを見ればよく、
// service role キーを持つモジュール（lib/supabase-server.ts）はここからしか呼ばれない。
//
// クエリの形は app/lib/use-board-photos.ts の移植：並列フラットクエリ＋JS join
// （PostgREST の embed は使わない）。行の型は「使う列だけの狭い型」を web 側に置く
// （app/types/database.types.ts は app に一本化したまま。worker と同じ方針）。
import 'server-only'

import { cache } from 'react'

import { inList, sbSelect } from '@/lib/supabase-server'

/** 閲覧スラッグの形（app/lib/view-link.ts の生成規則と一対）。DB に投げる前にここで弾く */
const SLUG_PATTERN = /^[a-z2-7]{16}$/

export type MuseumPhoto = {
  id: string
  r2Key: string
  /** 机の上ボードの保存配置。null は自動整列（app/lib/board-layout.ts の契約） */
  boardX: number | null
  boardY: number | null
  boardRotation: number | null
  boardZ: number | null
  /** ポラロイドのキャプション＝お題タイトル */
  caption: string
  /** 本文エピソード（録音が無い写真で見せる。app/lib/use-board-photos.ts と同じ） */
  bodyText: string
  /** 声つきバッジと再生の可否。URL は別途 worker から取る */
  recordingR2Key: string | null
}

export type MuseumCard = {
  /** 固定お題は prompt の id、自由お題は 'free'（自由お題は subject に1枠） */
  key: string
  title: string
  bodyText: string
  /** 半券部に出すサムネイル（その回答の1枚目の写真）。無ければ null */
  thumbnailR2Key: string | null
  hasRecording: boolean
}

export type Museum = {
  subjectId: string
  slug: string
  nickname: string
  /** 自動整列のばら撒きシード（board-layout.ts に渡す） */
  boardSeed: number
  /**
   * 表紙の代表写真（DESIGN §6.1「名前と代表写真」）。
   * `subjects.cover_photo_id` を選ぶ導線はアプリに無く常に null なので、
   * 無いときは机の上の1枚目（created_at 最古）で代える（2026-08-13 ユーザー判断）
   */
  coverPhoto: MuseumPhoto | null
  /** 演目札の閲覧版。回答済みだけを、固定お題（sort_order 順）→自由お題 の順で返す */
  cards: MuseumCard[]
  /** created_at → id 昇順。この全順序が board-layout.ts の「毎回同じ配置」の前提 */
  photos: MuseumPhoto[]
  lifeStoryBodyText: string | null
}

type ViewLinkRow = { subject_id: string }
type SubjectRow = { id: string; nickname: string; board_seed: number; cover_photo_id: string | null }
type PromptRow = { id: number; title: string }
type AnswerRow = {
  id: string
  prompt_id: number | null
  custom_title: string | null
  body_text: string
}
type PhotoRow = {
  id: string
  answer_id: string
  r2_key: string
  board_x: number | null
  board_y: number | null
  board_rotation: number | null
  board_z: number | null
}
type RecordingRow = { answer_id: string; r2_key: string }
type LifeStoryRow = { body_text: string }

/**
 * 有効な閲覧スラッグが指す博物館を丸ごと読む。無効・失効・存在しない slug は null。
 *
 * generateMetadata とページ本体の両方から呼ぶので React の cache() でメモ化する
 * （同一リクエスト内の二重取得を防ぐ。CLAUDE.md「Next.js 15 ベストプラクティス」）。
 * 署名URLの取得（lib/worker-api.ts）はここに含めない：期限つきの値なのでメモ化の
 * 対象にせず、実際に描画するページからだけ呼ぶ
 */
export const getMuseumBySlug = cache(async (slug: string): Promise<Museum | null> => {
  if (!SLUG_PATTERN.test(slug)) {
    return null
  }

  // 認可はこの1行だけ。ここで得た subject_id 以外のデータは読まない
  // （service role キーは RLS をバイパスするため、範囲の限定はこの関数の責務）
  const links = await sbSelect<ViewLinkRow>(
    `view_links?slug=eq.${encodeURIComponent(slug)}&is_active=is.true&select=subject_id`,
  )
  const subjectId = links[0]?.subject_id
  if (!subjectId) {
    return null
  }

  const [subjects, prompts, answers, lifeStories] = await Promise.all([
    sbSelect<SubjectRow>(
      `subjects?id=eq.${subjectId}&select=id,nickname,board_seed,cover_photo_id`,
    ),
    sbSelect<PromptRow>('prompts?select=id,title&order=sort_order.asc'),
    sbSelect<AnswerRow>(
      `answers?subject_id=eq.${subjectId}&select=id,prompt_id,custom_title,body_text`,
    ),
    sbSelect<LifeStoryRow>(`life_story?subject_id=eq.${subjectId}&select=body_text`),
  ])
  const subject = subjects[0]
  if (!subject) {
    // view_links は subject の削除でカスケードされるので通常起きない
    return null
  }

  const answerIds = answers.map((answer) => answer.id)
  const [photoRows, recordings] =
    answerIds.length === 0
      ? [[] as PhotoRow[], [] as RecordingRow[]]
      : await Promise.all([
          // created_at だけでは全順序にならない（同時刻がありうる）。id のタイブレークが無いと
          // 「同じ seed で毎回同じ配置」が壊れる（app/lib/board-layout.ts の契約）
          sbSelect<PhotoRow>(
            `photos?answer_id=in.${inList(answerIds)}&select=id,answer_id,r2_key,board_x,board_y,board_rotation,board_z&order=created_at.asc,id.asc`,
          ),
          sbSelect<RecordingRow>(
            `recordings?answer_id=in.${inList(answerIds)}&select=answer_id,r2_key`,
          ),
        ])

  const promptTitleById = new Map(prompts.map((prompt) => [prompt.id, prompt.title]))
  const answerById = new Map(answers.map((answer) => [answer.id, answer]))
  const recordingKeyByAnswerId = new Map(
    recordings.map((recording) => [recording.answer_id, recording.r2_key]),
  )

  const titleOfAnswer = (answer: AnswerRow): string =>
    (answer.prompt_id !== null ? promptTitleById.get(answer.prompt_id) : answer.custom_title) ??
    'じぶんのお題'

  // 演目札は「書いたものだけ」を見せる判断（DESIGN §7 の演目札一覧の閲覧版）。
  // アプリの一覧と違い、閲覧側に未回答の空札を並べると書き手の宿題を家族に晒すことになる。
  // 閲覧は読むだけで、空札から書き始める導線も無い（迷わず使えるか＝CLAUDE.md 実装ルール6）
  const sortOrderByPromptId = new Map(prompts.map((prompt, index) => [prompt.id, index]))
  const cards: MuseumCard[] = answers
    .slice()
    .sort((a, b) => {
      // 固定お題（sort_order 順）→ 自由お題 の順。自由お題は subject に1枠
      const orderA = a.prompt_id === null ? Number.MAX_SAFE_INTEGER : (sortOrderByPromptId.get(a.prompt_id) ?? 0)
      const orderB = b.prompt_id === null ? Number.MAX_SAFE_INTEGER : (sortOrderByPromptId.get(b.prompt_id) ?? 0)
      return orderA - orderB
    })
    .map((answer) => ({
      key: answer.prompt_id === null ? 'free' : String(answer.prompt_id),
      title: titleOfAnswer(answer),
      bodyText: answer.body_text,
      // photoRows は created_at 昇順なので、最初に見つかった1枚がその回答の1枚目
      thumbnailR2Key: photoRows.find((photo) => photo.answer_id === answer.id)?.r2_key ?? null,
      hasRecording: recordingKeyByAnswerId.has(answer.id),
    }))

  const photos: MuseumPhoto[] = photoRows.map((photo) => {
    const answer = answerById.get(photo.answer_id)
    return {
      id: photo.id,
      r2Key: photo.r2_key,
      boardX: photo.board_x,
      boardY: photo.board_y,
      boardRotation: photo.board_rotation,
      boardZ: photo.board_z,
      caption: answer ? titleOfAnswer(answer) : 'じぶんのお題',
      bodyText: answer?.body_text ?? '',
      recordingR2Key: recordingKeyByAnswerId.get(photo.answer_id) ?? null,
    }
  })

  return {
    subjectId: subject.id,
    slug,
    nickname: subject.nickname,
    boardSeed: subject.board_seed,
    coverPhoto:
      photos.find((photo) => photo.id === subject.cover_photo_id) ?? photos[0] ?? null,
    cards,
    photos,
    lifeStoryBodyText: lifeStories[0]?.body_text ?? null,
  }
})
