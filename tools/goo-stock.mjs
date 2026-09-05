/* Pazoo：グーネットの在庫一覧を1日1回取りにいって、読める形で出す。
   使い方： node C:/HQ/projects/pazoo-hp/tools/goo-stock.mjs
   出力：  data/stock_latest.json（機械用）／data/在庫_latest.md（社長が読む用）／data/history/stock_YYYY-MM-DD.json（記録）
   ★要約AIは使わない。車名や価格を取り違えるため（2026-09-04 に WebFetch が「ジムニー」を「ムーヴ」と読んだ）。 */

import fs from "node:fs";
import path from "node:path";

const SHOP = "0902905";                       // グーネットの店舗コード（写真URLの 7000902905 とは別）
const URL_ = `https://www.goo-net.com/usedcar_shop/${SHOP}/stock.html`;
const ROOT = "C:/HQ/projects/pazoo-hp";
const DATA = path.join(ROOT, "data");
const HIST = path.join(DATA, "history");
const LINEOUT = path.join(DATA, "stock_line.txt");   // けんしろうの21時LINEに足す1行（変化が無い日は空）
const QUIET = process.argv.includes("--quiet");      // 無人実行用：標準出力を出さない・失敗しても exit 0

const jstNow = () => new Date(Date.now() + 9 * 3600 * 1000);
const ymd = (d) => d.toISOString().slice(0, 10);

function tidy(s) {
  return s.replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/[\u3000\s]+/g, " ").trim();
}
function num(s) { const n = parseFloat(String(s).replace(/,/g, "")); return isNaN(n) ? null : n; }

async function fetchHtml() {
  const res = await fetch(URL_, {
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36",
      "accept-language": "ja,en;q=0.8"
    }
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  // ★グーネットは EUC-JP。UTF-8 として読むと全部化ける
  return new TextDecoder("euc-jp").decode(await res.arrayBuffer());
}

function parse(html) {
  const cars = [];
  const blocks = html.split('class="box_item_detail').slice(1);
  for (const b of blocks) {
    const id = (b.match(/id="tr_(\d{21})"/) || [])[1];
    if (!id) continue;

    const name = tidy((b.match(/<h3 class="car_box_title">[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/) || [])[1] || "");
    const photo = (b.match(/src="(https:\/\/picture1\.goo-net\.com\/[^"]+\.jpg)"/) || [])[1] || null;

    // 値段は「価格セルの中だけ」で探す。外まで探すとローンの月々（<em>13,500</em>）を拾ってしまう
    const priceCell = (b.match(/<td class="price[\s\S]*?<\/td>/) || [""])[0];
    const totalRaw = tidy((priceCell.match(/<div class="priceAllNum">\s*<em>([^<]*)<\/em>/) || [])[1] || "");
    const bodyRaw = tidy((priceCell.match(/<p class="car">[\s\S]*?<em>([^<]*)<\/em>/) || [])[1] || "");
    const total = num(totalRaw);             // "--" や "ASK" は null になる
    const body = num(bodyRaw);
    const ask = total === null && /ASK|応談|要問合せ/.test(totalRaw + bodyRaw + priceCell);

    // ★セルの中に <br/> が入る（例 2024<br/>(令和6)年）。[^<]* では取れないので順番に拾う
    const after = b.slice(b.indexOf(priceCell) + priceCell.length);
    const tds = [...after.matchAll(/<td class="w\d+">([\s\S]*?)<\/td>/g)].map((m) => tidy(m[1]));

    cars.push({
      id,
      name,
      year: tds[0] ?? null,
      km: (tds[1] ?? "").includes("不明") ? "不明" : (tds[1] ?? null),
      cc: tds[2] ?? null,
      repair: tds[3] ?? null,                // 修復歴 あり／なし
      shaken: tds[4] ?? null,                // 車検
      area: tds[5] ?? null,
      priceTotal: total,                     // 支払総額（万円）
      priceBody: body,                       // 車両本体（万円）
      ask,
      photo,
      url: `https://www.goo-net.com/usedcar/spread/goo/11/${id}.html`
    });
  }
  return cars;
}

function fmt(c) {
  const p = c.priceTotal != null ? `支払総額 ${c.priceTotal}万円` : (c.ask ? "支払総額 要問合せ" : "支払総額 不明");
  const b = c.priceBody != null ? `（本体 ${c.priceBody}万円）` : "";
  return `- **${c.name}**\n  ${c.year} ／ ${c.km} ／ ${c.cc} ／ 修復歴${c.repair} ／ 車検${c.shaken}\n  ${p}${b}\n  ${c.url}`;
}

function diff(prev, now) {
  if (!prev) return { first: true, added: [], gone: [], changed: [] };
  const pm = new Map(prev.cars.map((c) => [c.id, c]));
  const nm = new Map(now.map((c) => [c.id, c]));
  const added = now.filter((c) => !pm.has(c.id));
  const gone = prev.cars.filter((c) => !nm.has(c.id));
  const changed = [];
  for (const c of now) {
    const o = pm.get(c.id);
    if (!o) continue;
    if (o.priceTotal !== c.priceTotal) changed.push({ car: c, what: "支払総額", from: o.priceTotal, to: c.priceTotal });
    if (o.shaken !== c.shaken) changed.push({ car: c, what: "車検", from: o.shaken, to: c.shaken });
  }
  return { first: false, added, gone, changed };
}

const main = async () => {
  fs.mkdirSync(HIST, { recursive: true });
  const html = await fetchHtml();
  const cars = parse(html);
  if (cars.length === 0) throw new Error("1台も読めなかった（ページの作りが変わった可能性）。生HTMLを data/_last.html に残す");

  const prevPath = path.join(DATA, "stock_latest.json");
  const prev = fs.existsSync(prevPath) ? JSON.parse(fs.readFileSync(prevPath, "utf8")) : null;
  const d = diff(prev, cars);

  const now = jstNow();
  const stamp = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")} ${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;
  const out = { checkedAt: stamp, source: URL_, count: cars.length, cars };

  fs.writeFileSync(prevPath, JSON.stringify(out, null, 2), "utf8");
  fs.writeFileSync(path.join(HIST, `stock_${ymd(now)}.json`), JSON.stringify(out, null, 2), "utf8");

  const lines = [];
  lines.push(`# Pazoo 在庫（グーネット） ${stamp} 時点`);
  lines.push("");
  lines.push(`**${cars.length}台**　出典 ${URL_}`);
  lines.push("");
  if (d.first) {
    lines.push("（初回のため前回との比較はありません）");
  } else if (!d.added.length && !d.gone.length && !d.changed.length) {
    lines.push("前回から**変更なし**。");
  } else {
    lines.push("## 前回からの変化");
    d.added.forEach((c) => lines.push(`- 🆕 **入った**：${c.name}`));
    d.gone.forEach((c) => lines.push(`- ✅ **消えた（売れた可能性）**：${c.name}`));
    d.changed.forEach((c) => lines.push(`- 🔁 ${c.car.name}：${c.what} ${c.from} → ${c.to}`));
  }
  lines.push("");
  lines.push("## いまの在庫");
  cars.forEach((c) => lines.push(fmt(c)));
  lines.push("");
  const md = lines.join("\n");
  fs.writeFileSync(path.join(DATA, "在庫_latest.md"), md, "utf8");

  // ── けんしろうの21時LINEに合流させる1行（2026-09-04 社長決定）
  //    社長「変わった日だけ知らせる」＝変化が無い日は空にする。空なら format-line-url.mjs は何も足さない。
  let line = "";
  if (d.first) {
    line = `■ Pazoo在庫 ${cars.length}台（記録開始）`;
  } else if (d.added.length || d.gone.length || d.changed.length) {
    const b = [];
    if (d.added.length) b.push(`🆕${d.added.length}`);
    if (d.gone.length) b.push(`✅${d.gone.length}`);
    if (d.changed.length) b.push(`🔁${d.changed.length}`);
    line = `■ Pazoo在庫 ${cars.length}台（${b.join(" ")}）`;
  }
  fs.writeFileSync(LINEOUT, line, "utf8");

  if (!QUIET) {
    console.log(md);
    console.log(`\n[保存] ${prevPath}`);
    console.log(`[LINE用] ${LINEOUT} ${line ? "= " + line : "= （変化なしのため空）"}`);
  }
};

main().catch((e) => {
  // 無人実行で落ちても夜間処理を止めない。★取れなかった日は前回のJSONを残す（明日の比較を壊さないため）
  const msg = "失敗: " + e.message;
  console.error(msg);
  try {
    fs.mkdirSync(DATA, { recursive: true });
    fs.appendFileSync(path.join(DATA, "goo-stock.log"), `${new Date().toISOString()} ${msg}\n`, "utf8");
    fs.writeFileSync(LINEOUT, "■ Pazoo在庫 取得できず（グーネットに繋がらないかページの作りが変わった）", "utf8");
  } catch { /* ログすら書けないときは何もしない */ }
  process.exit(QUIET ? 0 : 1);
});
