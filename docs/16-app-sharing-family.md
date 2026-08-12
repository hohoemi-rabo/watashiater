# 16. 共有：招待コード・家族・みたよ

- ステータス: 完了
- 参照: REQUIREMENTS.md §3.5(a) / §7-7 / DESIGN.md §8（みたよ＝拍手演出）
- 依存: 12, 13（家族側の閲覧対象として）

## 目的

招待コードでの家族登録と「みたよ」リアクションを作る。コメント・文字入力は一切なし。

## Todo

- [x] 招待コード発行（6桁英数、`invite_codes`、有効期限つき）
- [x] 家族側：コード入力で `family_members` に登録（家族も Google OAuth でログイン）
- [x] 家族側の閲覧モード：対象 subject のギャラリー・じぶん史・お題カードを閲覧できる（RLS の SELECT 権限で担保）
- [x] みたよ：写真・じぶん史単位で1タップ（`reactions`）。拍手アイコンが1回はじけ spot-yellow の紙吹雪0.6秒（reduced-motion 尊重）
- [x] 書き手側：「〇〇さんが みたよ しました」の一覧（アプリ内のみ。プッシュ通知は実装しない）

## 完了条件

2つの Google アカウント間で、招待 → 家族登録 → 閲覧 → みたよ → 書き手側の一覧反映まで動く。

## メモ

### 設計判断（DB。詳細は `supabase/migrations/20260812000100_invite_redemption.sql` 冒頭コメント）

- **有効期限は7日間**（2026-08-12 ユーザー決定）。`invite_codes.expires_at` の**カラムデフォルト**として実装＝サーバー時刻基準で端末時計ズレの影響なし。TTL 変更はマイグレーション1行
- **家族の表示名**は参加時に本人が入力（Google 名 `user_metadata.full_name` を初期値。2026-08-12 ユーザー決定）。`family_members.display_name` を追加
- **引き換えは `public.redeem_invite_code` RPC**（プロジェクト初の RPC・public スキーマ唯一の関数）。SECURITY DEFINER＋`set search_path=''`＋anon revoke。業務エラー（誤コード/使用済み/期限切れ/自分のコード/名前不正）は **RAISE せず discriminated jsonb** で返す（`.rpc()` の例外文字列パースを避ける）。コード行を `for update` でロックし同時引き換えを直列化。既に家族のときはコードを**消費しない**
- supabase advisor の「authenticated が SECURITY DEFINER を実行できる」WARN は**意図どおり**（家族登録はこの関数が唯一の経路。`family_members` の INSERT ポリシーは引き続き無し）
- コードは32文字アルファベット（0/O/1/I/L 除外・256%32=0 で剰余の偏りなし）×6桁≈10億通り＋使い捨て＋7日期限。authenticated からの総当たりは理論上可能だがMVPでは受容
- みたよの取り消しは仕様外（reactions に UPDATE/DELETE ポリシーも無し）。対象の所属検証は既存トリガー `reactions_validate_target` が担う

### 設計判断（アプリ）

- **家族閲覧は専用 `/family/*` ルート**（gallery.tsx / story.tsx への readOnly フラグ差し込みはしない＝完成済みのならべかえ・生成/編集への回帰リスク回避）。ボードは同じ座標契約（対象 subject の `board_seed`＋保存済み `board_*`）で「本人がならべた机」をそのまま見せる。ライトボックス（チケット15）は `reaction?` prop を足しただけで共用
- **AuthGate**：subject 無しでも `/nickname` `/join` `/family*` `/onboarding` には居られる。それ以外に居たら memberships の有無で `/family` か `/nickname` へ。auth-context が subjects＋family_members を並列取得し、遷移判定は家風どおり**非同期の戻り値**（`hasSubject`/`hasMemberships`）で行う
- **導線**：nickname「かぞくに招待された方はこちら」（家族専用アカウントの必須経路）／settings「かぞくの博物館」（書き手が join する経路）／ホームは memberships がある人にだけ「かぞくの博物館」を出す。家族ハブにログアウトを置く（家族専用アカウントは settings に到達できないため）
- **みたよは楽観更新**：タップ即演出＋reacted 表示 → INSERT。23505（送信済み）は維持・他エラーは巻き戻し＋文言。`components/mitayo-button.tsx` の紙吹雪は決定的な放射パターン10粒・600ms・reduced-motion でスキップ。アイコンは lucide `Hand`（塗りは reacted のみ＝DESIGN §9。ギャラリーの「ならべかえ」の Hand とは画面が分かれるので衝突しない）
- **share 画面**：有効コードがあれば同じコードを出し続ける（`fetchActiveInviteCode`）。共有は RN `Share.share`。みたよ一覧は最新30件・写真が消えて解決できない行は出さない。発行ボタンがこの画面唯一の curtainRed

### 検証結果

- tsc / lint / expo export（Android バンドル）クリーン
- MCP：apply_migration 適用済み・advisors 確認済み（上記 WARN のみ・意図どおり）・types 再生成済み
- 実機（Expo Go・Google 2アカウント・2026-08-12）：動作OK（ユーザー確認済み）。コード発行→別アカウントで家族登録→閲覧（机の上・じぶん史・お題カード）→みたよ（拍手演出）→書き手側の一覧反映まで、完了条件の一連の流れを確認
- 仕様確認（ユーザーと合意）：招待コードは登録の入口だけ（7日・1回使い捨て）。**登録後の家族はコード失効に関係なくずっと閲覧できる**。家族を増やすときは新しいコードを発行する。家族登録の解除 UI は MVP 外（RLS の delete 権限のみ用意済み）
