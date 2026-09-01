import puppeteer from "puppeteer-core";
import { base, CHROME, settle } from "./port.mjs";
const B=await base();
const out="/private/tmp/claude-501/-Users-rintaro-Job-LP-asb-lp-Y2K/102e0f0a-49b5-4b79-a0b5-ce2c1026da97/scratchpad/";
const b=await puppeteer.launch({executablePath:CHROME,headless:true,defaultViewport:{width:1440,height:900},args:["--hide-scrollbars"]});
const p=await b.newPage(); await p.goto(B,{waitUntil:"networkidle2"}); await settle(p);
for (const [sel,n] of [[".scene--request .scene-label","lbl-01"],[".price-title-overlay","lbl-04"]]) {
  await p.evaluate(s=>document.querySelector(s).scrollIntoView({block:"center"}),sel);
  await new Promise(r=>setTimeout(r,500));
  await (await p.$(sel)).screenshot({path:`${out}${n}.png`});
}
console.log(JSON.stringify(await p.evaluate(()=>{
  const o={};
  for (const [k,s] of [["s01",".scene--request .scene-label span"],["s04",".price-title-overlay .scene-label span"],["e04",".price-title-overlay .scene-label em"]]) {
    const e=document.querySelector(s); if(!e){o[k]="none";continue;}
    const c=getComputedStyle(e);
    o[k]={bg:c.backgroundColor,bgImg:c.backgroundImage.slice(0,40),color:c.color,pad:c.padding,br:c.borderRadius,bs:c.boxShadow};
  }
  return o;
})));
await b.close();
