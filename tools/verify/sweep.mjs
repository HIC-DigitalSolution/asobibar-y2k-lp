/* ページ全体を一定間隔で撮る。
   使い方: node tools/verify/sweep.mjs <出力ディレクトリ名>
   CSSを消す前後で撮って compare.mjs にかけると、
   「表示は変わっていない」を目視ではなく数値で言える。 */
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
import { base, CHROME, settle } from "./port.mjs";

const BASE = await base();
const dir = process.argv[2] || "base";
const out = new URL(`./shots/${dir}/`, import.meta.url).pathname;
mkdirSync(out, { recursive: true });

let n = 0;
for (const [W, H, mob, tag] of [[1440, 900, false, "pc"], [390, 780, true, "sp"]]) {
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    defaultViewport: { width: W, height: H, deviceScaleFactor: 1, isMobile: mob, hasTouch: mob },
    args: ["--hide-scrollbars"],
  });
  const p = await b.newPage();
  await p.goto(BASE, { waitUntil: "networkidle2" });
  await settle(p);
  const docH = await p.evaluate(() => document.body.scrollHeight);
  let i = 0;
  for (let y = 0; y < docH - 100; y += Math.round(H * 0.9)) {
    await p.evaluate((v) => window.scrollTo(0, v), y);
    await new Promise((r) => setTimeout(r, 340));
    await p.screenshot({ path: `${out}${tag}-${String(i).padStart(2, "0")}.png` });
    i++; n++;
  }
  await b.close();
}
console.log(`${dir}: ${n}枚`);
