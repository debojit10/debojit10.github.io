/* ============================================================================
 * debojit10.github.io — the entire script.
 *
 * No dependencies, no bundler, no CDN. Three responsibilities and nothing
 * else: the theme control, the section reveal, and the running-head index.
 *
 * FAILURE POSTURE. Every behaviour degrades to a working page.
 *   Script blocked ....... light theme (dark via prefers-color-scheme), all
 *                          content visible, all links live, numerals inert.
 *   localStorage gone .... theme follows the OS on every load.
 *   No IntersectionObserver ... everything is revealed up front.
 *
 * DELIBERATELY ABSENT: no count-up on the metrics — animating the evidence
 * means that for 700ms every number on a page arguing "I keep numbers honest"
 * is wrong. No live clock, no scroll-progress bar, no back-to-top button, no
 * smooth-scroll polyfill, no theme-wipe overlay.
 * ========================================================================= */

(function () {
  'use strict';

  var root = document.documentElement;
  var darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  var reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* -- storage helpers: Safari private mode throws on both read and write -- */
  function readTheme() {
    try { return localStorage.getItem('theme'); } catch (e) { return null; }
  }
  function writeTheme(mode) {
    try {
      if (mode === 'system') localStorage.removeItem('theme');
      else localStorage.setItem('theme', mode);
    } catch (e) { /* nothing to do — the session still works, it just won't persist */ }
  }

  /* ======================================================================
   * A. THEME
   * `data-theme` is the resolved theme and drives the colour tokens;
   * `data-theme-mode` is the user's choice and drives which radio is checked.
   * Splitting them is what makes a genuine three-state control possible, and
   * it removes the "has the user chosen yet?" bookkeeping a toggle needs.
   * ==================================================================== */
  function resolve(mode) {
    if (mode === 'light' || mode === 'dark') return mode;
    return darkQuery.matches ? 'dark' : 'light';
  }

  // Browser chrome follows the OS through the two media-scoped meta tags. Once
  // the visitor chooses explicitly, only this third tag can keep the chrome
  // from contradicting the page.
  var themeColorMeta = document.getElementById('theme-color-override');
  var GROUND = { light: '#FBF8F3', dark: '#14120F' };

  function applyMode(mode) {
    root.dataset.themeMode = mode;
    var resolved = resolve(mode);
    root.dataset.theme = resolved;
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', mode === 'system' ? '' : GROUND[resolved]);
    }
  }

  var radios = document.querySelectorAll('input[name="theme"]');
  var stored = readTheme() || 'system';
  if (stored !== 'system') applyMode(stored);   // sync the theme-color tag too

  Array.prototype.forEach.call(radios, function (radio) {
    if (radio.value === stored) radio.checked = true;
    radio.addEventListener('change', function () {
      if (!radio.checked) return;
      writeTheme(radio.value);
      applyMode(radio.value);
    });
  });

  // Subscribed unconditionally: an OS theme flipped mid-session is honoured
  // whenever the visitor is still following the system.
  onMediaChange(darkQuery, function () {
    if (root.dataset.themeMode === 'system') root.dataset.theme = resolve('system');
  });

  /* ======================================================================
   * B. SECTION REVEAL
   * One observer, one shot per target. Stagger lives in CSS via an inline
   * --i, so there are no JS timers.
   * ==================================================================== */
  var reveals = document.querySelectorAll('.reveal');

  function revealAll() {
    Array.prototype.forEach.call(reveals, function (el) { el.classList.add('is-in'); });
  }

  function armReveal() {
    if (reduceQuery.matches || !('IntersectionObserver' in window)) {
      revealAll();
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target); // never re-animates on scroll-up
      });
    }, { threshold: 0.05, rootMargin: '0px 0px -12% 0px' });

    Array.prototype.forEach.call(reveals, function (el) { io.observe(el); });
  }

  armReveal();
  onMediaChange(reduceQuery, function () { if (reduceQuery.matches) revealAll(); });

  /* ======================================================================
   * C. RUNNING-HEAD INDEX
   * Marks which section is in view. Never moves focus, never writes to
   * location.hash. The colour follows from [aria-current] in CSS, so there is
   * no class to manage and nothing to animate.
   * ==================================================================== */
  var links = document.querySelectorAll('.running-head__nav .numeral');

  if (links.length && 'IntersectionObserver' in window) {
    var byId = {};
    var sections = [];

    Array.prototype.forEach.call(links, function (link) {
      var id = link.getAttribute('href').slice(1);
      var section = document.getElementById(id);
      if (!section) return;
      byId[id] = link;
      sections.push(section);
    });

    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        Array.prototype.forEach.call(links, function (l) { l.removeAttribute('aria-current'); });
        var link = byId[entry.target.id];
        if (link) link.setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-64px 0px -55% 0px', threshold: 0 });

    sections.forEach(function (section) { spy.observe(section); });
  }

  /* -- Safari < 14 has no addEventListener on MediaQueryList -------------- */
  function onMediaChange(mq, handler) {
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else if (mq.addListener) mq.addListener(handler);
  }
})();
