/* Pazoo：goo-stock.mjs が取ってきた実在庫を assets/js/pazoo-2609.js の STOCK に反映する。
   ★2026-09-09 向き先を変更＝それまで demo/pazoo.html（デザイン案）に書いていた。
     9月デザインを本番9ページへ実装したので、配信されるのは assets/js/pazoo-2609.js。
   使い方： node C:/HQ/projects/pazoo-hp/tools/apply-stock.mjs         （下書きを表示するだけ）
            node C:/HQ/projects/pazoo-hp/tools/apply-stock.mjs --write （実際に書き込む）

   ★車名は上書きしない。グーネットの見出しは「ジムニー ＸＬ ４ＷＤ リフトアップ マッドタイヤ 前後社外バンパー…」と
     装備まで入った長文で、カードに載せると崩れるため。名前とバッジは pazoo.html 側の手書きを正とし、
     年式・走行・価格・車検・修復歴・写真だけを実在庫に合わせる。
   ★新しく入った車は名前が決まらないので「要確認」付きの仮名で足す。必ず人が直してから公開する。 */

import fs from "node:fs";

const HTML = "C:/HQ/projects/pazoo-hp/assets/js/pazoo-2609.js";
/* 控えは配信フォルダの外（data/_bak/）に置く。公開対象に .bak を残すと検品で🔴になるため */
const BAKDIR = "C:/HQ/projects/pazoo-hp/data/_bak";
const JSONP = "C:/HQ/projects/pazoo-hp/data/stock_latest.json";
const WRITE = process.argv.includes("--write");
/* --notify＝夜間用。本番へは書かず、要るときだけ社長のLINEに1行足す（2026-09-09 社長決定「2」） */
const NOTIFY = process.argv.includes("--notify");

const idOf = (url) => (String(url).match(/(\d{21})\.html/) || [])[1] || null;
const jstNow = () => new Date(Date.now() + 9 * 3600 * 1000);

/** "2024(令和6)年" → 2024 ／ "1997年" → 1997 */
const toYear = (s) => { const m = String(s).match(/(\d{4})/); return m ? Number(m[1]) : null; };
/** "20.3万km" → 20.3 ／ "不明" → null */
const toKm = (s) => { const m = String(s).match(/([\d.]+)\s*万km/); return m ? Number(m[1]) : null; };
/** "なし" → "車検なし" ／ "2026(令和8)年12月" → "車検2026年12月まで" */
const toShaken = (s) => {
  const t = String(s || "").trim();
  if (!t || t === "なし") return "車検なし";
  const m = t.match(/(\d{4})[^\d]*?(\d{1,2})月/);
  return m ? `車検${m[1]}年${m[2]}月まで` : `車検${t.replace(/\(.*?\)/g, "")}まで`;
};
const toRepair = (s) => (String(s).trim() === "あり" ? "修復歴あり" : null);
/** 一覧の写真は /Q/（小）。詳細と同じ /J/（大）に直す */
const bigPhoto = (u) => (u ? u.replace("/Q/", "/J/") : null);
/** グーネットの長い見出しから、頭2語だけを仮の車名にする */
const tempName = (n) => String(n).split(" ").slice(0, 2).join(" ");

const q = (v) => (v === null || v === undefined ? "null" : typeof v === "number" ? String(v) : JSON.stringify(v));

const stock = JSON.parse(fs.readFileSync(JSONP, "utf8"));
let html = fs.readFileSync(HTML, "utf8");

// いまの STOCK ブロックを取り出す
const startMark = "  var STOCK = {";
const s0 = html.indexOf(startMark);
if (s0 < 0) { console.error("STOCK が見つからない"); process.exit(1); }
const e0 = html.indexOf("\n  };", s0);
if (e0 < 0) { console.error("STOCK の終わりが見つからない"); process.exit(1); }
const block = html.slice(s0, e0 + 5);

// 既存の手書き（名前・バッジ）を車両IDで引けるようにする
const kept = new Map();
for (const m of block.matchAll(/\{name:"([^"]*)"[\s\S]*?badge:(null|"[^"]*")[\s\S]*?url:"([^"]*)"\}/g)) {
  const id = idOf(m[3]);
  if (id) kept.set(id, { name: m[1], badge: m[2] });
}

// 並び順は「ジムニー → 旧車 → その他」に固定する。グーネットの並び順のままだとジムニーが分かれ、
// 「ジムニー買うなら、Pazoo.」の店に見えなくなるため（2026-09-04）。
const rank = (id) => {
  const b = kept.get(id)?.badge ?? "null";
  if (b === '"Jimny"') return 0;
  if (b === '"Classic"') return 1;
  return 2;
};
stock.cars.sort((a, b) => rank(a.id) - rank(b.id));

const news = [];
const rows = stock.cars.map((c) => {
  const k = kept.get(c.id);
  if (!k) news.push(c);
  const name = k ? k.name : `${tempName(c.name)}【要確認】`;
  const badge = k ? k.badge : "null";
  return `      {name:${q(name)}, year:${q(toYear(c.year))}, km:${q(toKm(c.km))}, price:${q(c.priceTotal)}, shaken:${q(toShaken(c.shaken))}, badge:${badge}, repair:${q(toRepair(c.repair))},
       photo:${q(bigPhoto(c.photo))},
       url:${q(c.url)}}`;
});

const gone = [...kept.keys()].filter((id) => !stock.cars.some((c) => c.id === id));
const now = jstNow();
const updated = `${now.getUTCFullYear()}.${String(now.getUTCMonth() + 1).padStart(2, "0")}.${String(now.getUTCDate()).padStart(2, "0")}`;

const rebuilt = `  var STOCK = {
    updated: "${updated}",
    cars: [
${rows.join(",\n")}
    ]
  };`;

console.log(`在庫 ${stock.cars.length}台（取得 ${stock.checkedAt}）／更新日 ${updated}`);
if (news.length) {
  console.log("🔴 新しく入った車＝仮の名前で入れた。公開前に必ず直すこと:");
  news.forEach((c) => console.log(`   - ${tempName(c.name)}【要確認】  ${c.url}`));
}
if (gone.length) console.log(`✅ 消えた車を ${gone.length}台ぶん外した（売れた可能性）`);
if (!news.length && !gone.length) console.log("台数の増減なし（数値と日付だけ合わせた）");

/* ── --notify：夜間に確認だけして、要るときだけ社長のLINEに1行足す（2026-09-09 社長決定「2」）
   自動で本番へ書かないのは、新しく入った車が仮名（【要確認】）のまま客に見えるのを避けるため。
   足すのは次の3つのどれかに当たった日だけ。何も無い日は黙っている。
     ① 新しく入った車がある＝名前を人が決める必要がある
     ② 台数が減った＝売れた分をサイトから外す必要がある
     ③ サイトの在庫表示が「あと少しで止まる」＝48時間の安全弁が近い（これがいちばん怖い） */
if (NOTIFY) {
  const LINEOUT = "C:/HQ/projects/pazoo-hp/data/stock_line.txt";
  const VALVE_H = 48;   // assets/js/pazoo-2609.js の安全弁と同じ値
  const WARN_H = 30;    // これを超えたら知らせる（翌晩まで待つと間に合わないため）

  const cur = (html.match(/updated:\s*"([\d.]+)"/) || [])[1] || null;
  const curTs = cur ? Date.parse(cur.replace(/\./g, "/")) : NaN;
  const ageH = isNaN(curTs) ? null : (Date.now() - curTs) / 3600000;

  const why = [];
  if (news.length) why.push(`新規${news.length}台は仮名`);
  if (gone.length) why.push(`売れた${gone.length}台が残ったまま`);
  if (ageH !== null && ageH > WARN_H) {
    const left = Math.round(VALVE_H - ageH);
    why.push(left > 0 ? `あと約${left}時間で在庫表示が止まる` : `在庫表示は既に止まっている`);
  }

  let line = "";
  if (why.length) {
    line = `■ Pazoo在庫 反映待ち ${stock.cars.length}台（${why.join("／")}）→ apply-stock.mjs --write`;
    let prev = "";
    try { prev = fs.readFileSync(LINEOUT, "utf8").trim(); } catch { prev = ""; }
    fs.writeFileSync(LINEOUT, prev ? prev + "\n" + line : line, "utf8");   // goo-stock の1行は消さずに足す
  }
  console.log(line ? `[LINE用] ${line}` : "[LINE用] 知らせることなし（反映も安全弁も余裕あり）");
  console.log(`  サイト側の更新日=${cur ?? "不明"}${ageH === null ? "" : `（${ageH.toFixed(1)}時間前）`}`);
  if (news.length) news.forEach((c) => console.log(`  仮名で入る予定: ${tempName(c.name)}【要確認】 ${c.url}`));
  process.exit(0);
}

if (!WRITE) {
  console.log("\n--- 下書き（--write を付けると書き込む） ---\n" + rebuilt);
  process.exit(0);
}

fs.mkdirSync(BAKDIR, { recursive: true });
const bak = `${BAKDIR}/pazoo-2609.js.${updated.replace(/\./g, "")}-${Date.now()}`;
fs.writeFileSync(bak, html, "utf8");
html = html.slice(0, s0) + rebuilt + html.slice(e0 + 5);
fs.writeFileSync(HTML, html, "utf8");
console.log(`
書き込んだ: ${HTML}（控え: ${bak}）`);
