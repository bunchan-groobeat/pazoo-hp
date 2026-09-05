/* Pazoo：グーネットの店舗レビューを取ってきて読める形で出す。
   使い方： node C:/HQ/projects/pazoo-hp/tools/goo-reviews.mjs
   出力：  data/reviews_latest.json ／ data/口コミ_latest.md
   ★要約AIは使わない（在庫と同じ理由）。グーネットは EUC-JP。
   ★一覧に出るのは本文の冒頭だけのことがあるので、続きがある口コミは詳細ページも取りにいく。 */

import fs from "node:fs";
import path from "node:path";

const SHOP = "0902905";
const LIST = `https://www.goo-net.com/user_review/${SHOP}/detail.html`;
const ROOT = "C:/HQ/projects/pazoo-hp";
const DATA = path.join(ROOT, "data");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

const tidy = (s) => String(s).replace(/<[^>]*>/g, "")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
  .replace(/[\u3000\s]+/g, " ").trim();

async function get(url) {
  const res = await fetch(url, { headers: { "user-agent": UA, "accept-language": "ja" } });
  if (!res.ok) throw new Error("HTTP " + res.status + " " + url);
  return new TextDecoder("euc-jp").decode(await res.arrayBuffer());
}

const main = async () => {
  fs.mkdirSync(DATA, { recursive: true });
  const html = await get(LIST);

  // 店全体の評価
  const scores = {};
  const reScore = /<em class="tit">([^<]*)<\/em>[\s\S]*?<em class="point">([\d.]+)<\/em>/g;
  let m;
  while ((m = reScore.exec(html))) scores[tidy(m[1]).replace(/^★/, "")] = Number(m[2]);

  // 1件ずつ
  const reviews = [];
  const blocks = html.split('class="evaluation_wrap').slice(1);
  for (const b of blocks) {
    const href = (b.match(/href="(\/user_review\/[^"]+detail_main\.html)"/) || [])[1];
    const car = tidy((b.match(/<p class="purchase_user"><span>([\s\S]*?)<\/span>/) || [])[1] || "");
    const who = tidy((b.match(/を購入したユーザー([\s\S]*?)<\/p>/) || [])[1] || "");
    const date = tidy((b.match(/<p class="post_date">([\s\S]*?)<\/p>/) || [])[1] || "").replace(/^投稿日：/, "");
    const score = Number((b.match(/<dl class="comprehensive_evaluation">[\s\S]*?<dd>([\d.]+)<\/dd>/) || [])[1]);
    const head = tidy((b.match(/<p class="view"[^>]*>\s*<span>([\s\S]*?)<\/span>/) || [])[1] || "");
    const more = /レビューを詳しく見る/.test(b);
    if (!head && !href) continue;
    reviews.push({ car, who, date, score, text: head, more, url: href ? "https://www.goo-net.com" + href : null });
  }

  // 続きがあるものは詳細ページから全文を取る
  for (const r of reviews) {
    if (!r.more || !r.url) continue;
    try {
      const d = await get(r.url);
      const full = tidy((d.match(/<dl class="comment">[\s\S]*?<dd>([\s\S]*?)<\/dd>/) || [])[1] || "");
      if (full && full.length > r.text.length) r.text = full;
    } catch (e) { /* 取れなければ冒頭のままにする */ }
  }

  const out = { checkedAt: new Date().toISOString().slice(0, 16).replace("T", " "), source: LIST, scores, count: reviews.length, reviews };
  fs.writeFileSync(path.join(DATA, "reviews_latest.json"), JSON.stringify(out, null, 2), "utf8");

  const L = [];
  L.push(`# Pazoo グーネットの口コミ（${out.checkedAt} 取得）`);
  L.push("");
  L.push("## 店の評価");
  Object.keys(scores).forEach((k) => L.push(`- ${k}：**${scores[k]}**`));
  L.push("");
  L.push(`## 口コミ ${reviews.length}件`);
  reviews.forEach((r, i) => {
    L.push(`### ${i + 1}. ${r.score} ／ ${r.car}／${r.who}／${r.date}`);
    L.push(`> ${r.text}`);
    if (r.url) L.push(`（${r.url}）`);
    L.push("");
  });
  const md = L.join("\n");
  fs.writeFileSync(path.join(DATA, "口コミ_latest.md"), md, "utf8");
  console.log(md);
};

main().catch((e) => { console.error("失敗: " + e.message); process.exit(1); });
