/* JSエラー・404・グリフ欠けをまとめて見る。作業のたびに通す。 */
import puppeteer from "puppeteer-core";
import { base, CHROME, settle } from "./port.mjs";
const BASE = await base();
const b = await puppeteer.launch({ executablePath: CHROME, headless: true,
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 }, args: ["--hide-scrollbars"] });
const p = await b.newPage();
const errs = [], fails = [];
p.on("pageerror", (e) => errs.push(e.message));
p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
p.on("response", (r) => { if (r.status() >= 400) fails.push(`${r.status()} ${r.url().split("/").pop()}`); });
await p.goto(BASE, { waitUntil: "networkidle2" });
await settle(p);
const H = await p.evaluate(() => document.body.scrollHeight);
for (let y = 0; y < H; y += 450) { await p.evaluate((v) => window.scrollTo(0, v), y); await new Promise((r) => setTimeout(r, 70)); }
const glyph = await p.evaluate(() => {
  const bad = new Map(); let n = 0;
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = w.nextNode())) {
    const t = (node.textContent || "").trim(); if (!t) continue;
    const el = node.parentElement; if (!el) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const fam = cs.fontFamily.split(",")[0].trim();
    for (const ch of new Set(t)) {
      if (/\s/.test(ch)) continue; n++;
      if (!document.fonts.check(`${cs.fontWeight} 16px ${fam}`, ch)) {
        const k = `${fam} ${cs.fontWeight}`;
        if (!bad.has(k)) bad.set(k, new Set());
        bad.get(k).add(ch);
      }
    }
  }
  return { checked: n, missing: [...bad.entries()].map(([k, v]) => `${k}: ${[...v].join("")}`) };
});
console.log(`docH ${H}`);
console.log("JSエラー:", errs.length ? errs.slice(0, 3) : "なし");
console.log("読み込み失敗:", fails.length ? [...new Set(fails)].slice(0, 5) : "なし");
console.log(`グリフ: ${glyph.checked}文字を検査、欠け ${glyph.missing.length ? glyph.missing : "なし"}`);
await b.close();
