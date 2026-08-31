import puppeteer from "puppeteer-core";
import { base, CHROME, settle } from "./port.mjs";
const BASE=await base();
const b=await puppeteer.launch({executablePath:CHROME,headless:true,
 defaultViewport:{width:1440,height:900,deviceScaleFactor:1},args:["--hide-scrollbars"]});
const p=await b.newPage(); await p.goto(BASE,{waitUntil:"networkidle2"}); await settle(p);
console.log(await p.evaluate(()=>{
 const f=document.querySelector(".request-photo"), i=f.querySelector("img");
 const g=e=>{const c=getComputedStyle(e);return `bg=${c.backgroundColor} bgi=${c.backgroundImage.slice(0,40)} fit=${c.objectFit}`};
 const par=f.parentElement;
 return `figure ${g(f)}\nimg    ${g(i)}\n親     ${par.className} ${g(par)}`;
}));
await b.close();
