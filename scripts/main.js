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
   2. TURTLE PATH ANIMATION + DEPTH REVEALS (Hero page only)

   The hero wrapper is 500vh tall; inner sticky div is 100vh.
   Scroll progress [0→1] over 400vh drives:
     · turtle position along SVG path (getPointAtLength)
     · hero text fade-out
     · depth panel reveal (each has a data-threshold)
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

// Collect depth panels (order matters — threshold ascending)
const depthPanels = Array.from($$('[id^="depthPanel"]'));

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

  /* Place turtle along the path at distance `dist` */
  const applyTurtle = (dist) => {
    const pt      = divePath.getPointAtLength(dist);
    const ptAhead = divePath.getPointAtLength(Math.min(dist + 2, pathLength));
    const angle   = Math.atan2(ptAhead.y - pt.y, ptAhead.x - pt.x) * (180 / Math.PI);
    turtleGroup.setAttribute(
      'transform',
      `translate(${pt.x.toFixed(2)},${pt.y.toFixed(2)}) rotate(${angle.toFixed(2)})`
    );
  };

  /* RAF loop — lerps turtle toward target every frame */
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

    // ── 1. Turtle target distance ──
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

    // ── 4. Depth panels: fade in at their threshold ──
    depthPanels.forEach(panel => {
      const threshold = parseFloat(panel.dataset.threshold || 0);
      if (progress >= threshold) {
        panel.classList.add('visible');
      }
    });

    // ── 5. Depth meter: fill + dot + readout ──
    if (dmFill) {
      dmFill.style.height = `${(progress * 100).toFixed(1)}%`;
    }
    // Depth meter track covers top:50%±30vh of viewport — map progress to that
    const meterTopPct   = 50 - 30;    // track top = 20% of vh
    const meterHeightPct = 60;        // track height = 60vh
    const dotTopPct = meterTopPct + progress * meterHeightPct;
    if (dmDot) {
      dmDot.style.top = `${dotTopPct}%`;
    }
    if (dmReadout) {
      dmReadout.style.top = `${dotTopPct + 2}%`;
      // Pick the closest depth label
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

