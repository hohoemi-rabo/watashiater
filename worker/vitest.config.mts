import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
	test: {
		poolOptions: {
			workers: {
				wrangler: { configPath: "./wrangler.jsonc" },
				// テストを決定論的にするため、wrangler.jsonc の vars や .dev.vars の実値ではなく
				// 固定のテスト値を使う（miniflare 側の bindings が優先される）。
				// SUPABASE_URL を偽オリジンにすることで、JWKS / PostgREST への外部通信は
				// すべて fetchMock で横取りされる（test/helpers.ts）
				miniflare: {
					bindings: {
						SUPABASE_URL: "https://supabase.test",
						SUPABASE_SECRET_KEY: "sb_secret_test",
						SIGNING_SECRET: "test-signing-secret",
						GEMINI_API_KEY: "test-gemini-key",
					},
				},
			},
		},
	},
});
