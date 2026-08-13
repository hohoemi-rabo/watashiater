// 無効化された・存在しない閲覧リンク（notFound()）と、閲覧Webに存在しないURL の受け皿。
// 孫が LINE で受け取ったリンクを開いて出る画面なので、Next の素の 404 は見せない。
// 「消えた」ではなく「いまは見られない」と伝える（DESIGN.md §10：終わりを連想させる語を避ける）
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-heading text-screen-title">このリンクは いま 見られません</h1>
      <p className="text-body">
        リンクが 止められているか、まちがっているようです。
        <br />
        送ってくれた人に、もういちど きいてみてください。
      </p>
    </main>
  )
}
