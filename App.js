(() => {
  const canvas = document.getElementById("wheel");
  const ctx = canvas.getContext("2d");

  const itemsEl = document.getElementById("items");
  const spinBtn = document.getElementById("spinBtn");
  const centerBtn = document.getElementById("centerBtn");
  const clearBtn = document.getElementById("clearBtn");
  const shuffleColorsBtn = document.getElementById("shuffleColorsBtn");
  const winnerEl = document.getElementById("winner");
  const countEl = document.getElementById("count");
  const removeWinnerEl = document.getElementById("removeWinner");
  const spinTimeEl = document.getElementById("spinTime");
  const spinTimeValEl = document.getElementById("spinTimeVal");

  // Wheel state
  let items = [];
  let colors = [];
  let currentRotation = 0; // radians
  let isSpinning = false;

  // Crisp canvas on retina
  function setupCanvas() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const size = 720; // internal logical px
    canvas.width = Math.floor(size * dpr);
    canvas.height = Math.floor(size * dpr);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function parseItems(text) {
    // Allow either newlines or commas; ignore blanks; trim; de-dup preserving order
    const raw = text
      .split(/\n|,/g)
      .map(s => s.trim())
      .filter(Boolean);

    const seen = new Set();
    const out = [];
    for (const r of raw) {
      const key = r.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(r);
      }
    }
    return out;
  }

  function seededPalette(n) {
    // Generate pleasant distinct-ish colors around the hue wheel
    const base = Math.random() * 360;
    const out = [];
    for (let i = 0; i < n; i++) {
      const hue = (base + (360 / Math.max(1, n)) * i) % 360;
      const sat = 78;
      const lit = 52;
      out.push(`hsl(${hue} ${sat}% ${lit}%)`);
    }
    return out;
  }

  function updateFromTextarea() {
    items = parseItems(itemsEl.value);
    if (colors.length !== items.length) colors = seededPalette(items.length);
    winnerEl.textContent = "—";
    countEl.textContent = `${items.length} item${items.length === 1 ? "" : "s"}`;
    drawWheel();
  }

  function drawWheel() {
    const W = 720, H = 720;
    const cx = W / 2, cy = H / 2;
    const radius = Math.min(cx, cy) - 12;

    ctx.clearRect(0, 0, W, H);

    // Empty state
    if (items.length === 0) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.14)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = "700 22px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Add items to begin", 0, -10);
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "14px system-ui";
      ctx.fillText("One per line (or comma-separated)", 0, 18);
      ctx.restore();
      return;
    }

    const slice = (Math.PI * 2) / items.length;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(currentRotation);

    // Slices
    for (let i = 0; i < items.length; i++) {
      const start = i * slice;
      const end = start + slice;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, start, end);
      ctx.closePath();
      ctx.fillStyle = colors[i] || "hsl(0 0% 50%)";
      ctx.fill();

      // Slice border
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Text
      const label = items[i];
      ctx.save();
      ctx.rotate(start + slice / 2);

      // Keep text readable: draw along radial line
      ctx.translate(radius * 0.62, 0);
      ctx.rotate(Math.PI / 2);

      // Text style with contrast stroke
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const maxWidth = radius * 0.48;
      const fontSize = clamp(14, 22 - items.length * 0.35, 22);
      ctx.font = `800 ${fontSize}px system-ui`;

      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.strokeText(ellipsize(ctx, label, maxWidth), 0, 0);

      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.fillText(ellipsize(ctx, label, maxWidth), 0, 0);

      ctx.restore();
    }

    // Outer ring
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.30)";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Center cap
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  function clamp(min, v, max) {
    return Math.max(min, Math.min(max, v));
  }

  function ellipsize(context, text, maxWidth) {
    if (context.measureText(text).width <= maxWidth) return text;
    let t = text;
    while (t.length > 1 && context.measureText(t + "…").width > maxWidth) {
      t = t.slice(0, -1);
    }
    return t + "…";
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function normalizeAngle(a) {
    const tau = Math.PI * 2;
    a = a % tau;
    if (a < 0) a += tau;
    return a;
  }

  function angleToIndex(pointerAngleWorld) {
    // Our pointer is at top (12 o'clock). In canvas angle terms (0 at +x), top is -90deg.
    // We rotate wheel by currentRotation. Slice i occupies [i*slice, (i+1)*slice) in wheel-local.
    // Convert pointer angle to wheel-local: local = pointerWorld - currentRotation.
    const tau = Math.PI * 2;
    const slice = tau / items.length;

    // pointerWorld for 12 o'clock is -PI/2, normalized.
    const local = normalizeAngle(pointerAngleWorld - currentRotation);

    // local angle 0 corresponds to +x axis. But our slices start at angle 0 at +x.
    const idx = Math.floor(local / slice) % items.length;
    return idx;
  }

  function getWinnerIndex() {
    if (items.length === 0) return -1;
    const pointerWorld = normalizeAngle(-Math.PI / 2);
    // We want the slice that ends up under the pointer.
    // Because of how we compute local, index corresponds to local angle region.
    return angleToIndex(pointerWorld);
  }

  function spin() {
    if (isSpinning) return;
    if (items.length < 2) {
      winnerEl.textContent = items[0] ?? "—";
      return;
    }

    isSpinning = true;
    winnerEl.textContent = "Spinning…";

    const duration = Number(spinTimeEl.value) * 1000;

    // Pick a random winner index, then compute target rotation so that index lands at pointer.
    const tau = Math.PI * 2;
    const slice = tau / items.length;

    const winnerIndex = Math.floor(Math.random() * items.length);

    // Center of slice angle in wheel-local coordinates:
    const winnerCenterLocal = winnerIndex * slice + slice / 2;

    // We want winnerCenterLocal to align with pointerWorld (-PI/2).
    // That means: winnerCenterLocal + currentRotationTarget = pointerWorld (mod tau)
    // => currentRotationTarget = pointerWorld - winnerCenterLocal (mod tau)
    const pointerWorld = -Math.PI / 2;

    const normalizedTargetBase = normalizeAngle(pointerWorld - winnerCenterLocal);

    // Add extra full rotations for animation flair
    const extraTurns = 5 + Math.floor(Math.random() * 4); // 5..8
    const start = currentRotation;
    const end = normalizedTargetBase + extraTurns * tau;

    const startTime = performance.now();

    const tick = (now) => {
      const t = clamp(0, (now - startTime) / duration, 1);
      const eased = easeOutCubic(t);
      currentRotation = start + (end - start) * eased;
      drawWheel();

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        // Snap to exact normalized target to avoid floating drift
        currentRotation = normalizeAngle(normalizedTargetBase);
        drawWheel();

        const idx = getWinnerIndex();
        const winner = items[idx];
        winnerEl.textContent = winner ?? "—";

        if (removeWinnerEl.checked && winner) {
          // Remove winner from list + textarea
          items = items.filter((_, i) => i !== idx);
          colors = seededPalette(items.length);
          itemsEl.value = items.join("\n");
          countEl.textContent = `${items.length} item${items.length === 1 ? "" : "s"}`;
          // redraw already done; but make sure no stale state
          drawWheel();
        }

        isSpinning = false;
      }
    };

    requestAnimationFrame(tick);
  }

  function shuffleColors() {
    colors = seededPalette(items.length);
    drawWheel();
  }

  function clearAll() {
    itemsEl.value = "";
    items = [];
    colors = [];
    winnerEl.textContent = "—";
    countEl.textContent = "0 items";
    currentRotation = 0;
    drawWheel();
  }

  // Events
  itemsEl.addEventListener("input", updateFromTextarea);
  spinBtn.addEventListener("click", spin);
  centerBtn.addEventListener("click", spin);
  canvas.addEventListener("click", spin);
  shuffleColorsBtn.addEventListener("click", shuffleColors);
  clearBtn.addEventListener("click", clearAll);

  spinTimeEl.addEventListener("input", () => {
    spinTimeValEl.textContent = `${Number(spinTimeEl.value).toFixed(1)}s`;
  });

  window.addEventListener("resize", () => {
    // Canvas is fixed logical size; CSS handles display sizing
    drawWheel();
  });

  // Init with a friendly default list
  itemsEl.value = "Pizza\nSushi\nTacos\nBurgers\nSalad\nRamen";
  spinTimeValEl.textContent = `${Number(spinTimeEl.value).toFixed(1)}s`;
  setupCanvas();
  updateFromTextarea();
})();
