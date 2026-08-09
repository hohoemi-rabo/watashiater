# 02. DBスキーマ＋RLS＋お題シード

- ステータス: 完了
- 参照: REQUIREMENTS.md §6（テーブル構成・RLS方針） / §3.2（固定10問の文言・順序）
- 依存: 01

## 目的

REQUIREMENTS.md §6 の10テーブルをマイグレーションとして作成し、RLS と固定お題データを整備する。

## Todo

- [x] §6 の10テーブルをマイグレーションで作成（SQL をリポジトリに残す。`subject_type` は 'self' 固定で、それ以外の Phase 2 先回りをしない）
- [x] RLS ポリシー：本人＝全操作可／登録家族＝対象 subject の SELECT＋reactions INSERT のみ
- [x] `prompts` に固定10問を §3.2 の文言・順序どおりシード（`is_photo_prompt` は7問目「自慢の一枚」のみ true）
- [x] anon キーで `view_links` を直接読み取れないことを確認（§6 末尾の方針）
- [x] TypeScript 型を生成して app から参照できるようにする

## 完了条件

マイグレーションが再現可能な形でリポジトリに残り、RLS の効き（本人・家族・第三者）が確認済み。

## メモ

### マイグレーション（supabase/migrations/ に保存し、同内容を MCP `apply_migration` で適用済み）

1. `20260809000100_initial_schema.sql` — 10テーブル・FKインデックス・トリガー・RLS
2. `20260809000200_seed_prompts.sql` — 固定10問シード
3. `20260809000300_security_hardening.sql` — advisor 対応（下記）

### スキーマの設計判断

- PK は `uuid`（`gen_random_uuid()`）。`prompts` のみ整数 PK（1〜10 のマスタ）
- `subjects.owner_user_id` は **UNIQUE**（MVP は1ユーザー1館。Phase 2 で複数館にするなら制約を落とす）
- `subject_type` は `check (subject_type = 'self')` で MVP の値を固定（カラムの存在だけが Phase 2 への備え）
- `answers` は「固定お題は `custom_title` なし／自由お題（`prompt_id` null）は必須」を CHECK で強制。
  固定お題は `unique (subject_id, prompt_id)`、自由お題は部分 unique インデックスで **1枠** に固定
- `recordings.duration_sec` は `<= 181`（チケット00の実測：自動停止は180秒手前、JS 予備停止が最大181秒）
- `recordings` は `answer_id` UNIQUE（回答ごとに録音1本）。`life_story` も subject ごとに1本
- `view_links` は部分 unique インデックスで「有効なリンクは subject ごとに1本」（無効化＋再発行の運用）
- 写真の「1お題5枚まで」（§3.2）は**アプリ側で制御**（DB トリガーでの件数制限はしない）
- `reactions.target_id` は多態（photo / life_story）で FK を張れないため、**BEFORE INSERT トリガー**で
  「その家族が属する subject のコンテンツか」を検証する
- `answers.updated_at` はトリガーで自動更新

### RLS の構成

- ヘルパー関数（`is_subject_owner` / `is_subject_family` / `is_answer_owner` / `is_answer_family` /
  `is_own_membership` / `is_membership_of_owned_subject`）は SECURITY DEFINER＋`search_path=''`。
  `auth.uid()` は `(select ...)` で包んで1回評価に
- **関数はすべて `private` スキーマに配置**。public スキーマの関数は PostgREST の RPC として
  anon からも呼べてしまうため（advisor 0028/0029）。`private` には authenticated / service_role にのみ
  USAGE・EXECUTE を付与
- 同一アクションの permissive ポリシー複数は全数評価される（advisor 0006）ため、
  **SELECT は「本人 or 家族」の1本**、INSERT / UPDATE / DELETE は本人のみのポリシーに分割
- `family_members` への **INSERT ポリシーは意図的に無し**。家族登録は招待コード検証つきの
  SECURITY DEFINER 関数としてチケット16で実装する
- `invite_codes` / `view_links` は本人のみ（家族・anon からは不可視）。閲覧 Web は service role で読む

### 検証結果（2026-08-09）

ロールプレイ検証（テストユーザー3人をトランザクション内で作成し、`request.jwt.claims` を
切り替えて確認 → 全ロールバック）：

| ロール | 結果 |
|---|---|
| anon | subjects / view_links / prompts すべて 0 件（何も見えない） |
| 本人 | 全テーブル可視（view_links / invite_codes / family / reactions 含む）。回答の UPDATE 成功 |
| 家族 | subjects / answers / photos / life_story は見える。**view_links / invite_codes は 0 件**。回答の UPDATE は 0 行。reactions の INSERT 成功 |
| 第三者 | すべて 0 件 |

- advisor：security **0件**・performance は unused_index の INFO のみ（空DBでは当然）
- `list_tables`：10テーブル全て RLS 有効、prompts 10行
- 型生成 → `app/types/database.types.ts` に配置（ヘッダに再生成手順を記載）。`tsc` / `eslint` クリーン

### 後続チケットへの申し送り

- web（チケット20）で型が必要になったら同じ生成結果をコピーする（プロジェクト間で共有しない構成のため）
- チケット16：家族登録の definer 関数（招待コード検証＋`family_members` INSERT＋`used_by` 更新）と、
  必要なら招待コードの残存 TTL 確認を実装
- チケット18：アカウント削除は `auth.users` の削除で全データが CASCADE で消える設計
  （subjects → answers → photos / recordings ほか）。R2 のオブジェクト削除は worker 側で別途必要
