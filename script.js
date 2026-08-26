/* =========================================================
   ASOBIBAR Y2K NIGHT
   Reservation routing / page number / scene motion
   ========================================================= */

/* ---------------------------------------------------------
   予約先の一元設定
   ---------------------------------------------------------
   HTML側の href は公式HP（https://asobibar.net/）を既定にして
   あるので、ここが空でもボタンは必ず機能する。旧版は空文字だと
   ボタンを全部 hidden にして「準備中です」と出すだけになり、
   LP上に押せるCTAが1つも無い状態だった。
   LINE予約URLが確定したら、承認済みのHTTPS URLをここに入れる。
   --------------------------------------------------------- */
const OFFICIAL_RESERVATION_URL = "https://asobibar.net/";
const OFFICIAL_RESERVATION_LABEL = "公式HPから予約する";
const LINE_RESERVATION_URL = "";
const LINE_RESERVATION_LABEL = "LINEで予約する";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOutCubic = (t) => 1 - (1 - t) ** 3;

/* ---------- 見出しを行に割る ----------
   ブロックごとフェードさせると、読む順番と動きが噛み合わない。
   <br> で行に割って、行ごとに下から立ち上げる。
   属性付きの <br>（.sp-br など）は割らない。SP専用の改行なので、
   割ると PC の行数が変わってしまう。 */
(() => {
  const targets = document.querySelectorAll(
    ".scene-title, .paper-h, .info-heading h2, .final-night__content h2, .karaoke-type, .play-type",
  );

  targets.forEach((el) => {
    if (el.dataset.lines) return;
    const parts = el.innerHTML.split(/<br\s*\/?>/i);
    el.innerHTML = parts
      .map((part, i) => `<span class="ln" style="--ln:${i}"><i>${part}</i></span>`)
      .join("");
    el.dataset.lines = String(parts.length);
  });
})();

/* ---------- 予約リンクと表示文言を必ず一致させる ---------- */
(() => {
  let reservationUrl = OFFICIAL_RESERVATION_URL;
  let reservationLabel = OFFICIAL_RESERVATION_LABEL;
  let reservationMethod = "公式HPから予約";

  if (LINE_RESERVATION_URL) {
    try {
      const lineUrl = new URL(LINE_RESERVATION_URL);
      if (lineUrl.protocol === "https:") {
        reservationUrl = lineUrl.href;
        reservationLabel = LINE_RESERVATION_LABEL;
        reservationMethod = "LINEから予約";
      }
    } catch {
      /* 不正なURLの場合は公式HPへ安全にフォールバックする */
    }
  }

  document.querySelectorAll("[data-reserve]").forEach((a) => {
    a.href = reservationUrl;
    const label = a.querySelector("[data-reserve-label]");
    if (label) label.textContent = reservationLabel;
  });

  document.querySelectorAll("[data-reservation-method]").forEach((el) => {
    el.textContent = reservationMethod;
  });
})();

/* ---------- シーンモーション ----------
   IntersectionObserverで一度だけシーンを起動し、PCのみスクロール量を
   CSS Custom Propertiesへ渡す。スクロール自体は奪わない。 */
(() => {
  const scenes = [...document.querySelectorAll("[data-scene-motion]")];
  if (!scenes.length) return;

  const requestDeck = document.querySelector("[data-request-player]");
  const deckTime = document.querySelector("[data-deck-time]");
  const deckPlay = document.querySelector("[data-deck-play]");
  const desktopMotion = window.matchMedia("(min-width: 1024px) and (pointer: fine)");
  const activeScenes = new Set();
  let scrollFrame = 0;

  /* ---------- SONG REQUEST のスクラブ ----------
     旧実装は is-playing で1回だけバーを流すだけだった。
     スクロール量に直結させ、タイムコードも一緒に進める。
     音は鳴らさない（ブラウザが止めるし、押しつけになる）。 */
  const DECK_TOTAL = 225; /* 03:45 */
  let deckSelfPlaying = false;

  const paintDeck = (value) => {
    if (!requestDeck) return;
    const t = clamp01(value);
    requestDeck.style.setProperty("--deck", t.toFixed(4));
    if (deckTime) {
      const s = Math.floor(DECK_TOTAL * t);
      const mm = String(Math.floor(s / 60)).padStart(2, "0");
      const ss = String(s % 60).padStart(2, "0");
      deckTime.textContent = `MEMORY ${mm}:${ss}`;
    }
  };

  if (deckPlay) {
    deckPlay.addEventListener("click", () => {
      if (reduceMotion) {
        paintDeck(1);
        return;
      }
      const start = performance.now();
      deckSelfPlaying = true;
      const step = (now) => {
        const t = clamp01((now - start) / 2600);
        paintDeck(t);
        if (t < 1) requestAnimationFrame(step);
        else deckSelfPlaying = false;
      };
      requestAnimationFrame(step);
    });
  }

  const playScene = (scene) => {
    if (scene.classList.contains("is-scene-in")) return;
    scene.classList.add("is-scene-in");

    /* SONG REQUEST は状態表示を点灯させる。バーの進みはスクロール直結。 */
    if (scene.dataset.sceneMotion === "request" && requestDeck) {
      window.setTimeout(() => requestDeck.classList.add("is-playing"), reduceMotion ? 0 : 150);
    }

    /* 数字を主役にする。0から実数まで数え上げる */
    scene.querySelectorAll("[data-count]").forEach((el, i) => {
      const target = Number.parseInt(el.dataset.count, 10);
      if (!Number.isFinite(target) || el.dataset.counted) return;
      el.dataset.counted = "1";

      const final = el.textContent;
      const mirror = el.parentElement && el.parentElement.querySelector("[data-count-mirror]");
      if (reduceMotion) return; /* 最終値のまま置いておく */

      const begin = performance.now() + i * 90;
      const step = (now) => {
        if (now < begin) {
          requestAnimationFrame(step);
          return;
        }
        const t = clamp01((now - begin) / 680);
        el.textContent = Math.round(target * easeOutCubic(t)).toLocaleString("ja-JP");
        /* 版ズレの複製にも同じ値を書く。放置すると数え上げ中だけ
           complement 側が最終値のまま残り、版ズレではなく別の数字に見える */
        if (mirror) mirror.textContent = el.textContent;
        if (t < 1) requestAnimationFrame(step);
        else {
          el.textContent = final; /* 桁区切りを元の表記に戻す */
          if (mirror) mirror.textContent = final;
        }
      };
      requestAnimationFrame(step);
    });
  };

  if (reduceMotion || !("IntersectionObserver" in window)) {
    scenes.forEach(playScene);
    return;
  }

  document.documentElement.classList.add("motion-ready");

  const entranceObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        playScene(entry.target);
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -10%", threshold: 0.16 },
  );

  scenes
    .filter((scene) => scene.dataset.sceneMotion !== "hero")
    .forEach((scene) => entranceObserver.observe(scene));

  /* 最初の描画を1フレーム見せてからHeroを開始し、CLSを発生させずに
     背景→情報→CTAの順序を作る。 */
  const hero = scenes.find((scene) => scene.dataset.sceneMotion === "hero");
  if (hero) requestAnimationFrame(() => requestAnimationFrame(() => playScene(hero)));

  const updateSceneProgress = () => {
    scrollFrame = 0;

    const viewportHeight = window.innerHeight || 1;
    /* px単位のパララックスはPCのマウス時だけ。進捗そのものは
       全環境で配る（スクラブとpinはSPでも使う）。 */
    const wide = desktopMotion.matches;

    activeScenes.forEach((scene) => {
      const rect = scene.getBoundingClientRect();
      const progress = clamp01((viewportHeight - rect.top) / (viewportHeight + rect.height));
      const travel = (progress - 0.5) * 2;
      scene.style.setProperty("--scene-progress", progress.toFixed(4));

      /* pin区間の進捗。sticky が貼り付いている間だけ 0→1 になる。
         セクションが1画面以下なら pin する余地が無いので progress を流す。 */
      const pinRange = rect.height - viewportHeight;
      const pin = pinRange > 40 ? clamp01(-rect.top / pinRange) : progress;
      scene.style.setProperty("--pin", pin.toFixed(4));

      /* 抜ける直前の退き。最後の28%だけ効かせる */
      scene.style.setProperty("--exit", clamp01((pin - 0.72) / 0.28).toFixed(4));

      /* 境界用の2本。--enter はセクションの上辺が画面下→画面上へ、
         --leave は下辺が画面下→画面上へ動く間の進捗。
         隣り合うセクションの leave と enter は同じ境界を指すので、
         前のシーンの退場と次のシーンの入場を噛み合わせられる。 */
      const enter = clamp01((viewportHeight - rect.top) / viewportHeight);
      const leave = clamp01((viewportHeight - rect.bottom) / viewportHeight);
      scene.style.setProperty("--enter", enter.toFixed(4));
      scene.style.setProperty("--leave", leave.toFixed(4));

      if (wide) {
        scene.style.setProperty("--scene-y", `${(travel * 40).toFixed(2)}px`);
        scene.style.setProperty("--scene-y-soft", `${(travel * 26).toFixed(2)}px`);
        scene.style.setProperty("--scene-y-reverse", `${(travel * -28).toFixed(2)}px`);
      }

      /* SONG REQUEST の段送り。pin区間を7つに割る。
         progress bar は 35〜75% の帯だけを使い、
         そこへ入る前は0、抜けたら1で止める。 */
      if (requestDeck && scene.dataset.sceneMotion === "request") {
        if (!deckSelfPlaying) paintDeck((pin - 0.35) / 0.4);
        requestDeck.classList.toggle("is-mode-on", pin >= 0.55);

        /* 段のランプをJSで出す。CSS側で clamp や min を calc に
           入れ子にすると、宣言ごと落ちる環境があった（実測で
           PLAYの押し込みとCDの退場が効かなかった）。
           0→1 の素の数値を渡して、CSSは掛けるだけにする。 */
        const ramp = (from, to) => clamp01((pin - from) / (to - from)).toFixed(4);
        scene.style.setProperty("--s-play", ramp(0, 0.15));
        scene.style.setProperty("--s-track", ramp(0.05, 0.15));
        scene.style.setProperty("--s-photo", ramp(0.75, 0.9));
        scene.style.setProperty("--s-exit", ramp(0.9, 1));
      }
    });
  };

  const requestProgressUpdate = () => {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(updateSceneProgress);
  };

  const activityObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) activeScenes.add(entry.target);
        else activeScenes.delete(entry.target);
      });
      requestProgressUpdate();
    },
    { rootMargin: "35% 0px" },
  );

  scenes.forEach((scene) => activityObserver.observe(scene));
  window.addEventListener("scroll", requestProgressUpdate, { passive: true });
  window.addEventListener("resize", requestProgressUpdate, { passive: true });
  desktopMotion.addEventListener?.("change", requestProgressUpdate);

  /* Heroの一枚絵そのものを壊さず、PCのマウス時だけごく弱く反応させる。 */
  if (hero) {
    let pointerFrame = 0;
    let pointerX = 0;
    let pointerY = 0;

    const updatePointer = () => {
      pointerFrame = 0;
      hero.style.setProperty("--hero-x", `${pointerX.toFixed(2)}px`);
      hero.style.setProperty("--hero-y", `${pointerY.toFixed(2)}px`);
    };

    hero.addEventListener(
      "pointermove",
      (event) => {
        if (!desktopMotion.matches) return;
        const rect = hero.getBoundingClientRect();
        pointerX = ((event.clientX - rect.left) / rect.width - 0.5) * 8;
        pointerY = ((event.clientY - rect.top) / rect.height - 0.5) * 6;
        if (!pointerFrame) pointerFrame = requestAnimationFrame(updatePointer);
      },
      { passive: true },
    );

    hero.addEventListener("pointerleave", () => {
      pointerX = 0;
      pointerY = 0;
      if (!pointerFrame) pointerFrame = requestAnimationFrame(updatePointer);
    });
  }
})();

/* ---------- ノンブル（ページ番号） ---------- */
(() => {
  const nombre = document.querySelector("[data-nombre]");
  const sections = [...document.querySelectorAll("[data-theme]")];
  let ticking = false;

  const update = () => {
    ticking = false;

    /* 誌面のノンブル。いま見ているセクションの順番を出す */
    if (nombre && sections.length) {
      const mid = window.innerHeight / 2;
      let idx = 0;
      sections.forEach((s, i) => {
        const r = s.getBoundingClientRect();
        if (r.top <= mid) idx = i;
      });
      /* 印刷されている節番号（data-page）に合わせる。
         以前は表紙を1として数えていたので、誌面の「05」に対して
         ノンブルが「06」を出していた。 */
      nombre.textContent = sections[idx].dataset.page || String(idx + 1).padStart(2, "0");
    }

  };

  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    },
    { passive: true },
  );
  window.addEventListener("resize", update, { passive: true });
  update();
})();

/* ---------- 出現アニメーション ---------- */
(() => {
  const items = [...document.querySelectorAll("[data-reveal]")];
  if (!items.length) return;

  if (reduceMotion || !("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-in"));
    return;
  }

  /* JSが正常に起動した時だけ非表示状態を有効にする。
     file://表示や通信障害でJSが読めない場合も本文を消さない。 */
  document.documentElement.classList.add("reveal-ready");

  const io = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((e) => {
        /* 通り過ぎた要素も出す。isIntersecting だけを見ると、アンカー
           遷移や高速スクロールで飛ばされた要素が隠れたままになる。 */
        const passed = e.rootBounds && e.boundingClientRect.bottom < e.rootBounds.top;
        if (e.isIntersecting || passed) {
          e.target.classList.add("is-in");
          obs.unobserve(e.target);
        }
      });
    },
    { rootMargin: "0px 0px -8%", threshold: 0.14 },
  );
  items.forEach((el) => io.observe(el));

  /* IntersectionObserver は高速な通過を取りこぼすことがあるので、
     スクロールが止まったタイミングで画面より上を掃除する。 */
  let sweep = null;
  window.addEventListener(
    "scroll",
    () => {
      clearTimeout(sweep);
      sweep = setTimeout(() => {
        items.forEach((el) => {
          if (el.classList.contains("is-in")) return;
          if (el.getBoundingClientRect().top < window.innerHeight * 0.9) {
            el.classList.add("is-in");
            io.unobserve(el);
          }
        });
      }, 140);
    },
    { passive: true },
  );
})();

/* ---------- 固定CTAの出し入れ ----------
   隠す条件は2つ。
   - FV内の予約ボタンが見えている（ロード直後に同じボタンが2つ並ぶ）
   - 最終CTAが見えている
   初期状態の非表示はJSから付ける。CSSで最初から隠すと、JSが
   読めなかった時に押せるCTAが1つも無くなる。 */
(() => {
  const bar = document.querySelector("[data-ctabar]");
  if (!bar || !("IntersectionObserver" in window)) return;

  const heroCta = document.querySelector(".cover .cta");
  const finalSection = document.querySelector("#reserve");
  const requestScene = document.querySelector("#experience");
  if (!heroCta && !finalSection) return;

  const visible = new Set();

  /* 01「曲リクエスト」に到達するまでは出さない。
     以前は「FVのボタンが見えなくなったら出す」だったので、
     出るタイミングがFVの高さに依存していた。 */
  let reached = !requestScene;

  const sync = () =>
    bar.classList.toggle("is-suppressed", !reached || visible.size > 0);

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      });
      sync();
    },
    { threshold: 0.18 },
  );

  if (heroCta) {
    /* ロード時点ではまだ観測結果が無いので、FVのボタンがある前提で
       先に隠しておく。1フレーム後に実測で確定する。 */
    bar.classList.add("is-suppressed");
    io.observe(heroCta);
  }
  if (finalSection) io.observe(finalSection);

  if (requestScene) {
    bar.classList.add("is-suppressed");
    const gate = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        reached = true;
        gate.disconnect();
        sync();
      },
      { threshold: 0.12 },
    );
    gate.observe(requestScene);
  }
})();

/* ===================== シールを剥がして動かす =====================
   タッチではドラッグとスクロールが同じ操作（指を置いて動かす）から
   始まるので、素直に実装するとスクロールを奪う。
   タッチのときだけ「長押しで持ち上げる」を挟んで区別する。
   素早いスワイプは一度も反応しないので、スクロールは無傷。
   マウス・ペンは誤爆の心配が無いので即ドラッグ。

   位置は CSS の translate プロパティ（--peel-x/--peel-y）で与える。
   transform は回転と登場アニメが使っているので触らない。 */
(() => {
  const seals = document.querySelectorAll("[data-peel]");
  if (!seals.length) return;

  const HOLD_MS = 350; /* 長押しと判定するまで */
  const SLOP = 10; /* これ以上動いたらスクロールとみなす */
  const KEY = "y2k-peel";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* 位置は同じ訪問の間だけ覚える。次に来たときは元に戻っていてほしい */
  let saved = {};
  try {
    saved = JSON.parse(sessionStorage.getItem(KEY) || "{}");
  } catch (e) {
    saved = {};
  }

  const idOf = (el) => el.className.toString().trim().split(/\s+/).join(".");

  const put = (el, x, y) => {
    el.style.setProperty("--peel-x", `${Math.round(x)}px`);
    el.style.setProperty("--peel-y", `${Math.round(y)}px`);
  };

  const store = () => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(saved));
    } catch (e) {
      /* プライベートモードでは保存できない。動作自体は続ける */
    }
  };

  seals.forEach((el) => {
    const id = idOf(el);
    const at = saved[id];
    if (at) put(el, at.x, at.y);

    let active = null; /* 掴んでいるポインタのid */
    let armed = false;
    let timer = 0;
    let startX = 0;
    let startY = 0;
    let baseX = 0;
    let baseY = 0;

    const disarm = () => {
      window.clearTimeout(timer);
      timer = 0;
      el.classList.remove("is-arming");
    };

    /* 掴んだ位置から「どの辺が浮くか」を決める。
       右端を掴めば右辺が浮く＝左辺を軸にY回転、という具合。
       軸は掴んだ点から遠い辺に置くので、transform-origin は反対側。 */
    const setPeel = (cx, cy) => {
      const b = el.getBoundingClientRect();
      const nx = (cx - b.left) / b.width - 0.5; /* -0.5〜0.5 */
      const ny = (cy - b.top) / b.height - 0.5;
      /* 掴んだ方向が強い軸を採用する。両方使うと捻れて見える */
      const useY = Math.abs(nx) >= Math.abs(ny);
      const amt = Math.min(1, Math.abs(useY ? nx : ny) / 0.5);
      const deg = (14 + amt * 12).toFixed(1);

      el.style.setProperty("--peel-ax", useY ? "0" : "1");
      el.style.setProperty("--peel-ay", useY ? "1" : "0");
      /* Y軸回転は右が浮くとき負、X軸回転は下が浮くとき正 */
      const sign = useY ? (nx > 0 ? 1 : -1) : ny > 0 ? -1 : 1;
      el.style.setProperty("--peel-deg", `${sign * deg}deg`);
      el.style.setProperty("--peel-ox", useY ? (nx > 0 ? "0%" : "100%") : "50%");
      el.style.setProperty("--peel-oy", useY ? "50%" : ny > 0 ? "0%" : "100%");
      /* 影は浮いた辺と反対へ落とす */
      el.style.setProperty("--peel-sx", useY ? (nx > 0 ? "-1" : "1") : "0");
      el.style.setProperty("--peel-sy", useY ? "0.6" : ny > 0 ? "-1" : "1");
    };

    const lift = () => {
      armed = true;
      el.classList.remove("is-arming");
      setPeel(startX, startY);
      el.classList.add("is-lifted", "is-dragging");
      /* 持ち上げた合図。対応端末だけ鳴る */
      if (navigator.vibrate) navigator.vibrate(8);
    };

    const drop = () => {
      if (armed) {
        saved[id] = { x: baseX, y: baseY };
        store();
      }
      armed = false;
      active = null;
      disarm();
      el.classList.remove("is-lifted", "is-dragging");
      /* 貼り直す。傾きは戻すが位置は残す */
      el.style.setProperty("--peel-deg", "0deg");
    };

    el.addEventListener("pointerdown", (ev) => {
      if (active !== null) return;
      active = ev.pointerId;
      startX = ev.clientX;
      startY = ev.clientY;
      const cs = getComputedStyle(el);
      baseX = parseFloat(cs.getPropertyValue("--peel-x")) || 0;
      baseY = parseFloat(cs.getPropertyValue("--peel-y")) || 0;

      if (ev.pointerType === "touch") {
        /* 指のときだけ長押しを待つ。ここでスクロールを妨げない */
        el.classList.add("is-arming");
        timer = window.setTimeout(lift, reduce ? 0 : HOLD_MS);
      } else {
        lift();
        ev.preventDefault();
      }
      el.setPointerCapture(ev.pointerId);
    });

    el.addEventListener("pointermove", (ev) => {
      if (ev.pointerId !== active) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      if (!armed) {
        /* 長押しが成立する前に動いた＝スクロールしたい。手を引く */
        if (Math.hypot(dx, dy) > SLOP) {
          disarm();
          active = null;
          try {
            el.releasePointerCapture(ev.pointerId);
          } catch (e) {
            /* すでに解放済み */
          }
        }
        return;
      }

      baseX += dx;
      baseY += dy;
      startX = ev.clientX;
      startY = ev.clientY;
      put(el, baseX, baseY);
    });

    ["pointerup", "pointercancel"].forEach((t) =>
      el.addEventListener(t, (ev) => {
        if (ev.pointerId !== active) return;
        drop();
      }),
    );

    /* 元の位置へ戻す */
    el.addEventListener("dblclick", () => {
      baseX = 0;
      baseY = 0;
      put(el, 0, 0);
      delete saved[id];
      store();
    });

    /* 持ち上がっている間だけスクロールを止める。
       touch-action では間に合わない（指を置いた時点では
       まだ持ち上がっていないので、その回のジェスチャに効かない）。 */
    el.addEventListener(
      "touchmove",
      (ev) => {
        if (armed) ev.preventDefault();
      },
      { passive: false },
    );
  });
})();
