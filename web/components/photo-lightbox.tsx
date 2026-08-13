'use client'

/**
 * 写真ライトボックス「写真が語る」（REQUIREMENTS §3.4②「閲覧Web側でも同じ再生体験（HTML5 audio）」）。
 * app/components/photo-lightbox.tsx の移植。守っている約束：
 * - 背景は DIMMED_SKY（空色を少し濃くする＝DESIGN §7）。**黒背景・夜の劇場化は禁止**（§11-4）
 * - **録音がある写真に本文テキストは併記しない**（仕様の文字どおり「拡大＋音声」。
 *   録音なしの写真だけテキストエピソードを出す＝2026-08-12 ユーザー決定・docs/15）
 * - 閉じる＝即アンマウント。<audio> ごと外れるので音は確実に止まる
 *
 * Web 固有の判断：
 * - **自動再生はブラウザに拒否されうる**（ユーザー操作から離れた play() は reject する）。
 *   写真タップという操作の直後なので通ることが多いが、reject されたら黙って無音にせず
 *   「声を聞く」ボタンに落とす
 * - 署名URLは1時間で失効する。音声の読み込みに失敗したら onRetry（router.refresh）で
 *   サーバーコンポーネントを再実行し、新しい署名URLを流し込む（app の refetch に相当）
 * - Esc でも閉じる／開いている間は背面をスクロールさせない（Web では当然の期待）
 */
import { Pause, Play, RotateCcw, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { ActionButton } from '@/components/action-button'
import { Polaroid } from '@/components/polaroid'

const LOAD_ERROR_MESSAGE =
  '声をよみこめませんでした。電波のよいところで、もういちどためしてください。'

export type LightboxPhoto = {
  id: string
  url: string | undefined
  caption: string
  bodyText: string
  hasRecording: boolean
  recordingUrl: string | undefined
}

type PhotoLightboxProps = {
  photo: LightboxPhoto
  onClose: () => void
  /** 署名URLの取り直し（router.refresh） */
  onRetry: () => void
}

export function PhotoLightbox({ photo, onClose, onRetry }: PhotoLightboxProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [finished, setFinished] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [failed, setFailed] = useState(photo.hasRecording && photo.recordingUrl === undefined)

  // Esc で閉じる＋開いている間は背面を固定する
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  // 開いた直後に鳴らしにいく（タップの直後なので多くのブラウザで通る）
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) {
      return
    }
    void audio.play().catch(() => setBlocked(true))
  }, [photo.recordingUrl])

  const play = () => {
    void audioRef.current?.play().then(
      () => setBlocked(false),
      () => setBlocked(true),
    )
  }

  const replay = () => {
    const audio = audioRef.current
    if (!audio) {
      return
    }
    audio.currentTime = 0
    play()
  }

  return (
    <div className="fixed inset-0 z-40 bg-[color:var(--dimmed-sky)]">
      {/* 背面タップでも閉じる（補助経路。主経路は最下部の「とじる」） */}
      <button
        aria-label="とじる"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        type="button"
      />

      <div className="pointer-events-none relative mx-auto flex h-full max-w-[520px] flex-col items-center justify-center gap-6 px-5 py-8">
        <div className="pointer-events-auto w-full max-w-[min(100%,45vh)]">
          <Polaroid
            caption={photo.caption}
            hasRecording={photo.hasRecording}
            url={photo.url}
            variant="lightbox"
          />
        </div>

        {photo.hasRecording ? (
          <div className="pointer-events-auto flex w-full flex-col items-center gap-3">
            {photo.recordingUrl !== undefined ? (
              <audio
                onEnded={() => {
                  setPlaying(false)
                  setFinished(true)
                }}
                onError={() => setFailed(true)}
                onPause={() => setPlaying(false)}
                onPlay={() => {
                  setPlaying(true)
                  setFinished(false)
                }}
                preload="auto"
                ref={audioRef}
                src={photo.recordingUrl}
              />
            ) : null}

            {failed ? (
              <div className="paper paper-edge relative w-full rounded-2xl p-5 shadow-rest">
                <p className="text-body text-error-red">{LOAD_ERROR_MESSAGE}</p>
                <div className="mt-3 flex justify-center">
                  <ActionButton icon={RotateCcw} label="もういちどよみこむ" onClick={onRetry} />
                </div>
              </div>
            ) : blocked ? (
              // 自動再生が止められたときだけ出る。無音のまま放置しない
              <ActionButton icon={Play} label="声を聞く" onClick={play} />
            ) : (
              <>
                {!finished ? (
                  <ActionButton
                    icon={playing ? Pause : Play}
                    label={playing ? '一時停止' : 'つづきを聞く'}
                    onClick={() => (playing ? audioRef.current?.pause() : play())}
                  />
                ) : null}
                <ActionButton icon={RotateCcw} label="もういちど聞く" onClick={replay} />
              </>
            )}
          </div>
        ) : photo.bodyText.trim() !== '' ? (
          <div className="paper paper-edge pointer-events-auto relative max-h-[35vh] w-full overflow-y-auto rounded-2xl p-5 shadow-rest">
            <p className="whitespace-pre-wrap text-body">{photo.bodyText}</p>
          </div>
        ) : null}

        <div className="pointer-events-auto">
          <ActionButton icon={X} label="とじる" onClick={onClose} />
        </div>
      </div>
    </div>
  )
}
