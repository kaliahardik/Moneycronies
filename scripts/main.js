/* ============================================================
   MONEYCRONIES — Main JavaScript
   ============================================================ */

'use strict';

/* ── Utility ── */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

/* ============================================================
   1. NAV — Add .scrolled class on scroll
   ============================================================ */
const nav = $('#siteNav');
if (nav) {
  const onScroll = () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // run once on load
}

/* ============================================================
   2. FISH PATH ANIMATION + CINEMATIC DEPTH PANELS (Hero page only)

   The hero wrapper is 500vh tall; inner sticky div is 100vh.
   Scroll progress [0→1] over 400vh drives:
     · fish position along SVG path (getPointAtLength)
     · hero text fade-out
     · depth panels slide from side → centre → side (one at a time)
     · depth meter fill + dot position
     · depth readout label
   ============================================================ */
const heroScrollWrapper = $('#heroScrollWrapper');
const divePath          = $('#divePath');
const turtleGroup       = $('#turtleGroup');
const heroContent       = $('#heroContent');
const scrollCueEl       = $('#scrollCue');
const dmFill            = $('#dmFill');
const dmDot             = $('#dmDot');
const dmReadout         = $('#dmReadout');
const pathGroupEl       = document.getElementById('pathGroup');

// Depth labels for the readout (map progress → display string)
const DEPTH_LABELS = [
  { at: 0,    label: '0 m'   },
  { at: 0.18, label: '30 m'  },
  { at: 0.38, label: '100 m' },
  { at: 0.58, label: '300 m' },
  { at: 0.76, label: '500 m' },
];

if (divePath && turtleGroup && heroScrollWrapper) {

  const pathLength = divePath.getTotalLength();

  // Smooth-lerp state — prevents jitter on coarse scroll events
  let currentDist = 0;
  let targetDist  = 0;
  const lerp = (a, b, t) => a + (b - a) * t;

  // Ease-in-out quad — smooth entry and drift for panels
  const eio = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

  // peakAt = scroll progress when the panel is fully centred.
  // After peak, panels drift back to their side and STAY visible at
  // reduced opacity — so all past panels accumulate on left/right,
  // layering the sense of increasing depth.
  const PANEL_ZONES = [
    { id: 'depthPanel1', side: 'left',   peakAt: 0.24 },
    { id: 'depthPanel2', side: 'right',  peakAt: 0.47 },
    { id: 'depthPanel3', side: 'left',   peakAt: 0.68 },
    { id: 'depthPanel4', side: 'centre', peakAt: 0.87 },
  ].map(z => ({ ...z, el: document.getElementById(z.id) }))
   .filter(z => z.el);

  /* Animate every panel based on overall scroll progress.
     Each panel passes through five phases:
       1. Off-screen (invisible, parked on its side)
       2. Entering   (slides from side to centre, grows to full size)
       3. Lingering  (stays centred at 100% opacity — the "readable" window)
       4. Drifting   (eases from centre to anchor point on its side)
       5. Receding   (anchored, translates upward out of view as dive continues)
     Scrolling back up reverses all phases, so panels re-appear from the top. */
  const updatePanels = (progress) => {
    const slideRange  = Math.min(window.innerWidth * 0.52, 480);
    const restFrac    = 0.76;   // anchor X as fraction of slideRange (near the S-curve)
    const restOpacity = 0.18;   // opacity once anchored to the side
    const restScale   = 0.64;   // scale once anchored — feels more distant
    const entryWidth  = 0.11;   // progress range to slide in from side to centre
    const lingerWidth = 0.14;   // progress range panel stays centred at full opacity
    const driftWidth  = 0.08;   // progress range to ease out to anchor point
    const anchorDelta = lingerWidth + driftWidth; // delta when fully anchored
    // How fast the anchored panel recedes upward (CSS px per progress unit).
    // At 5.5× innerHeight per unit, the panel clears the viewport top in ~0.10 progress.
    const recedeRate  = window.innerHeight * 5.5;

    PANEL_ZONES.forEach(({ el, side, peakAt }) => {
      // delta: negative = not yet reached peak, 0 = at peak, positive = past peak
      const delta = progress - peakAt;
      const dir   = side === 'left' ? -1 : (side === 'right' ? 1 : 0);

      let xOffset, yOffset = 0, opacity, scale;

      if (side === 'centre') {
        // Centre panel: only fades in and stays — no side drift, no recede
        xOffset = 0;
        scale   = 1;
        opacity = delta < -entryWidth ? 0
                : delta < 0           ? eio((delta + entryWidth) / entryWidth)
                :                       1;

      } else if (delta < -entryWidth) {
        // Phase 1 — off-screen: parked on its side, invisible
        xOffset = dir * slideRange;
        opacity = 0;
        scale   = restScale;

      } else if (delta < 0) {
        // Phase 2 — entering: slides from side to centre, grows to full size
        const e = eio((delta + entryWidth) / entryWidth);  // 0 → 1
        xOffset = dir * slideRange * (1 - e);
        opacity = e;
        scale   = restScale + (1 - restScale) * e;

      } else if (delta < lingerWidth) {
        // Phase 3 — lingering: fully centred and readable
        xOffset = 0;
        opacity = 1;
        scale   = 1;

      } else if (delta < anchorDelta) {
        // Phase 4 — drifting: eases out to anchor position, shrinks and fades
        const e = eio((delta - lingerWidth) / driftWidth);  // 0 → 1
        xOffset = dir * slideRange * restFrac * e;
        opacity = 1 - (1 - restOpacity) * e;
        scale   = 1 - (1 - restScale)   * e;

      } else {
        // Phase 5 — receding: anchored to the S-curve side, scrolling upward
        xOffset = dir * slideRange * restFrac;
        opacity = restOpacity;
        scale   = restScale;
        yOffset = -(delta - anchorDelta) * recedeRate;
      }

      el.style.transform     = `translateX(calc(-50% + ${xOffset.toFixed(1)}px)) translateY(calc(-50% + ${yOffset.toFixed(1)}px)) scale(${scale.toFixed(3)})`;
      el.style.opacity       = Math.max(0, Math.min(1, opacity)).toFixed(3);
      // Lingering panel renders on top; receding panels behind
      el.style.zIndex        = (delta >= 0 && delta < lingerWidth) ? '9' : '7';
      el.style.pointerEvents = opacity > 0.6 ? 'auto' : 'none';
    });
  };

  /* Place fish along the path at distance `dist` */
  const applyTurtle = (dist) => {
    const pt      = divePath.getPointAtLength(dist);
    const ptAhead = divePath.getPointAtLength(Math.min(dist + 2, pathLength));
    const angle   = Math.atan2(ptAhead.y - pt.y, ptAhead.x - pt.x) * (180 / Math.PI);
    turtleGroup.setAttribute(
      'transform',
      `translate(${pt.x.toFixed(2)},${pt.y.toFixed(2)}) rotate(${angle.toFixed(2)})`
    );
  };

  /* RAF loop — lerps fish toward target every frame */
  const tick = () => {
    currentDist = lerp(currentDist, targetDist, 0.08);
    applyTurtle(currentDist);
    requestAnimationFrame(tick);
  };

  /* Called on every scroll event — updates all driven elements */
  const updateScene = () => {
    const scrolled  = window.scrollY;
    const maxScroll = heroScrollWrapper.offsetHeight - window.innerHeight;
    const progress  = Math.max(0, Math.min(scrolled / maxScroll, 1));

    // ── 1. Fish target distance ──
    targetDist = progress * pathLength;

    // ── 2. Hero text: fade + rise as dive begins ──
    if (heroContent) {
      const op    = Math.max(0, 1 - progress / 0.28);
      const slide = progress * -44;
      heroContent.style.opacity   = op;
      heroContent.style.transform = `translate(-50%, calc(-50% + ${slide}px))`;
    }

    // ── 3. Scroll cue: vanishes early ──
    if (scrollCueEl) {
      scrollCueEl.style.opacity = Math.max(0, 1 - progress / 0.08);
    }

    // ── 4. Depth panels: cinematic slide to centre and back ──
    updatePanels(progress);

    // ── 5. Depth meter: fill + dot + readout ──
    if (dmFill) {
      dmFill.style.height = `${(progress * 100).toFixed(1)}%`;
    }
    const meterTopPct    = 50 - 30;
    const meterHeightPct = 60;
    const dotTopPct = meterTopPct + progress * meterHeightPct;
    if (dmDot) {
      dmDot.style.top = `${dotTopPct}%`;
    }
    if (dmReadout) {
      dmReadout.style.top = `${dotTopPct + 2}%`;
      let label = DEPTH_LABELS[0].label;
      for (const d of DEPTH_LABELS) {
        if (progress >= d.at) label = d.label;
      }
      dmReadout.textContent = label;
    }

    // ── 6. S-curves + fish parallax — the dive path world recedes upward ──
    // pathGroup contains both dive paths AND the animated fish.
    // Translating it upward (in SVG units) as progress increases makes the
    // upper sections of the path exit the viewport, simulating the feeling
    // of descending through the water column. The fish stays on the path
    // because both the path and the fish are children of the same group.
    if (pathGroupEl) {
      // 340 SVG units ≈ 38% of viewport height by end of dive.
      // Upper S-curve exits the viewport top; fish drifts toward centre.
      pathGroupEl.setAttribute('transform', `translate(0, ${(-progress * 340).toFixed(1)})`);
    }
  };

  window.addEventListener('scroll', updateScene, { passive: true });
  updateScene(); // initialise on load
  tick();        // start animation loop
}

/* ============================================================
   8. DEPTH TINT — gradually darken the ocean as turtle dives
   ============================================================ */
const oceanSceneEl2 = $('#oceanScene');
if (oceanSceneEl2 && heroScrollWrapper) {
  window.addEventListener('scroll', () => {
    const scrolled  = window.scrollY;
    const maxScroll = heroScrollWrapper.offsetHeight - window.innerHeight;
    const progress  = Math.max(0, Math.min(scrolled / maxScroll, 1));
    oceanSceneEl2.style.setProperty('--depth-progress', progress.toFixed(3));
  }, { passive: true });
}

/* ============================================================
   3. SCROLL-REVEAL — Fade up elements with .reveal class
   ============================================================ */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

$$('.reveal').forEach(el => revealObserver.observe(el));

/* ============================================================
   4. COUNTER ANIMATION (Stats bar)
   ============================================================ */
const animateCount = (el) => {
  const target   = parseInt(el.dataset.count, 10);
  const suffix   = el.dataset.suffix || '';
  const duration = 1200; // ms
  const steps    = 40;
  const stepTime = duration / steps;
  let current    = 0;
  const increment = target / steps;

  const timer = setInterval(() => {
    current += increment;
    if (current >= target) {
      current = target;
      clearInterval(timer);
    }
    el.textContent = Math.floor(current) + suffix;
  }, stepTime);
};

const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      animateCount(entry.target);
      counterObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });

$$('[data-count]').forEach(el => counterObserver.observe(el));

/* ============================================================
   5. STICKY SECTION TABS — Highlight active section
   ============================================================ */
const tabLinks  = $$('.tab-link');
const sections  = tabLinks
  .map(l => l.getAttribute('href'))
  .filter(Boolean)
  .map(id => document.getElementById(id.replace('#', '')))
  .filter(Boolean);

if (tabLinks.length && sections.length) {
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = '#' + entry.target.id;
        tabLinks.forEach(l => {
          l.classList.toggle('active', l.getAttribute('href') === id);
        });
      }
    });
  }, { rootMargin: '-30% 0px -60% 0px' });

  sections.forEach(s => sectionObserver.observe(s));
}

/* ============================================================
   6. SMOOTH SCROLL for internal anchor links
   ============================================================ */
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href^="#"]');
  if (!link) return;
  const target = document.querySelector(link.getAttribute('href'));
  if (!target) return;
  e.preventDefault();
  const offset = 72; // nav height
  const top = target.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top, behavior: 'smooth' });
});

/* ============================================================
   7. ARTICLE CARD — turtle trail curve nudge
   · curveSvg inserted BEFORE .card-body  → behind text (DOM order)
   · boxSvg   appended AFTER  .card-body  → above text  (DOM order)
   · Curve ends with a small dot ~30px short of the READ button
   · Box = four corner bracket marks + soft tint, spring-in on hover
   ============================================================ */
$$('.article-card').forEach(card => {
  const ns = 'http://www.w3.org/2000/svg';

  /* ── SVG 1: flowing dotted curve (behind text) ── */
  const curveSvg = document.createElementNS(ns, 'svg');
  curveSvg.classList.add('card-trail-svg');
  curveSvg.setAttribute('aria-hidden', 'true');

  const path = document.createElementNS(ns, 'path');
  path.classList.add('card-trail-path');
  curveSvg.appendChild(path);

  const dot = document.createElementNS(ns, 'circle');
  dot.classList.add('card-trail-dot');
  dot.setAttribute('r', '2.5');
  curveSvg.appendChild(dot);

  // Insert BEFORE .card-body so it paints behind it (DOM order)
  const cardBody = card.querySelector('.card-body');
  card.insertBefore(curveSvg, cardBody);

  /* ── SVG 2: corner bracket box (above text) ── */
  const boxSvg = document.createElementNS(ns, 'svg');
  boxSvg.classList.add('card-trail-rect-svg');
  boxSvg.setAttribute('aria-hidden', 'true');

  const tint = document.createElementNS(ns, 'rect');
  tint.setAttribute('fill', 'rgba(26,107,60,0.055)');
  tint.setAttribute('rx', '5');
  boxSvg.appendChild(tint);

  const corners = document.createElementNS(ns, 'path');
  corners.classList.add('card-trail-corners');
  boxSvg.appendChild(corners);

  // Append AFTER .card-body so it paints above it (DOM order)
  card.appendChild(boxSvg);

  let wiggleFrame = null;
  let noiseT = Math.random() * 100;
  let lastMx = card.offsetWidth  * 0.3;
  let lastMy = card.offsetHeight * 0.3;

  function getTarget() {
    const btn = card.querySelector('.card-read-more');
    const cr  = card.getBoundingClientRect();
    if (btn) {
      const br = btn.getBoundingClientRect();
      return { x: br.left - cr.left + br.width  * 0.5,
               y: br.top  - cr.top  + br.height * 0.5 };
    }
    return { x: card.offsetWidth - 28, y: card.offsetHeight - 18 };
  }

  function positionBox() {
    const btn = card.querySelector('.card-read-more');
    if (!btn) return;
    const cr = card.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    const pad = 8, CL = 10;
    const x1 = br.left   - cr.left - pad;
    const y1 = br.top    - cr.top  - pad;
    const x2 = br.right  - cr.left + pad;
    const y2 = br.bottom - cr.top  + pad;

    tint.setAttribute('x',      x1);
    tint.setAttribute('y',      y1);
    tint.setAttribute('width',  x2 - x1);
    tint.setAttribute('height', y2 - y1);

    // Four L-shaped corner brackets
    corners.setAttribute('d',
      `M${x1+CL},${y1} L${x1},${y1} L${x1},${y1+CL} ` +
      `M${x2-CL},${y1} L${x2},${y1} L${x2},${y1+CL} ` +
      `M${x1},${y2-CL} L${x1},${y2} L${x1+CL},${y2} ` +
      `M${x2},${y2-CL} L${x2},${y2} L${x2-CL},${y2}`
    );

    // Anchor spring scale to the READ button centre
    const ox = ((br.left + br.width  * 0.5) - cr.left) / cr.width  * 100;
    const oy = ((br.top  + br.height * 0.5) - cr.top)  / cr.height * 100;
    boxSvg.style.transformOrigin = `${ox}% ${oy}%`;
  }

  function drawCurve(mx, my) {
    noiseT += 0.018;
    const { x: tx, y: ty } = getTarget();
    const dx  = tx - mx, dy = ty - my;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx  = -dy / len, ny = dx / len;
    const w1  = Math.sin(noiseT)               * Math.min(len * 0.28, 44);
    const w2  = Math.cos(noiseT * 0.75 + 1.5)  * Math.min(len * 0.20, 32);
    const cp1x = mx + dx * 0.33 + nx * w1;
    const cp1y = my + dy * 0.33 + ny * w1;
    const cp2x = mx + dx * 0.67 + nx * w2;
    const cp2y = my + dy * 0.67 + ny * w2;
    // Stop 30px short — visual gap before the corner bracket box
    const ex = tx - (dx / len) * 30;
    const ey = ty - (dy / len) * 30;
    path.setAttribute('d', `M${mx},${my} C${cp1x},${cp1y} ${cp2x},${cp2y} ${ex},${ey}`);
    dot.setAttribute('cx', ex);
    dot.setAttribute('cy', ey);
  }

  function startWiggle() {
    positionBox();
    function tick() { drawCurve(lastMx, lastMy); wiggleFrame = requestAnimationFrame(tick); }
    tick();
  }
  function stopWiggle() { cancelAnimationFrame(wiggleFrame); }

  card.addEventListener('mousemove', e => {
    const r = card.getBoundingClientRect();
    lastMx = e.clientX - r.left;
    lastMy = e.clientY - r.top;
  });
  card.addEventListener('mouseenter', startWiggle);
  card.addEventListener('mouseleave', stopWiggle);
});

/* ============================================================
   9. WAVE CANVAS — Organic sinusoidal ocean surface
   ─────────────────────────────────────────────────────────────
   4 wave layers rendered back-to-front. Each layer is the sum
   of 3 sinusoids with different frequencies and speeds — some
   running left, some right — creating genuine interference that
   never looks mechanical or repeating.

   Architecture:
   · Canvas fills the .fixed-wave div (160 px tall, full width)
   · Above wave crests → transparent → cream nav bleeds through
   · Below wave surface → navy→transparent gradient → seamless ocean
   · Front layer gets foam caps + drift particles at crests
   · Surface glint dots shimmer using per-point sine clock
   ============================================================ */
(function initWaves() {
  const canvas = document.getElementById('waveCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W = 0, H = 0;

  /* ── Resize: handle devicePixelRatio for crisp HiDPI rendering ── */
  function resize() {
    const dpr  = window.devicePixelRatio || 1;
    W = canvas.offsetWidth;
    H = canvas.offsetHeight;
    canvas.width  = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  /* ──────────────────────────────────────────────────────────
     Wave layer definitions — listed back (index 0) to front.

     Each layer has:
       baseY  — resting surface as a fraction of canvas height
       comps  — array of sinusoidal components {A, k, ω, φ}
                A  = amplitude in px
                k  = spatial frequency (rad/px)
                ω  = temporal frequency (rad/ms); negative = travels right→left
                φ  = initial phase offset (rad)
       r,g,b  — fill colour
       alpha  — base fill opacity
       foam   — whether to draw breaking foam on this layer

     Wave physics note: real deep-water ocean waves have a dispersion
     relation ω² = g·k. We don't enforce this strictly but the relative
     speeds are tuned so shorter waves run faster, which looks natural.
  ────────────────────────────────────────────────────────── */
  const LAYERS = [
    /* ── Layer 0: deep back swell (slowest, largest) ── */
    {
      baseY: 0.50,
      comps: [
        { A: 16, k: 0.00620, ω:  0.00040 },
        { A:  9, k: 0.01050, ω: -0.00065, φ: 1.84 },
        { A:  5, k: 0.01880, ω:  0.00095, φ: 3.70 },
      ],
      r: 10, g: 72, b: 120, alpha: 0.92,
      foam: false,
    },
    /* ── Layer 1: secondary swell ── */
    {
      baseY: 0.44,
      comps: [
        { A: 18, k: 0.00540, ω:  0.00054 },
        { A: 11, k: 0.00920, ω: -0.00085, φ: 2.42 },
        { A:  6, k: 0.01660, ω:  0.00118, φ: 0.92 },
      ],
      r: 15, g: 85, b: 140, alpha: 0.80,
      foam: false,
    },
    /* ── Layer 2: mid-water swell ── */
    {
      baseY: 0.38,
      comps: [
        { A: 20, k: 0.00470, ω:  0.00070 },
        { A: 12, k: 0.00830, ω: -0.00105, φ: 1.25 },
        { A:  7, k: 0.01440, ω:  0.00148, φ: 4.10 },
      ],
      r: 20, g: 98, b: 158, alpha: 0.68,
      foam: false,
    },
    /* ── Layer 3: front surface (fastest, with foam) ── */
    {
      baseY: 0.33,
      comps: [
        { A: 22, k: 0.00410, ω:  0.00088 },
        { A: 13, k: 0.00740, ω: -0.00132, φ: 0.60 },
        { A:  8, k: 0.01320, ω:  0.00182, φ: 2.92 },
      ],
      r: 27, g: 108, b: 168, alpha: 0.55,
      foam: true,
    },
  ];

  /* ── Evaluate a layer's surface y at horizontal position x and time t ── */
  function surfaceY(layer, x, t) {
    let y = layer.baseY * H;
    for (const c of layer.comps) {
      y += c.A * Math.sin(c.k * x + c.ω * t + (c.φ || 0));
    }
    return y;
  }

  /* ── Draw one wave layer as a filled shape with a vertical gradient ── */
  function drawLayer(layer, t) {
    /*
      Gradient: solid navy at the wave surface, tapering toward the bottom.
      We do NOT go all the way to alpha=0 — a residual 0.04 ensures the
      CSS background (navy) shows through cleanly rather than the cream.
      This keeps the bottom of the wave bar seamlessly blue.
    */
    const topY = (layer.baseY - 0.20) * H;
    const grad = ctx.createLinearGradient(0, topY, 0, H);
    const { r, g, b, alpha: a } = layer;
    grad.addColorStop(0,    `rgba(${r},${g},${b},${a})`);
    grad.addColorStop(0.40, `rgba(${r},${g},${b},${(a * 0.82).toFixed(3)})`);
    grad.addColorStop(0.72, `rgba(${r},${g},${b},${(a * 0.46).toFixed(3)})`);
    grad.addColorStop(0.90, `rgba(${r},${g},${b},${(a * 0.10).toFixed(3)})`);
    grad.addColorStop(1,    `rgba(${r},${g},${b},0)`);

    ctx.beginPath();
    ctx.moveTo(0, H);
    const step = 3;
    for (let x = 0; x <= W; x += step) {
      ctx.lineTo(x, surfaceY(layer, x, t));
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
  }

  /* ── Foam particle pool ── */
  const particles = [];
  const MAX_PARTICLES = 120;

  function spawnParticle(x, y) {
    if (particles.length >= MAX_PARTICLES) return;
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 1.1,
      vy: -(Math.random() * 0.55 + 0.15),
      r:  Math.random() * 2.8 + 1.0,
      life: 1.0,
      decay: Math.random() * 0.007 + 0.003,
    });
  }

  function tickParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x    += p.vx;
      p.y    += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${(p.life * 0.52).toFixed(3)})`;
      ctx.fill();
    }
  }

  /* ── Draw foam caps and breaking streaks on the front wave layer ── */
  function drawFoam(layer, t) {
    const step    = 5;
    const prevArr = []; // cache previous y values for crest detection

    for (let x = step; x < W - step; x += step) {
      const yPrev = surfaceY(layer, x - step, t);
      const yCurr = surfaceY(layer, x,         t);
      const yNext = surfaceY(layer, x + step,  t);

      /* Local minimum in y = wave crest (y increases downward) */
      if (yCurr < yPrev && yCurr < yNext) {
        /* Pulsing foam opacity — each crest surges at its own beat */
        const pulse = 0.35 + 0.50 * (Math.sin(t * 0.0014 + x * 0.038) + 1) * 0.5;

        /* Foam cap ellipse at crest peak */
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(x, yCurr - 1.5, 16, 5, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${(pulse * 0.50).toFixed(3)})`;
        ctx.fill();
        ctx.restore();

        /* Breaking streak — dashed arc on the steep front face */
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x - 26, yCurr + 9);
        ctx.bezierCurveTo(x - 12, yCurr + 2, x - 3, yCurr - 4, x + 10, yCurr + 3);
        ctx.strokeStyle = `rgba(255,255,255,${(pulse * 0.44).toFixed(3)})`;
        ctx.lineWidth   = 2.6;
        ctx.lineCap     = 'round';
        ctx.setLineDash([8, 3, 3, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        /* Secondary trailing streak further back */
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x + 8, yCurr + 4);
        ctx.bezierCurveTo(x + 20, yCurr + 1, x + 32, yCurr + 5, x + 44, yCurr + 10);
        ctx.strokeStyle = `rgba(255,255,255,${(pulse * 0.22).toFixed(3)})`;
        ctx.lineWidth   = 1.6;
        ctx.lineCap     = 'round';
        ctx.setLineDash([5, 4, 2, 7]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        /* Spray droplet above tallest crests */
        if (yCurr < layer.baseY * H - 16) {
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(x + 2, yCurr - 5, 7, 2.5, -0.2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${(pulse * 0.30).toFixed(3)})`;
          ctx.fill();
          ctx.restore();
        }

        /* Probabilistically spawn drift particles at active crests */
        if (Math.random() < 0.045) {
          spawnParticle(x + (Math.random() - 0.5) * 10, yCurr - 1);
        }
      }
    }

    /* Render and age all drift particles */
    tickParticles();
  }

  /* ── Surface glints: tiny shimmer dots that ride the front wave ── */
  const GLINT_COUNT = 18;
  const glints = Array.from({ length: GLINT_COUNT }, (_, i) => ({
    xFrac:  i / GLINT_COUNT + (Math.random() * 0.5 / GLINT_COUNT), // evenly-ish distributed
    phase:  Math.random() * Math.PI * 2,
    speed:  0.0018 + Math.random() * 0.0024,
  }));

  function drawGlints(frontLayer, t) {
    for (const g of glints) {
      const x     = (g.xFrac * W * 1.4) % W;   // wrap & stretch for variety
      const y     = surfaceY(frontLayer, x, t);
      const alpha = 0.25 + 0.65 * (Math.sin(t * g.speed + g.phase) + 1) * 0.5;
      if (alpha < 0.15) continue;
      ctx.beginPath();
      ctx.arc(x, y - 1.5, 1.6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
      ctx.fill();
    }
  }

  /* ── Main animation loop ── */
  let startTime = null;

  function frame(ts) {
    if (!startTime) startTime = ts;
    const t = ts - startTime;

    ctx.clearRect(0, 0, W, H);

    /* Draw all layers back → front */
    for (const layer of LAYERS) drawLayer(layer, t);

    /* Foam and glints only on the front layer */
    const front = LAYERS[LAYERS.length - 1];
    drawFoam(front, t);
    drawGlints(front, t);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}());

