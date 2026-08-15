import type { Metadata } from 'next'

// プライバシーポリシー（チケット23）。Google Play のストア掲載に必須の
// 「プライバシーポリシー URL」と「アカウント削除の Web ページ」（#account-deletion）を
// 1ページで兼ねる。ルートレイアウトの noindex は Play の要件に影響しない
// （URL が誰でも開ければよい）。閲覧ページと違い書き手本人以外も読むため、
// 分かち書きにはせず標準的な文章で書く（漢字の方針は CLAUDE.md 実装ルール4）。
export const metadata: Metadata = {
  title: 'プライバシーポリシー | ワタシアター',
}

// 見出しと本文の組。法的文書なのでデータは静的な配列で持ち、装飾は最小限にする
const sections: { id?: string; heading: string; body: React.ReactNode }[] = [
  {
    heading: '集める情報',
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>Google アカウントの情報（メールアドレス・名前）：ログインのために使います。</li>
        <li>お題への回答の文章：あなたが書いた（話した）内容です。</li>
        <li>写真：あなたが選んで添えた写真です。</li>
        <li>録音した声：あなたが録音ボタンを押して残した音声です。</li>
      </ul>
    ),
  },
  {
    heading: '使う目的',
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>あなたの「博物館」を保存し、表示するため。</li>
        <li>あなたが許可した家族に、博物館を見てもらうため。</li>
        <li>回答の文章から「じぶん史」を自動で作るため。</li>
        <li>不具合の調査と修正のため。</li>
      </ul>
    ),
  },
  {
    heading: '「じぶん史」の自動生成（AI）について',
    body: (
      <p>
        「じぶん史をつくる」を押したときだけ、回答の文章を Google の生成 AI（Gemini
        API）に送って文章を作ります。写真と録音した声は AI に送りません。
      </p>
    ),
  },
  {
    heading: '情報の保存先',
    body: (
      <>
        <p>集めた情報は、次のサービスに保存・処理を委託しています。</p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>Supabase（アカウント情報・回答の文章の保存。データベースは東京リージョン）</li>
          <li>Cloudflare（写真・音声ファイルの保存）</li>
          <li>Google Gemini API（じぶん史の生成時のみ。上の節のとおり）</li>
        </ul>
        <p className="mt-2">
          これら以外に情報を渡すことはありません。情報を売ることも、広告のために使うこともありません。
        </p>
      </>
    ),
  },
  {
    heading: '家族への共有',
    body: (
      <p>
        あなたの博物館は、あなたが渡した招待コードか閲覧リンクを知っている人だけが見られます。
        閲覧リンクはいつでも止められます。閲覧ページは検索エンジンに載らない設定にしています。
      </p>
    ),
  },
  {
    heading: '安全のための対策',
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>通信はすべて暗号化しています。</li>
        <li>
          写真と音声のファイルには直接アクセスできません。必ず有効期限つきの署名 URL
          を通してだけ読めるようにしています。
        </li>
        <li>閲覧リンクは推測できない長いランダムな文字列です。</li>
      </ul>
    ),
  },
  {
    id: 'account-deletion',
    heading: 'アカウント削除の方法',
    body: (
      <>
        <p>
          アプリの「せってい」→「アカウントを削除」から、いつでも自分でアカウントを削除できます。
        </p>
        <p className="mt-2">
          削除すると、アカウント情報・回答の文章・写真・録音した声・じぶん史・家族との共有設定の
          すべてがサーバーから完全に削除されます。あとから元に戻すことはできません。
        </p>
        <p className="mt-2">
          アプリを開けないなどの理由で自分で削除できないときは、下の連絡先にメールをください。
          本人確認のうえで削除します。
        </p>
      </>
    ),
  },
  {
    heading: '連絡先',
    body: (
      <p>
        このポリシーやあなたの情報についての質問・依頼は{' '}
        <a className="underline" href="mailto:rabo.hohoemi@gmail.com">
          rabo.hohoemi@gmail.com
        </a>{' '}
        までお送りください。
      </p>
    ),
  },
  {
    heading: 'このポリシーの変更',
    body: (
      <p>
        内容を変えるときは、このページを更新してお知らせします。
        <br />
        制定日：2026年8月15日
      </p>
    ),
  },
]

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="font-heading text-screen-title">プライバシーポリシー</h1>
      <p className="mt-4 text-body">
        「ワタシアター」（以下「本アプリ」）は、自分のエピソード・写真・声を集めて
        「自分の博物館」を作り、家族に見てもらうアプリです。ここでは、本アプリが
        どんな情報を預かり、どう扱うかを説明します。
      </p>
      <div className="mt-8 space-y-6">
        {sections.map((section) => (
          <section
            key={section.heading}
            id={section.id}
            className="paper paper-edge relative rounded-2xl p-6 shadow-rest"
          >
            <h2 className="font-heading text-card-title">{section.heading}</h2>
            <div className="mt-3 text-body">{section.body}</div>
          </section>
        ))}
      </div>
    </main>
  )
}
