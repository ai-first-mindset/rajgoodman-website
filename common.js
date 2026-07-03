/* Shared interactions: scroll reveal, animated counters, smooth-scroll, mobile nav */
(function () {
  'use strict';

  /* ---- Scroll reveal (rect-based so it never depends on iframe visibility) ---- */
  function initReveal() {
    var els = [].slice.call(document.querySelectorAll('[data-reveal]'));
    if (els.length === 0) return;
    function show(el) {
      if (el.classList.contains('is-in')) return;
      var delay = el.getAttribute('data-delay');
      if (delay) el.style.transitionDelay = delay + 'ms';
      el.classList.add('is-in');
    }
    function check() {
      var vh = window.innerHeight || document.documentElement.clientHeight;
      for (var i = els.length - 1; i >= 0; i--) {
        var el = els[i];
        var r = el.getBoundingClientRect();
        if (r.top < vh * 0.92 && r.bottom > 0) {
          show(el);
          els.splice(i, 1);
        }
      }
      if (els.length === 0) {
        window.removeEventListener('scroll', check);
        window.removeEventListener('resize', check);
      }
    }
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    check();
    requestAnimationFrame(check);
    window.addEventListener('load', check);
    /* absolute failsafe: never leave content hidden */
    setTimeout(function () { els.slice().forEach(show); }, 2600);
  }

  /* ---- Animated counters ---- */
  function animateCount(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var decimals = (el.getAttribute('data-count').split('.')[1] || '').length;
    var suffix = el.getAttribute('data-suffix') || '';
    var dur = 1600;
    var start = null;
    function ease(t) { return 1 - Math.pow(1 - t, 3); }
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var val = ease(p) * target;
      el.textContent = (decimals ? val.toFixed(decimals) : Math.round(val).toLocaleString()) + suffix;
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = (decimals ? target.toFixed(decimals) : target.toLocaleString()) + suffix;
    }
    requestAnimationFrame(step);
  }
  function initCounters() {
    var els = [].slice.call(document.querySelectorAll('[data-count]'));
    if (els.length === 0) return;
    function check() {
      var vh = window.innerHeight || document.documentElement.clientHeight;
      for (var i = els.length - 1; i >= 0; i--) {
        var el = els[i], r = el.getBoundingClientRect();
        if (r.top < vh * 0.9 && r.bottom > 0) { animateCount(el); els.splice(i, 1); }
      }
      if (els.length === 0) window.removeEventListener('scroll', check);
    }
    window.addEventListener('scroll', check, { passive: true });
    check();
    requestAnimationFrame(check);
    setTimeout(check, 400);
  }

  /* ---- Smooth anchor scroll ---- */
  function initSmoothScroll() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute('href');
      if (id === '#' || id.length < 2) return;
      var t = document.querySelector(id);
      if (!t) return;
      e.preventDefault();
      var top = t.getBoundingClientRect().top + window.pageYOffset - 76;
      window.scrollTo({ top: top, behavior: 'smooth' });
      var nav = document.querySelector('[data-mobile-nav]');
      if (nav) nav.classList.remove('open');
    });
  }

  /* ---- Sticky nav shadow + mobile toggle ---- */
  function initNav() {
    var nav = document.querySelector('[data-nav]');
    if (nav) {
      var onScroll = function () { nav.classList.toggle('scrolled', window.pageYOffset > 24); };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
    var toggle = document.querySelector('[data-nav-toggle]');
    var menu = document.querySelector('[data-mobile-nav]');
    if (toggle && menu) {
      toggle.addEventListener('click', function () { menu.classList.toggle('open'); });
    }
  }

  /* ---- Hero pointer parallax (subtle) ---- */
  function initParallax() {
    var scene = document.querySelector('[data-parallax-scene]');
    if (!scene || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    scene.addEventListener('pointermove', function (e) {
      var r = scene.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5;
      var y = (e.clientY - r.top) / r.height - 0.5;
      scene.querySelectorAll('[data-depth]').forEach(function (el) {
        var d = parseFloat(el.getAttribute('data-depth'));
        el.style.transform = 'translate3d(' + (x * d * 28) + 'px,' + (y * d * 28) + 'px,0)';
      });
    });
    scene.addEventListener('pointerleave', function () {
      scene.querySelectorAll('[data-depth]').forEach(function (el) { el.style.transform = ''; });
    });
  }

  /* ---- In-page YouTube lightbox (fast + SEO-safe) ----
     Real <a href="…youtube…"> links stay in the DOM for crawlers and as a
     no-JS fallback. No iframe is created until the user clicks, so the page
     stays fast and YouTube doesn't load on first paint. */
  function initVideoLightbox() {
    var YT = /(?:youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/;
    var style = document.createElement('style');
    style.textContent =
      '.vlb{position:fixed;inset:0;z-index:200;display:none;align-items:center;justify-content:center;padding:24px}' +
      '.vlb.open{display:flex}' +
      '.vlb-bd{position:absolute;inset:0;background:rgba(10,7,1,.86);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}' +
      '.vlb-box{position:relative;width:min(1040px,100%);z-index:1}' +
      '.vlb-frame{position:relative;aspect-ratio:16/9;background:#000;border:1px solid rgba(244,239,230,.18);box-shadow:0 30px 90px -20px rgba(0,0,0,.85)}' +
      '.vlb-frame iframe{position:absolute;inset:0;width:100%;height:100%;border:0}' +
      '.vlb-x{position:absolute;top:-46px;right:0;background:none;border:0;color:#f4efe6;font-size:34px;line-height:1;cursor:pointer;padding:4px 8px;font-family:inherit}' +
      '.vlb-x:hover{color:#f3af00}';
    document.head.appendChild(style);
    var modal = document.createElement('div');
    modal.className = 'vlb';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = '<div class="vlb-bd"></div><div class="vlb-box"><button class="vlb-x" aria-label="Close video">×</button><div class="vlb-frame"></div></div>';
    document.body.appendChild(modal);
    var frame = modal.querySelector('.vlb-frame');
    function toSeconds(s) {
      if (!s) return 0;
      if (/^\d+$/.test(s)) return parseInt(s, 10);
      var h = (s.match(/(\d+)h/) || [])[1] || 0, m = (s.match(/(\d+)m/) || [])[1] || 0, x = (s.match(/(\d+)s/) || [])[1] || 0;
      return (+h) * 3600 + (+m) * 60 + (+x);
    }
    function open(id, start) {
      var src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0' + (start ? '&start=' + start : '');
      frame.innerHTML = '<iframe src="' + src +
        '" title="Video" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>';
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
    function close() {
      modal.classList.remove('open');
      frame.innerHTML = '';
      document.body.style.overflow = '';
    }
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href]');
      if (!a) return;
      var href = a.getAttribute('href');
      var m = href.match(YT);
      if (!m) return; // not a single video (e.g. channel/article links) — let it through
      e.preventDefault();
      var tm = href.match(/[?&](?:t|start)=([0-9hms]+)/);
      open(m[1], tm ? toSeconds(tm[1]) : 0);
    });
    modal.querySelector('.vlb-bd').addEventListener('click', close);
    modal.querySelector('.vlb-x').addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  /* ---- Forms: Cloudflare Turnstile + serverless submit ----
     Each form is marked with data-form="contact" | "newsletter". The widget is
     rendered explicitly so we control placement, and submit is intercepted to
     POST JSON (named fields + Turnstile token) to the matching /api endpoint. */
  var TURNSTILE_SITEKEY = '0x4AAAAAADpKQw5ozbUsMz-E'; // public sitekey — safe to commit
  var FORM_ENDPOINTS = { contact: '/api/contact/', newsletter: '/api/subscribe/' }; // trailing slash: trailingSlash:true 308-redirects the non-slash form

  function initForms() {
    var forms = [].slice.call(document.querySelectorAll('form[data-form]'));
    if (forms.length === 0) return;

    // Load the Turnstile script once, then render every widget explicitly.
    window.onTurnstileLoad = function () {
      forms.forEach(function (form) {
        var mount = form.querySelector('[data-turnstile]');
        if (!mount) return;
        form._tsWidgetId = window.turnstile.render(mount, {
          sitekey: TURNSTILE_SITEKEY,
          theme: 'dark',
        });
      });
    };
    var s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad';
    s.async = true;
    s.defer = true;
    // If the script never loads (ad blocker, network), the widget can't render
    // and no token can ever exist — say so instead of leaving a dead form.
    s.onerror = function () {
      forms.forEach(function (form) {
        form._tsBlocked = true;
        var mount = form.querySelector('[data-turnstile]');
        if (mount) {
          mount.innerHTML = '<p style="font-size:.84rem;color:var(--tx-60,#999);border:1px solid var(--line,#444);border-radius:4px;padding:.7em .9em;margin:0">'
            + 'The verification step couldn’t load — it may be blocked by a browser extension. '
            + 'Please allow challenges.cloudflare.com, or email '
            + '<a href="mailto:raj@goodmanlantern.com" style="color:var(--yellow,#f3af00)">raj@goodmanlantern.com</a> directly.</p>';
        }
      });
    };
    document.head.appendChild(s);

    forms.forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var type = form.getAttribute('data-form');
        var endpoint = FORM_ENDPOINTS[type];
        if (!endpoint) return;

        var btn = form.querySelector('.btn');
        if (form._tsBlocked) {
          setBtn(btn, 'Verification blocked — please email us', false);
          return;
        }
        var token = window.turnstile && form._tsWidgetId != null
          ? window.turnstile.getResponse(form._tsWidgetId) : '';
        if (!token) {
          setBtn(btn, 'Please complete the verification', false);
          return;
        }

        // Serialize named fields.
        var payload = { token: token };
        [].slice.call(form.querySelectorAll('[name]')).forEach(function (f) {
          payload[f.name] = f.value;
        });
        payload.source_page = location.host + location.pathname;

        setBtn(btn, 'Sending…', true);
        fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        })
          .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok && j.ok, pending: !!j.pending }; }); })
          .then(function (result) {
            if (result.ok) {
              var doneMsg = type === 'newsletter'
                ? (result.pending ? 'Almost done — check your inbox to confirm' : 'Thanks — you\'re subscribed')
                : 'Thank you — we\'ll be in touch';
              setBtn(btn, doneMsg, true);
              [].slice.call(form.querySelectorAll('input,select,textarea,button')).forEach(function (el) { el.disabled = true; });
            } else {
              setBtn(btn, 'Something went wrong — try again', false);
              if (window.turnstile && form._tsWidgetId != null) window.turnstile.reset(form._tsWidgetId);
            }
          })
          .catch(function () {
            setBtn(btn, 'Network error — try again', false);
            if (window.turnstile && form._tsWidgetId != null) window.turnstile.reset(form._tsWidgetId);
          });
      });
    });

    // Update button label while preserving its arrow icon; disabled controls re-submit.
    function setBtn(btn, text, disabled) {
      if (!btn) return;
      var ar = btn.querySelector('.ar');
      btn.textContent = text;
      if (ar) { btn.appendChild(document.createTextNode(' ')); btn.appendChild(ar); }
      btn.disabled = !!disabled;
    }
  }

  /* ---- LinkedIn widget: replace the static fallback cards with managed posts.
     Progressive enhancement — if the API is empty or unreachable, the hard-coded
     cards in the page stay. Injected cards omit data-reveal so they're visible
     immediately (the reveal observer has already run by the time this resolves). */
  function initLinkedIn() {
    var grid = document.querySelector('[data-li-grid]');
    if (!grid) return;
    fetch('/api/linkedin/').then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d || !d.posts || !d.posts.length) return; // keep the static fallback cards
      var posts = d.posts.slice(0, 4);
      var cards = [].slice.call(grid.querySelectorAll('.li-card'));
      // Update existing cards in place so their layout + reveal state are untouched;
      // only append/remove if the managed count differs from the hard-coded one.
      posts.forEach(function (p, i) {
        var a = cards[i];
        if (!a) {
          a = document.createElement('a');
          a.className = 'li-card'; a.target = '_blank'; a.rel = 'noopener';
          a.innerHTML = '<img/><span class="tag">in &middot; Raj Anand</span>';
          grid.appendChild(a); a.classList.add('is-in');
        }
        a.href = p.url || '#';
        var img = a.querySelector('img');
        if (img) { img.src = p.image_url || ''; img.alt = p.title || 'Raj Goodman LinkedIn post'; }
      });
      for (var j = posts.length; j < cards.length; j++) { cards[j].parentNode.removeChild(cards[j]); }
    }).catch(function () { /* keep the static fallback */ });
  }

  function init() {
    initReveal();
    initCounters();
    initSmoothScroll();
    initNav();
    initParallax();
    initVideoLightbox();
    initForms();
    initLinkedIn();
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
  /* Exposed for unit tests under Node (CommonJS); a no-op in the browser,
     where `module` is undefined. */
  if (typeof module !== 'undefined' && module.exports) module.exports = { initLinkedIn: initLinkedIn };
})();
