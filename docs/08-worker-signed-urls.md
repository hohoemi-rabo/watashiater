# 08. worker：JWT検証＋R2署名URL

- ステータス: 未着手
- 参照: REQUIREMENTS.md §5（worker の役割2「メディアの門番」） / §4.3（直リンク不可・有効期限） / CLAUDE.md 実装ルール5
- 依存: 07

## 目的

R2 への唯一の入口となる「メディアの門番」を作る。アップロードも閲覧も必ずここを通す。

## Todo

- [ ] wrangler.jsonc に R2 バケットを設定（`cf-typegen` で型再生成）
- [ ] Supabase JWT 検証（`SUPABASE_JWT_SECRET`）の共通ミドルウェア
- [ ] アップロード用署名URL発行エンドポイント（photos / recordings。R2 キー設計は subject/answer 単位で決め、判断をコメントに残す）
- [ ] 閲覧用署名URL発行エンドポイント（本人 JWT または有効な閲覧スラッグを検証して許可）
- [ ] 署名URLの実現方式（S3互換 presign か Worker 経由ストリームか）を実装時に判断し、判断をコードコメントに残す
- [ ] 有効期限付きであること・R2 直リンクでは取得できないことを確認
- [ ] vitest：JWT不正／期限切れ／無効スラッグ／正常系のテスト

## 完了条件

app から安全にアップロード・閲覧できる API が揃い、`npm test -- --run` が通る。

## メモ

（作業中の記録）
