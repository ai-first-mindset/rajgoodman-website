/* Cookie consent — vanilla, zero-dependency. Two layers (banner + preferences),
   categorized (Necessary / Analytics / Marketing), wired to Google Consent
   Mode v2 via gtag(). No cookies/tags fire before an explicit choice.

   Load this in <head> on every page (BEFORE the GTM snippet, once GTM is added)
   so the Consent Mode defaults are set first. It injects its own stylesheet and
   a "Cookie settings" link into the footer .f-bot — no per-page markup needed. */
(function () {
  'use strict';

  var STORAGE_KEY = 'rg_cookie_consent';
  var POLICY_VERSION = 1;              // bump to force re-consent after a policy change
  var MAX_AGE_DAYS = 365;             // re-prompt after ~12 months
  var PRIVACY_URL = '/privacy-policy/';
  var CSS_HREF = '/assets/cookie-consent.css';

  // Category -> Consent Mode v2 signal(s). 'necessary' is always granted.
  var SIGNALS = {
    analytics: ['analytics_storage'],
    marketing: ['ad_storage', 'ad_user_data', 'ad_personalization']
  };

  var CATEGORIES = [
    {
      key: 'necessary', locked: true, title: 'Strictly necessary',
      desc: 'Required for the site to function — security, load balancing and remembering your cookie choice. Always on.'
    },
    {
      key: 'analytics', locked: false, title: 'Analytics',
      desc: 'Anonymous usage data (e.g. Google Analytics via Tag Manager) so we can see what content is useful and improve the site.'
    },
    {
      key: 'marketing', locked: false, title: 'Marketing',
      desc: 'Lets us and partners measure and personalise ads (e.g. LinkedIn, Google Ads). Off unless you allow it.'
    }
  ];

  // ---- gtag / dataLayer bootstrap (works before GTM is installed) ----
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  // Consent Mode v2 DEFAULT: deny everything storable until the user chooses.
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500
  });

  // Inject our stylesheet as early as possible (once).
  if (!document.querySelector('link[data-cc-css]')) {
    var css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = CSS_HREF; css.setAttribute('data-cc-css', '');
    (document.head || document.documentElement).appendChild(css);
  }

  // ---- storage ----
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var v = JSON.parse(raw);
      if (v.version !== POLICY_VERSION) return null;
      if (Date.now() - v.ts > MAX_AGE_DAYS * 864e5) return null;
      return v;
    } catch (e) { return null; }
  }
  function save(consent) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: POLICY_VERSION, ts: Date.now(), consent: consent
      }));
    } catch (e) {}
  }

  // ---- apply choice to Consent Mode ----
  function applyConsent(consent) {
    var update = {};
    Object.keys(SIGNALS).forEach(function (cat) {
      var state = consent[cat] ? 'granted' : 'denied';
      SIGNALS[cat].forEach(function (sig) { update[sig] = state; });
    });
    gtag('consent', 'update', update);
    window.dataLayer.push({ event: 'cookie_consent_update', consent: consent });
  }

  // ---- DOM ----
  var bannerNode, overlayNode, lastFocus;

  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (html != null) n.innerHTML = html;
    return n;
  }

  function buildBanner() {
    var b = el('div', {
      class: 'cc-banner', role: 'dialog', 'aria-live': 'polite',
      'aria-label': 'Cookie consent', id: 'cc-banner'
    });
    b.innerHTML =
      '<h2>Your privacy</h2>' +
      '<p>We use cookies to run the site and, with your consent, to measure traffic and ' +
      'personalise marketing. See our <a href="' + PRIVACY_URL + '">Privacy Policy</a>.</p>' +
      '<div class="cc-actions">' +
        '<button type="button" class="cc-btn cc-btn-y" data-cc="accept">Accept all</button>' +
        '<button type="button" class="cc-btn cc-btn-line" data-cc="reject">Reject all</button>' +
        '<button type="button" class="cc-btn cc-btn-ghost" data-cc="prefs">Preferences</button>' +
      '</div>';
    b.addEventListener('click', function (e) {
      var act = e.target.getAttribute && e.target.getAttribute('data-cc');
      if (act === 'accept') decide({ analytics: true, marketing: true });
      else if (act === 'reject') decide({ analytics: false, marketing: false });
      else if (act === 'prefs') openPanel();
    });
    return b;
  }

  function buildPanel(current) {
    var overlay = el('div', { class: 'cc-overlay' });
    var panel = el('div', {
      class: 'cc-panel', role: 'dialog', 'aria-modal': 'true',
      'aria-labelledby': 'cc-panel-title'
    });

    var rows = CATEGORIES.map(function (c) {
      var checked = c.locked || (current && current[c.key]);
      return '' +
        '<div class="cc-cat">' +
          '<h3>' + c.title + (c.locked ? ' <span class="cc-tag">Always on</span>' : '') + '</h3>' +
          '<p>' + c.desc + '</p>' +
          '<span class="cc-switch-wrap"><label class="cc-switch">' +
            '<input type="checkbox" data-cat="' + c.key + '"' +
              (checked ? ' checked' : '') + (c.locked ? ' disabled' : '') +
              ' aria-label="' + c.title + '">' +
            '<span class="cc-track"></span>' +
          '</label></span>' +
        '</div>';
    }).join('');

    panel.innerHTML =
      '<h2 id="cc-panel-title">Cookie preferences</h2>' +
      '<p>Choose which categories to allow. You can change this any time via the ' +
      '“Cookie settings” link in the footer. Read our <a href="' + PRIVACY_URL + '">Privacy Policy</a>.</p>' +
      rows +
      '<div class="cc-panel-actions">' +
        '<button type="button" class="cc-btn cc-btn-y" data-cc="save">Save preferences</button>' +
        '<button type="button" class="cc-btn cc-btn-line" data-cc="accept">Accept all</button>' +
        '<button type="button" class="cc-btn cc-btn-line" data-cc="reject">Reject all</button>' +
      '</div>';

    panel.addEventListener('click', function (e) {
      var act = e.target.getAttribute && e.target.getAttribute('data-cc');
      if (act === 'accept') decide({ analytics: true, marketing: true });
      else if (act === 'reject') decide({ analytics: false, marketing: false });
      else if (act === 'save') {
        var chosen = {};
        panel.querySelectorAll('input[data-cat]').forEach(function (inp) {
          chosen[inp.getAttribute('data-cat')] = inp.checked;
        });
        decide(chosen);
      }
    });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closePanel(); });
    document.addEventListener('keydown', escClose);
    overlay.appendChild(panel);
    return overlay;
  }

  function escClose(e) { if (e.key === 'Escape') closePanel(); }

  function openPanel() {
    lastFocus = document.activeElement;
    var current = (load() || {}).consent || {};
    overlayNode = buildPanel(current);
    document.body.appendChild(overlayNode);
    var first = overlayNode.querySelector('button, input:not([disabled])');
    if (first) first.focus();
  }
  function closePanel() {
    if (overlayNode) { overlayNode.remove(); overlayNode = null; }
    document.removeEventListener('keydown', escClose);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function decide(consent) {
    consent.necessary = true;
    save(consent);
    applyConsent(consent);
    closePanel();
    if (bannerNode) { bannerNode.remove(); bannerNode = null; }
  }

  function showBanner() {
    bannerNode = buildBanner();
    document.body.appendChild(bannerNode);
  }

  // Add a "Cookie settings" control to the footer so users can reopen the panel.
  function injectFooterLink() {
    var bot = document.querySelector('.f-bot');
    if (!bot || bot.querySelector('.cc-open')) return;
    var link = el('button', { type: 'button', class: 'cc-open' }, 'Cookie settings');
    link.addEventListener('click', openPanel);
    bot.appendChild(link);
  }

  // Public hook (footer link, or a manual "manage cookies" trigger).
  window.RGCookieConsent = {
    open: openPanel,
    reset: function () { try { localStorage.removeItem(STORAGE_KEY); } catch (e) {} }
  };

  // ---- init ----
  function init() {
    injectFooterLink();
    var stored = load();
    if (stored && stored.consent) { applyConsent(stored.consent); }
    else { showBanner(); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
