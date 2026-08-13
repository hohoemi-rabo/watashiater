'use client'

// Supabase / worker への通信が落ちたときの受け皿。Next の素のエラー画面を孫に見せない。
// error.tsx は Client Component であることが Next の要件（'use client' 必須）。
// error オブジェクトの中身は画面に出さない（サーバー側の事情を閲覧者に見せても意味がない）
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="font-heading text-screen-title">よみこめませんでした</h1>
      <p className="text-body">
        でんぱの よいところで、もういちど ためしてください。
      </p>
      <button
        type="button"
        onClick={reset}
        className="min-h-[48px] rounded-xl bg-curtain-red px-8 font-heading text-button text-card-white shadow-raised"
      >
        もういちど
      </button>
    </main>
  )
}
