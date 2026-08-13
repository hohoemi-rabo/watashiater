import type { Metadata } from 'next'
import { Noto_Sans_JP, Shippori_Mincho, Zen_Maru_Gothic } from 'next/font/google'

import './globals.css'

// DESIGN.md §4 フォント3種。ウェイトは app/constants/tokens.ts の fonts と揃える
// （見出し=ZenMaruGothic_700Bold / 本文=NotoSansJP 400・500 / じぶん史=ShipporiMincho_400Regular）。
//
// subsets に 'japanese' は指定できない（next 15.5 の font-data.json に無い）が、
// **subsets はプリロード対象の選択にしか使われず**、Google Fonts の CSS に載る
// unicode-range 全ぶんのファイルは next/font が自前ホストする。日本語グリフは出るうえ、
// 日本語チャンク（1書体あたり100個以上）をプリロードしない今の挙動がむしろ望ましい。
const zenMaruGothic = Zen_Maru_Gothic({
  variable: '--font-zen-maru-gothic',
  subsets: ['latin'],
  weight: ['700'],
  display: 'swap',
})

// Noto Sans JP は可変フォント。ウェイトを指定しないことで 400／500 を1セットで賄う
const notoSansJP = Noto_Sans_JP({
  variable: '--font-noto-sans-jp',
  subsets: ['latin'],
  display: 'swap',
})

const shipporiMincho = Shippori_Mincho({
  variable: '--font-shippori-mincho',
  subsets: ['latin'],
  weight: ['400'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ワタシアター',
  // 検索エンジンには載せない：全ページ noindex（REQUIREMENTS.md §3.6）。
  // 閲覧URLは「リンクを知っている人だけが見られる」という前提なので、
  // ルートレイアウトで宣言して全ページに効かせる
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="ja"
      className={`${zenMaruGothic.variable} ${notoSansJP.variable} ${shipporiMincho.variable}`}
    >
      <body>{children}</body>
    </html>
  )
}
