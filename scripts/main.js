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
   2. TURTLE PATH ANIMATION — scroll-driven (Hero page only)

   The hero wrapper is 280vh tall; the inner sticky div is
   100vh so the ocean stays fixed while the user scrolls
   180vh worth.  We map that scroll progress [0→1] to a
   position along an SVG cubic-bezier path (id="divePath").

   getTotalLength() / getPointAtLength() handle all the math;
   we just set the turtle <g> transform each frame.
   Because the turtle lives *inside* the SVG, its coordinates
   are in SVG-space (1440×900) — no viewport conversion needed.
   ============================================================ */
const heroScrollWrapper = $('#heroScrollWrapper');
const divePath          = $('#divePath');
const turtleGroup       = $('#turtleGroup');
const heroContent       = $('#heroContent');
const scrollCueEl       = $('#scrollCue');

if (divePath && turtleGroup && heroScrollWrapper) {

  const pathLength = divePath.getTotalLength();

  // Smooth-lerp state (avoids jitter on low-res scroll events)
  let currentDist = 0;
  let targetDist  = 0;
  let rafId       = null;

  const lerp = (a, b, t) => a + (b - a) * t;

  const applyTurtleTransform = (dist) => {
    const pt      = divePath.getPointAtLength(dist);
    // Sample 2px ahead on the path to compute tangent angle
    const ptAhead = divePath.getPointAtLength(Math.min(dist + 2, pathLength));
    // atan2 returns angle where 0° = right, 90° = down
    const angle   = Math.atan2(ptAhead.y - pt.y, ptAhead.x - pt.x) * (180 / Math.PI);
    turtleGroup.setAttribute(
      'transform',
      `translate(${pt.x.toFixed(2)},${pt.y.toFixed(2)}) rotate(${angle.toFixed(2)})`
    );
  };

  const tick = () => {
    currentDist = lerp(currentDist, targetDist, 0.08);
    applyTurtleTransform(currentDist);
    rafId = requestAnimationFrame(tick);
  };

  const updateTargets = () => {
    const scrolled  = window.scrollY;
    const maxScroll = heroScrollWrapper.offsetHeight - window.innerHeight;
    const progress  = Math.max(0, Math.min(scrolled / maxScroll, 1));

    targetDist = progress * pathLength;

    // ── Hero text: fade + slide up as turtle dives ──
    if (heroContent) {
      // Fully visible at progress=0, fully gone by progress=0.32
      const textOpacity = Math.max(0, 1 - progress / 0.32);
      const textSlide   = progress * -50; // px, slides upward
      heroContent.style.opacity   = textOpacity;
      heroContent.style.transform =
        `translate(-50%, calc(-50% + ${textSlide}px))`;
    }

    // ── Scroll cue: disappears quickly ──
    if (scrollCueEl) {
      scrollCueEl.style.opacity = Math.max(0, 1 - progress / 0.1);
    }
  };

  window.addEventListener('scroll', updateTargets, { passive: true });
  updateTargets(); // set initial position
  tick();          // start animation loop
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

/* ============================================================
   8. DEPTH TINT — darken the sticky ocean as turtle dives
      Drives a CSS custom property --depth-tint on the SVG
      so the background gradually shifts toward the abyss.
   ============================================================ */
const oceanSceneEl = $('#oceanScene');
if (oceanSceneEl && heroScrollWrapper) {
  window.addEventListener('scroll', () => {
    const scrolled  = window.scrollY;
    const maxScroll = heroScrollWrapper.offsetHeight - window.innerHeight;
    const progress  = Math.max(0, Math.min(scrolled / maxScroll, 1));
    // Overlay a semi-transparent dark rect by raising its opacity
    oceanSceneEl.style.setProperty('--depth-progress', progress.toFixed(3));
  }, { passive: true });
}
