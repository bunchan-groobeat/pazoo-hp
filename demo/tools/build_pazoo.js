/* Pazoo：pazoo.html から Artifact 配布用（画像を埋め込んだ1枚）を作る
   使い方： node C:/HQ/projects/pazoo-hp/demo/tools/build_pazoo.js
   出力：  demo/artifact_pazoo.html → これを Artifact に publish する */
const fs = require("fs");

const src = "C:/HQ/projects/pazoo-hp/demo/pazoo.html";
const out = "C:/HQ/projects/pazoo-hp/demo/artifact_pazoo.html";
const imgDir = "C:/HQ/projects/pazoo-hp/assets/img/main/";
const logo = "C:/HQ/projects/pazoo-hp/素材/pazoo-logo.png";
const gooDir = "C:/HQ/projects/pazoo-hp/demo/在庫写真/";

// 在庫写真：URLの車両IDとダウンロード済みファイルの対応（順序が変わっても崩れないよう明示）
const gooMap = {
  "30240807": "car1.jpg",
  "30260716": "car2.jpg",
  "30260703": "car3.jpg",
  "30260518": "car4.jpg",
  "30260727": "car5.jpg",
  "30260420": "car6.jpg"
};

let s = fs.readFileSync(src, "utf8");

// 1) assets/img/main の webp を、参照されているものだけ全部埋め込む
//    （2026-09-04：ヒーロー差し替えと切り抜きで枚数が変わるため、決め打ちをやめて実参照を拾う）
const refs = {};
const refRe = new RegExp("\\.\\./assets/img/main/[A-Za-z0-9_-]+\\.webp", "g");
(s.match(refRe) || []).forEach(function (r) { refs[r] = true; });
const refList = Object.keys(refs);
if (refList.length === 0) { console.error("assets/img/main の参照が1つも無い"); process.exit(1); }
refList.forEach(function (ref) {
  const f = imgDir + ref.split("/").pop();
  if (!fs.existsSync(f)) { console.error("画像が無い: " + f); process.exit(1); }
  s = s.split(ref).join("data:image/webp;base64," + fs.readFileSync(f).toString("base64"));
});
console.log("店の写真を埋め込み: " + refList.length + "件（" + refList.map(function(r){return r.split("/").pop();}).join(", ") + "）");

// 2) ロゴ（JSの探索リストの先頭を data URI に差し替え、パス連結もやめる）
if (!fs.existsSync(logo)) { console.error("ロゴが無い: " + logo); process.exit(1); }
s = s.replace("var names = ['pazoo-logo.png'", "var names = ['data:image/png;base64," + fs.readFileSync(logo).toString("base64") + "'");
s = s.split("img.src = '../\u7d20\u6750/' + names[i++];").join("img.src = names[i++];");
if (s.indexOf("\u7d20\u6750/") >= 0) { console.error("素材/ の参照が残っている"); process.exit(1); }

// 2.5) 地図の埋め込みを差し替える
//      Artifact は外部サイトの iframe を読み込めない（真っ白になる）ので、住所の板に置き換える。
//      本番のサイト（pazoo.html）側は iframe のまま。
{
  const a = s.indexOf('<iframe title="CAR SHOP Pazoo');
  if (a >= 0) {
    const b = s.indexOf("</iframe>", a);
    if (b < 0) { console.error("iframe の終わりが見つからない"); process.exit(1); }
    const panel = '<div class="fallback"><b>〒962-0061 福島県須賀川市北山寺町318</b>'
      + '国道4号沿い・須賀川インターから5分。'
      + '<span>※この確認用の1枚では地図を埋め込めないため、住所を出しています。本番のサイトには地図が入ります。</span></div>';
    s = s.slice(0, a) + panel + s.slice(b + "</iframe>".length);
    console.log("地図: iframe を住所の板に差し替え");
  } else {
    console.log("地図: iframe が無い（差し替えなし）");
  }
}

// 3) 在庫写真6枚
let hit = 0;
Object.keys(gooMap).forEach(function (id) {
  const f = gooDir + gooMap[id];
  if (!fs.existsSync(f)) { console.error("在庫画像が無い: " + f); process.exit(1); }
  const re = new RegExp('https://picture1\\.goo-net\\.com/[^"\']*' + id + '[^"\']*\\.jpg', "g");
  const found = s.match(re);
  if (!found) { console.error("URLが見つからない: " + id); return; }
  s = s.replace(re, "data:image/jpeg;base64," + fs.readFileSync(f).toString("base64"));
  hit++;
});
console.log("在庫画像を埋め込み: " + hit + "件");

// 4) Artifact の殻に合わせる（doctype/html/head/body は publish 時に付く）
const style = (s.match(/<style>[\s\S]*?<\/style>/) || [])[0];
if (!style) { console.error("style が見つからない"); process.exit(1); }
const bodyM = s.match(/<body>([\s\S]*?)<\/body>/);
if (!bodyM) { console.error("body が見つからない"); process.exit(1); }
let body = bodyM[1];

// body 直下に付けていたクラスは無いので、そのまま #stage で包む
let css = style.replace(/<\/?style>/g, "")
  .replace(/^body\{/m, "#stage{")
  .replace(/\nbody\{margin:0;background:var\(--bg\)/, "\n#stage{background:var(--bg)");
css += `
html,body{margin:0;background:#211f1b}
#stage{display:block;min-height:100vh}
`;

const fonts = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700&family=Noto+Sans+JP:wght@400;500;700;900&display=swap">';

const html = [
  "<title>Pazoo CAR SHOP</title>",
  fonts,
  "<style>", css, "</style>",
  '<div id="stage">',
  body,
  "</div>"
].join("\n");

fs.writeFileSync(out, html);
console.log("OK " + (fs.statSync(out).size / 1024 / 1024).toFixed(2) + "MB -> " + out);
