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
   7. ARTICLE CARD hover ripple (tactile delight)
   ============================================================ */
$$('.article-card').forEach(card => {
  card.addEventListener('mouseenter', () => {
    card.style.setProperty('--hover-scale', '1');
  });
});

