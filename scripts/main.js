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
   2. TURTLE SCROLL ANIMATION (Hero page only)
   ============================================================ */
const turtleWrapper = $('#turtleWrapper');

if (turtleWrapper) {
  // The turtle starts near the top-center and dives down as the user scrolls.
  // It also gently tilts (rotate) to simulate swimming downward.

  let rafId = null;
  let currentY   = 0;   // rendered position
  let currentRot = 0;   // rendered rotation
  let targetY    = 0;
  let targetRot  = 0;

  const heroStage = $('.hero-stage');

  const updateTurtleTarget = () => {
    if (!heroStage) return;
    const heroH = heroStage.offsetHeight;
    const scrolled = window.scrollY;
    // Scroll progress [0 → 1] over the hero section
    const progress = Math.min(scrolled / (heroH * 0.9), 1);

    // Y: from 15% → 80% of hero height (turtle dives down)
    targetY = heroH * (0.15 + progress * 0.65);
    // Slight downward tilt when diving
    targetRot = progress * 28;  // degrees
  };

  const lerp = (a, b, t) => a + (b - a) * t;

  const animateTurtle = () => {
    currentY   = lerp(currentY,   targetY,   0.06);
    currentRot = lerp(currentRot, targetRot, 0.06);

    turtleWrapper.style.top       = `${currentY}px`;
    turtleWrapper.style.transform = `translateX(-50%) rotate(${currentRot}deg)`;

    rafId = requestAnimationFrame(animateTurtle);
  };

  window.addEventListener('scroll', () => {
    updateTurtleTarget();
  }, { passive: true });

  updateTurtleTarget();
  animateTurtle();

  // Fade turtle out as user leaves hero
  window.addEventListener('scroll', () => {
    if (!heroStage) return;
    const heroH = heroStage.offsetHeight;
    const progress = window.scrollY / heroH;
    // Start fading at 70% scroll through hero
    const opacity = progress > 0.7 ? Math.max(0, 1 - (progress - 0.7) / 0.3) : 1;
    turtleWrapper.style.opacity = opacity;
  }, { passive: true });

  // Subtle flipper wiggle animation via CSS class toggling
  const turtleSvg = $('#turtleSvg');
  if (turtleSvg) {
    let wiggle = false;
    setInterval(() => {
      wiggle = !wiggle;
      turtleSvg.style.transform = wiggle ? 'scaleX(1.04)' : 'scaleX(1)';
    }, 800);
  }
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
   8. ALMANAC GRID subtle parallax on hero
   ============================================================ */
const heroStageEl = $('.hero-stage');
if (heroStageEl) {
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    heroStageEl.style.setProperty('--grid-offset', `${y * 0.3}px`);
  }, { passive: true });
}
