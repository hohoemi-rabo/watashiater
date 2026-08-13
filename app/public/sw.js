/*
 * 書き手Web（PWA）の Service Worker（チケット25）。
 *
 * 役割は**アプリの殻を持つことだけ**。回答・じぶん史・写真のオフライン閲覧は
 * すでに lib/offline-cache.ts（AsyncStorage＝Web では localStorage）が持っているので、
 * ここで二重に持たない。
 *
 * ── 署名URLを絶対にキャッシュしないこと（CLAUDE.md アーキテクチャ）──
 * R2 の写真・音声は worker が発行する有効期限つき署名URLでしか触れない。
 * それを保存すると、期限切れの URL を延々と返す壊れた状態になりうる。
 * ここでは「別オリジンには一切手を出さない」という1つの判定で担保している：
 * worker（watashiater-worker.*.workers.dev）も Supabase も fonts.gstatic.com も
 * すべて別オリジンなので、この worker のキャッシュには入りようがない。
 * 個別に URL を除外する作りにすると、新しい呼び先が増えたときに漏れる。
 */

// キャッシュ名。作りを変えたら上げる（activate で古いものを消す）
const CACHE = 'watashiater-shell-v1';

// 殻の最低限。JS バンドルはファイル名にハッシュが付いていて事前に分からないので、
// install では入れず fetch 時に拾う
const PRECACHE = ['/index.html', '/manifest.json', '/fonts/fonts.css', '/icons/icon-192.png'];

/** 内容ハッシュ付き or 不変の同一オリジン資産か（cache-first にしてよいもの） */
function isImmutableAsset(pathname) {
  return (
    pathname.startsWith('/_expo/static/') ||
    pathname.startsWith('/fonts/') ||
    pathname.startsWith('/icons/') ||
    pathname === '/manifest.json' ||
    pathname === '/favicon.ico'
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // 1つ落とせなくても install ごと失敗させない（アプリが起動しなくなるほうが困る）
      .then((cache) => Promise.allSettled(PRECACHE.map((path) => cache.add(path))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }
  const url = new URL(request.url);
  // 別オリジンには手を出さない（署名URL・Supabase・フォント。上のコメント参照）
  if (url.origin !== self.location.origin) {
    return;
  }

  // 画面の読み込みは network-first。cache-first にすると新しいデプロイが
  // いつまでも反映されない（SPA なので index.html が全ルートの入り口）
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(CACHE).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html').then((cached) => cached ?? Response.error())),
    );
    return;
  }

  if (isImmutableAsset(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }
        return fetch(request).then((response) => {
          // エラー応答をキャッシュに焼き付けない
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      }),
    );
  }
  // それ以外の同一オリジンはそのままネットワークへ
});
