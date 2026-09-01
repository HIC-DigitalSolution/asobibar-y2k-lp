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
const OFFICIAL_RESERVATION_LABEL = "Y2K NIGHTを予約する";
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

/* Section 02 video: visible時だけ再生し、reduceではposterに固定する。 */
(() => {
  const video = document.querySelector("[data-scene-video]");
  if (!video) return;

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let visible = false;

  const sync = () => {
    if (motion.matches || document.hidden || !visible) {
      video.pause();
      if (motion.matches) video.currentTime = 0;
      return;
    }
    video.play().catch(() => {});
  };

  const observer = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      sync();
    },
    { rootMargin: "20% 0px", threshold: 0.01 },
  );

  observer.observe(video);
  document.addEventListener("visibilitychange", sync);
  motion.addEventListener?.("change", sync);
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
  const deckMode = document.querySelector("[data-deck-mode]");
  const songPetTrack = document.querySelector("[data-song-pet-track]");
  const songPetPrompt = document.querySelector("[data-song-pet-prompt]");
  const songPetPrev = document.querySelector("[data-song-pet-prev]");
  const songPetNext = document.querySelector("[data-song-pet-next]");
  const desktopMotion = window.matchMedia("(min-width: 1024px) and (pointer: fine)");
  const activeScenes = new Set();
  let scrollFrame = 0;

  /* ---------- SONG PET / 5 HITゲーム ----------
     待機中は左右で気分を選び、中央で開始。画面と同じ3ボタンを
     5回押すとFEVERになる。音や保存は使わず、数秒で完結させる。 */
  const SONG_PET_GOAL = 5;
  const songPetSymbols = { left: "◀", center: "●", right: "▶" };
  let songPetIndex = 0;
  let songPetScore = 0;
  let songPetExpected = "center";
  let songPetActive = false;
  let songPetFeedbackTimer = 0;
  const songPetChoices = [
    { label: "平成アゲ曲", mood: "happy" },
    { label: "青春バラード", mood: "dreamy" },
    { label: "みんなの定番", mood: "party" },
  ];

  const paintDeck = (value) => {
    if (!requestDeck) return;
    const t = clamp01(value);
    requestDeck.style.setProperty("--deck", t.toFixed(4));
    if (deckTime) deckTime.textContent = `HIT ${songPetScore}/${SONG_PET_GOAL}`;
  };

  const flashSongPet = (state) => {
    if (!requestDeck) return;
    window.clearTimeout(songPetFeedbackTimer);
    requestDeck.classList.remove("is-hit", "is-miss");
    requestAnimationFrame(() => requestDeck.classList.add(state));
    songPetFeedbackTimer = window.setTimeout(() => {
      requestDeck.classList.remove("is-hit", "is-miss");
    }, reduceMotion ? 0 : 280);
  };

  const chooseSongPetPrompt = () => {
    const keys = Object.keys(songPetSymbols);
    let next = keys[Math.floor(Math.random() * keys.length)];
    if (keys.length > 1 && next === songPetExpected) {
      next = keys[(keys.indexOf(next) + 1 + Math.floor(Math.random() * (keys.length - 1))) % keys.length];
    }
    songPetExpected = next;
    if (songPetPrompt) songPetPrompt.textContent = `PUSH ${songPetSymbols[next]}`;
  };

  const resetSongPet = () => {
    songPetActive = false;
    songPetScore = 0;
    paintDeck(0);
    requestDeck?.classList.remove("is-mode-on", "is-dancing", "is-hit", "is-miss", "is-complete");
    if (deckMode) deckMode.textContent = "SELECT";
    if (songPetPrompt) songPetPrompt.textContent = "CHOOSE";
  };

  const selectSongPet = (direction) => {
    if (!requestDeck || !songPetTrack) return;
    songPetIndex = (songPetIndex + direction + songPetChoices.length) % songPetChoices.length;
    const choice = songPetChoices[songPetIndex];
    songPetTrack.textContent = choice.label;
    requestDeck.dataset.petMood = choice.mood;
    resetSongPet();
  };

  const startSongPet = () => {
    songPetActive = true;
    songPetScore = 0;
    paintDeck(0);
    requestDeck?.classList.remove("is-complete");
    requestDeck?.classList.add("is-mode-on");
    if (deckMode) deckMode.textContent = "PLAY";
    chooseSongPetPrompt();
  };

  const hitSongPetButton = (key) => {
    if (!requestDeck) return;

    if (!songPetActive) {
      if (key === "left") selectSongPet(-1);
      else if (key === "right") selectSongPet(1);
      else startSongPet();
      return;
    }

    if (key !== songPetExpected) {
      if (deckMode) deckMode.textContent = "MISS";
      flashSongPet("is-miss");
      window.setTimeout(() => {
        if (songPetActive && deckMode) deckMode.textContent = "PLAY";
      }, reduceMotion ? 0 : 260);
      return;
    }

    songPetScore += 1;
    paintDeck(songPetScore / SONG_PET_GOAL);
    flashSongPet("is-hit");

    if (songPetScore >= SONG_PET_GOAL) {
      songPetActive = false;
      requestDeck.classList.remove("is-mode-on");
      requestDeck.classList.add("is-complete", "is-dancing");
      if (deckMode) deckMode.textContent = "FEVER";
      if (songPetPrompt) songPetPrompt.textContent = "GOOD!";
      window.setTimeout(() => requestDeck.classList.remove("is-dancing"), reduceMotion ? 0 : 900);
      return;
    }

    chooseSongPetPrompt();
  };

  songPetPrev?.addEventListener("click", () => hitSongPetButton("left"));
  deckPlay?.addEventListener("click", () => hitSongPetButton("center"));
  songPetNext?.addEventListener("click", () => hitSongPetButton("right"));
  selectSongPet(0);

  const playScene = (scene) => {
    if (scene.classList.contains("is-scene-in")) return;
    scene.classList.add("is-scene-in");

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

      /* SONG REQUEST の写真・コピー用の段送り。
         SONG PETは独立したミニ体験へ移したため、スクロールでは進めず
         3ボタンを押したときだけ反応させる。 */
      if (scene.dataset.sceneMotion === "request") {
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

/* ---------- HOW TO ASOBIBAR ----------
   3つの案内を同じRevealで並べず、目次の選択状態・写真・本文を
   それぞれのスクロール位置に合わせる。操作はタップとスクロールだけ。 */
(() => {
  const steps = [...document.querySelectorAll("[data-howto-step]")];
  const buttons = [...document.querySelectorAll("[data-howto-jump]")];
  const items = [...document.querySelectorAll("[data-howto-reveal]")];
  if (!steps.length) return;

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById(button.dataset.howtoJump)?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
    });
  });

  const activate = (active) => {
    steps.forEach((step) => step.classList.toggle("is-active", step === active));
    buttons.forEach((button) => {
      button.setAttribute("aria-current", String(button.dataset.howtoJump === active.id));
    });
  };

  const updateActive = () => {
    const targetY = window.innerHeight * 0.48;
    let active = steps[0];
    let distance = Infinity;
    steps.forEach((step) => {
      const r = step.getBoundingClientRect();
      const d = Math.abs((r.top + r.bottom) / 2 - targetY);
      if (d < distance) {
        distance = d;
        active = step;
      }
    });
    activate(active);
  };

  if (reduceMotion || !("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-in"));
    activate(steps[0]);
    return;
  }

  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        const passed = entry.rootBounds && entry.boundingClientRect.bottom < entry.rootBounds.top;
        if (!entry.isIntersecting && !passed) return;
        entry.target.classList.add("is-in");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8%", threshold: 0.16 },
  );
  items.forEach((el) => revealObserver.observe(el));

  let ticking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        updateActive();
        ticking = false;
      });
    },
    { passive: true },
  );
  window.addEventListener("resize", updateActive, { passive: true });
  updateActive();
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
  /* 監視するのは最終CTA本体で、それを含むセクションではない。
     #reserve を見ていた版は、セクションが18%見えた時点でバーを消していた。
     あのセクションは上300pxが写真と見出しなので、中のCTAはまだ画面外。
     実測で scrollY 7300〜7600 の約400px、押せるCTAが0個になっていた。 */
  const finalSection = document.querySelector(".cta--final") || document.querySelector("#reserve");
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
    /* ボタン1つ分を見るので閾値を上げる。0.18 だとボタンの13px分で
       消えてしまい、バーが先に引っ込む。 */
    { threshold: 0.75 },
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

/* ---------- 店舗選択ダイアログ ----------
   予約CTAを押したら、公式HPへ飛ばす前に店舗を選ばせる。
   旧来は3つのCTAが全部トップページに飛ばしていて、来訪者が自分の
   店舗を自力で探し直していた。

   <dialog> を使うのは、Esc・フォーカスの閉じ込め・背面の inert 化が
   最初から付いてくるため。自前で書くとどれかひとつを落とす。

   店舗ごとの LINE URL は data-line に入る。空のうちは HTML の href
   （公式HP）のまま動かさない。押しても何も起きないリンクを作らない
   ためで、これは上の予約リンクと同じ方針。 */
(() => {
  const dialog = document.querySelector("[data-storepick]");
  if (!dialog || typeof dialog.showModal !== "function") return;

  /* 店舗ごとのLINEへ差し替える。プロトコルを見るのは、data属性に
     javascript: を書かれても踏まないため。 */
  dialog.querySelectorAll("[data-line]").forEach((a) => {
    const raw = a.dataset.line;
    if (!raw) return;
    try {
      const url = new URL(raw);
      if (url.protocol === "https:") a.href = url.href;
    } catch {
      /* 不正なURLなら href（公式HP）のまま */
    }
  });

  const tabs = [...dialog.querySelectorAll("[data-storepick-tab]")];
  const panels = [...dialog.querySelectorAll("[data-storepick-panel]")];

  const showArea = (area) => {
    tabs.forEach((t) => {
      const on = t.dataset.storepickTab === area;
      /* aria-current を消すときは属性ごと外す。false のまま残すと
         支援技術には「現在地ではない」ではなく値付きで読まれる。 */
      if (on) t.setAttribute("aria-current", "true");
      else t.removeAttribute("aria-current");
    });
    panels.forEach((p) => {
      p.hidden = p.dataset.storepickPanel !== area;
    });
    const shown = dialog.querySelector("[data-storepick-panel]:not([hidden])");
    if (shown) {
      shown.scrollTo({ top: 0 });
      syncMore(shown);
    }
  };

  tabs.forEach((t) => {
    t.addEventListener("click", () => showArea(t.dataset.storepickTab));
  });

  /* 下にまだ店舗があるかを、影の有無で伝える。最後まで見たら消す。
     出しっぱなしにすると、下端に永久に影が乗って紙が汚れて見える。 */
  const syncMore = (panel) => {
    const more = panel.scrollHeight - panel.clientHeight - panel.scrollTop > 4;
    if (more) panel.setAttribute("data-more", "");
    else panel.removeAttribute("data-more");
  };
  panels.forEach((panel) => {
    panel.addEventListener("scroll", () => syncMore(panel), { passive: true });
  });

  /* 開いている間だけ背面のスクロールを止める。ダイアログ内は
     .storepick__face が overscroll-behavior: contain で受ける。 */
  let scrollLock = "";
  const open = () => {
    scrollLock = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    /* 影の判定は開いてから。閉じている <dialog> は高さ0で、
       scrollHeight と clientHeight が両方0になり必ず「続きなし」になる。 */
    panels.filter((p) => !p.hidden).forEach(syncMore);
  };
  dialog.addEventListener("close", () => {
    document.body.style.overflow = scrollLock;
  });

  document.querySelectorAll("[data-reserve]").forEach((a) => {
    a.addEventListener("click", (ev) => {
      /* 修飾キー・中クリックは別タブで開きたい意思なので邪魔しない */
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || ev.button !== 0) return;
      ev.preventDefault();
      open();
    });
  });

  dialog.querySelectorAll("[data-storepick-close]").forEach((el) => {
    el.addEventListener("click", () => dialog.close());
  });

  /* 背景クリックで閉じる。判定は座標。::backdrop はイベントの
     target にならず、target === dialog だけで見ると紙の余白を
     押しても閉じてしまう。 */
  dialog.addEventListener("click", (ev) => {
    if (ev.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    const outside =
      ev.clientX < box.left || ev.clientX > box.right || ev.clientY < box.top || ev.clientY > box.bottom;
    if (outside) dialog.close();
  });
})();
