/* セクションの位置とページ全体の高さを出す。
   CSSを触ったあとに「レイアウトは動いていない」を数値で確かめる用。 */
import puppeteer from "puppeteer-core";
import { base, CHROME, settle } from "./port.mjs";
const BASE = await base();
const W = Number(process.argv[2] || 390), H = Number(process.argv[3] || 780);
const b = await puppeteer.launch({ executablePath: CHROME, headless: true,
  defaultViewport: { width: W, height: H, deviceScaleFactor: 1, isMobile: W < 768, hasTouch: W < 768 },
  args: ["--hide-scrollbars"] });
const p = await b.newPage();
await p.goto(BASE, { waitUntil: "networkidle2" });
await settle(p);
console.log(JSON.stringify(await p.evaluate(() => {
  const o = { docH: document.body.scrollHeight };
  document.querySelectorAll("section[data-page], .final-night").forEach((s) => {
    o[s.dataset.page || s.className.split(" ")[1]] = Math.round(s.getBoundingClientRect().top + window.scrollY);
  });
  return o;
})));
await b.close();
