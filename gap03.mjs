import puppeteer from "puppeteer-core";
import { base } from "./port.mjs";
const BASE = await base();
const CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const b=await puppeteer.launch({executablePath:CHROME,headless:true,
 defaultViewport:{width:1440,height:900,deviceScaleFactor:1},args:["--hide-scrollbars"]});
const p=await b.newPage();
await p.goto(BASE,{waitUntil:"networkidle2"});
await p.evaluate(()=>document.fonts.ready);
await new Promise(r=>setTimeout(r,1100));
await p.evaluate(()=>{document.documentElement.classList.add('motion-ready','reveal-ready');
 document.querySelectorAll('[data-scene-motion]').forEach(s=>s.classList.add('is-scene-in'));
 document.querySelectorAll('[data-reveal]').forEach(e=>e.classList.add('is-in'));});
await new Promise(r=>setTimeout(r,400));
console.log(await p.evaluate(()=>{
 const R=q=>{const e=document.querySelector(q); if(!e)return null; const r=e.getBoundingClientRect();
  return {l:Math.round(r.left),r:Math.round(r.right),t:Math.round(r.top),b:Math.round(r.bottom),w:Math.round(r.width),h:Math.round(r.height)}};
 const sec=R(".scene--play"), copy=R(".play-copy"), face=R(".play-copy .sheet__face"),
   txt=R("#play .scene-text"), photo=R(".play-photo"), seal=R(".y2k-sticker--play");
 const card=R(".price-copy .plan-prices > div");
 const cs=card?getComputedStyle(document.querySelector(".price-copy .plan-prices > div")):null;
 return [
  `[03] セクション ${sec.w}x${sec.h}`,
  `     紙 ${copy.w}x${copy.h}  面 ${face.w}x${face.h}`,
  `     本文の下端 ${txt.b} → 紙の下端 ${copy.b}  空き ${copy.b-txt.b}px`,
  `     写真 ${photo.w}x${photo.h}   シール ${seal.w}x${seal.h}`,
  `     紙の右端 ${copy.r} → 写真の左端 ${photo.l}  間 ${photo.l-copy.r}px`,
  ``,
  `[05] 料金カード ${card.w}x${card.h}`,
  `     background = ${cs.backgroundColor}`,
  `     border = ${cs.border}`,
 ].join("\n");
}));
await b.close();
