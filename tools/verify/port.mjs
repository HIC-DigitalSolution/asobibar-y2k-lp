/* dev server のポートは起動ごとに変わるので都度探す。
   LP_PORT を渡せばそれを使う。 */
export async function base() {
  if (process.env.LP_PORT) return `http://localhost:${process.env.LP_PORT}/`;
  const { execSync } = await import("node:child_process");
  const ports = execSync(
    "lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | grep -i python | awk '{print $9}' | sed 's/.*://' | sort -u",
  ).toString().trim().split("\n").filter(Boolean);
  for (const p of ports) {
    try {
      const r = await fetch(`http://localhost:${p}/`, { signal: AbortSignal.timeout(1500) });
      if ((await r.text()).includes("ASOBIBAR")) return `http://localhost:${p}/`;
    } catch (e) { /* 次を試す */ }
  }
  throw new Error("dev server が見つからない。試したポート: " + ports.join(", "));
}

export const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/* 撮影前に必ず通す下ごしらえ。
   スクロール連動とリビールは IntersectionObserver 待ちなので、
   撮る前に「到達済み」の状態へ固定しないと真っ白なコマが混ざる。 */
export async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 1200));
  await page.evaluate(() => {
    document.documentElement.classList.add("motion-ready", "reveal-ready");
    document.querySelectorAll("[data-scene-motion]").forEach((s) => s.classList.add("is-scene-in"));
    document.querySelectorAll("[data-reveal]").forEach((e) => e.classList.add("is-in"));
    document.querySelectorAll("video").forEach((v) => { try { v.pause(); v.currentTime = 0; } catch (e) {} });
    const st = document.createElement("style");
    st.textContent = "*,*::before,*::after{animation:none!important;transition:none!important}";
    document.head.appendChild(st);
    document.documentElement.style.scrollBehavior = "auto";
  });
  await new Promise((r) => setTimeout(r, 600));
}
