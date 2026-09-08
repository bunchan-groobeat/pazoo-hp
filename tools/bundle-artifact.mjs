// index.html を1枚の自己完結HTMLに束ねる（社長がスマホ・外出先で確認するため）
// 2026-09-09 太郎  使い方: node tools/bundle-artifact.mjs <出力先>
// ★デザインは一切変えない。CSS/JS/画像を埋め込むだけ。
// ★Artifactは <!DOCTYPE>/<html>/<head>/<body> を自分で付けるので、中身だけを書き出す。
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const OUT = process.argv[2];
if (!OUT) { console.error('中止: 出力先を指定してください'); process.exit(1); }

const MIME = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml' };
function dataUri(rel) {
  const f = path.join(ROOT, rel);
  if (!fs.existsSync(f)) return null;
  const ext = path.extname(f).toLowerCase();
  return `data:${MIME[ext] || 'application/octet-stream'};base64,${fs.readFileSync(f).toString('base64')}`;
}

let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'assets/css/pazoo-2609.css'), 'utf8');
let js = fs.readFileSync(path.join(ROOT, 'assets/js/pazoo-2609.js'), 'utf8');

// ロゴは 素材/ から読む作りなので、1枚版では埋め込みに差し替える
const logo = dataUri('素材/pazoo-logo.png');
if (logo) js = js.replace("img.src = '素材/' + names[i++];", 'img.src = LOGOSRC;')
                 .replace('(function(){', `(function(){\n  var LOGOSRC = ${JSON.stringify(logo)};`);

// <body> の中身だけ取り出す
const body = html.slice(html.indexOf('<body>') + '<body>'.length, html.lastIndexOf('</body>'));

// 画像を埋め込む
let embedded = 0, missing = [];
const out = body.replace(/src="(assets\/[^"]+)"/g, (m, rel) => {
  if (rel.endsWith('.js')) return m;
  const u = dataUri(rel);
  if (!u) { missing.push(rel); return m; }
  embedded++;
  return `src="${u}"`;
})
// 外部JSの読み込みは消す（下でインラインにする）
.replace(/\s*<script src="assets\/js\/[^"]*"[^>]*><\/script>/g, '');

// 在庫の写真はグーネット（picture1.goo-net.com）から読む作り。
// Artifactのビューアは自分のファイル以外の画像を遮断する（CSP）ので、1枚版では取ってきて埋め込む。
// ★本番サイト側はグーネットのURLのまま（在庫が入れ替わっても自動で追従するため）。
const remote = [...js.matchAll(/photo:"(https:\/\/[^"]+)"/g)].map(m => m[1]);
let fetched = 0;
for (const url of [...new Set(remote)]) {
  try {
    const r = await fetch(url);
    if (!r.ok) { console.warn(`  写真が取れない(${r.status}): ${url}`); continue; }
    const buf = Buffer.from(await r.arrayBuffer());
    const mime = r.headers.get('content-type') || 'image/jpeg';
    js = js.split(`"${url}"`).join(`"data:${mime};base64,${buf.toString('base64')}"`);
    fetched++;
  } catch (e) { console.warn(`  写真が取れない: ${url} (${e.message})`); }
}
console.log(`  在庫写真 ${fetched}/${new Set(remote).size} 枚を埋め込み`);

// Artifactのビューアは他サイトのiframeを遮断する（CSP）。1枚版では地図をリンクに置き換える。
// ★本番サイト側の地図はそのまま。差し替えるのは確認用の1枚版だけ。
const MAPQ = '福島県須賀川市北山寺町318';
const mapped = out.replace(/<iframe[\s\S]*?<\/iframe>/g,
  `<p class="more"><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(MAPQ)}" target="_blank" rel="noopener">Googleマップで見る</a></p>`);

const page = `<title>CarShop Pazoo</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700&family=Noto+Sans+JP:wght@400;500;700;900&display=swap">
<style>
${css}
</style>
${mapped}
<script>
${js}
</script>
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, page);
console.log(`書き出し: ${OUT}`);
console.log(`  画像 ${embedded} 枚を埋め込み${missing.length ? '／未検出 ' + missing.join(', ') : ''}`);
console.log(`  ロゴ: ${logo ? '埋め込み済み' : '見つからず（文字ロゴにフォールバック）'}`);
console.log(`  容量: ${(Buffer.byteLength(page) / 1024 / 1024).toFixed(2)} MB`);
