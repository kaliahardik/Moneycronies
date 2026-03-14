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

  // Ease-in-out quad — smooth entry and exit for panels
  const eio = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

  // Each panel slides from its side to centre, lingers, then exits back.
  // zoneStart = progress when it begins entering; zoneEnd = progress when fully exited.
  const PANEL_ZONES = [
    { id: 'depthPanel1', side: 'left',   zoneStart: 0.12, zoneEnd: 0.36 },
    { id: 'depthPanel2', side: 'right',  zoneStart: 0.36, zoneEnd: 0.58 },
    { id: 'depthPanel3', side: 'left',   zoneStart: 0.58, zoneEnd: 0.78 },
    { id: 'depthPanel4', side: 'centre', zoneStart: 0.78, zoneEnd: 0.97 },
  ].map(z => ({ ...z, el: document.getElementById(z.id) }))
   .filter(z => z.el);

  /* Animate every panel based on overall scroll progress */
  const updatePanels = (progress) => {
    // How far off-centre panels sit when hidden (adapts to viewport width)
    const slideRange = Math.min(window.innerWidth * 0.62, 560);

    PANEL_ZONES.forEach(({ el, side, zoneStart, zoneEnd }) => {
      // t: 0 = panel not yet in view, 1 = panel fully past
      const t = Math.max(0, Math.min(
        (progress - zoneStart) / (zoneEnd - zoneStart), 1
      ));

      let xOffset, opacity;

      if (side === 'centre') {
        // Centre panel just fades up and stays
        opacity = t < 0.18 ? eio(t / 0.18) : 1;
        xOffset = 0;
      } else {
        const dir = side === 'left' ? -1 : 1;
        if (t < 0.25) {
          // Entering: slide in from side
          const e  = eio(t / 0.25);
          xOffset  = dir * slideRange * (1 - e);
          opacity  = e;
        } else if (t > 0.75) {
          // Exiting: slide back to side
          const e  = eio((t - 0.75) / 0.25);
          xOffset  = dir * slideRange * e;
          opacity  = 1 - e;
        } else {
          // Centred: fully visible
          xOffset = 0;
          opacity = 1;
        }
      }

      el.style.transform     = `translateX(calc(-50% + ${xOffset.toFixed(1)}px)) translateY(-50%)`;
      el.style.opacity       = Math.max(0, opacity).toFixed(3);
      el.style.pointerEvents = opacity > 0.5 ? 'auto' : 'none';
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

