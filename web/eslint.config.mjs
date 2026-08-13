import { FlatCompat } from '@eslint/eslintrc'
import { defineConfig, globalIgnores } from 'eslint/config'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

// eslint-config-next 15.5.22 が配るのは eslintrc 形式の設定なので、FlatCompat 経由で読む。
// （雛形は eslint-config-next 16 系のフラット設定を直接 import する形で生成されており、
//   15.5.22 では ERR_MODULE_NOT_FOUND / not iterable で lint がまったく動かなかった。
//   next は 15.5.22 固定＝CLAUDE.md「バージョン固定」なので、設定側を合わせる。チケット20で修正）
const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) })

const eslintConfig = defineConfig([
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
])

export default eslintConfig
