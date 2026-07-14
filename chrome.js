/* Shared site chrome: injects the nav + footer used on every interior page.
   Set <body data-page="..."> to highlight the active nav item.
   Load this BEFORE common.js. */
(function () {
  'use strict';
  var page = document.body.getAttribute('data-page') || '';

  function on(group) { return page === group ? ' class="active"' : ''; }

  var MARK = 'assets/Layer-1-3.svg';
  var LOGO = 'assets/Raj-Goodman_logo-1.svg';

  var nav =
  '<nav class="nav" data-nav><div class="wrap nav-in">' +
    '<a href="/" class="brand" aria-label="Raj Goodman home"><img class="mark" src="/' + MARK + '" alt="" width="27" height="32" aria-hidden="true"/><span class="wm">Raj Goodman</span></a>' +
    '<div class="nav-links">' +
      '<div class="nav-item' + (page === 'about' || page === 'eo-ypo' ? ' active' : '') + '"><a>About</a>' +
        '<div class="nav-menu">' +
          '<a href="/about/">About Raj</a>' +
          '<a href="/eo-ypo-leadership/">EO Leadership &amp; YPO Impact</a>' +
        '</div>' +
      '</div>' +
      '<div class="nav-item' + (['keynote','workshops','exec-training','biz-leaders','ai-trainer','ai-consultant','org-transform','caio'].indexOf(page) > -1 ? ' active' : '') + '"><a>Services</a>' +
        '<div class="nav-menu">' +
          '<a href="/keynote-speaker/">Keynote Speaker</a>' +
          '<a href="/workshops/tech-workshop/">Workshops</a>' +
          '<span class="grp">AI Training</span>' +
          '<a href="/ai-training-for-executives/">Executive AI Training</a>' +
          '<a href="/ai-for-business-leaders/">AI for Business Leaders</a>' +
          '<a href="/ai-trainer/">AI Trainer</a>' +
          '<span class="grp">Consulting</span>' +
          '<a href="/ai-business-consultant/">AI Business Consultant</a>' +
          '<a href="/organizational-transformation-consultant/">Organizational Transformation</a>' +
          '<a href="/fractional-chief-ai-officer/">Fractional Chief AI Officer</a>' +
        '</div>' +
      '</div>' +
      '<a href="/events/"' + on('events') + '>Events</a>' +
      '<div class="nav-item' + (page === 'blog' || page === 'media' || page === 'authors' ? ' active' : '') + '"><a>Resources</a>' +
        '<div class="nav-menu">' +
          '<a href="/blog/">Blog</a>' +
          '<a href="/media/">Media</a>' +
          '<a href="/authors/">Authors</a>' +
        '</div>' +
      '</div>' +
      '<a href="/testimonials/"' + on('testimonials') + '>Testimonials</a>' +
    '</div>' +
    '<div class="nav-cta">' +
      '<a href="#work" class="btn btn-y">Let\u2019s Talk <span class="ar">\u2192</span></a>' +
      '<button class="burger" data-nav-toggle aria-label="Menu"><span></span><span></span><span></span></button>' +
    '</div>' +
  '</div></nav>' +
  '<div class="mnav" data-mobile-nav>' +
    '<span class="grp">About</span>' +
    '<a href="/about/">About Raj</a><a href="/eo-ypo-leadership/">EO Leadership &amp; YPO Impact</a>' +
    '<span class="grp">Services</span>' +
    '<a href="/keynote-speaker/">Keynote Speaker</a><a href="/workshops/tech-workshop/">Workshops</a>' +
    '<a href="/ai-training-for-executives/">Executive AI Training</a><a href="/ai-for-business-leaders/">AI for Business Leaders</a>' +
    '<a href="/ai-trainer/">AI Trainer</a><a href="/ai-business-consultant/">AI Business Consultant</a>' +
    '<a href="/organizational-transformation-consultant/">Organizational Transformation</a><a href="/fractional-chief-ai-officer/">Fractional CAIO</a>' +
    '<span class="grp">More</span>' +
    '<a href="/events/">Events</a><a href="/blog/">Blog</a><a href="/media/">Media</a><a href="/authors/">Authors</a><a href="/testimonials/">Testimonials</a>' +
    '<a href="#work">Let\u2019s Talk</a>' +
  '</div>';

  var footer =
  '<footer><div class="wrap"><div class="f-grid">' +
    '<div class="f-brand">' +
      '<a href="/" class="brand" aria-label="Raj Goodman home"><img class="full" src="/' + LOGO + '" alt="Raj Goodman" width="137" height="38"/></a>' +
      '<p>Insights from a visionary AI futurist speaker transforming business mindsets - changing how machines think, how businesses scale, and how entrepreneurs build tomorrow\u2019s solutions.</p>' +
    '</div>' +
    '<div class="fcol"><h4>Helping Through</h4>' +
      '<a href="/workshops/tech-workshop/">Workshops</a><a href="/ai-training-for-executives/">AI Training</a><a href="/ai-business-consultant/">AI Business Consultant</a><a href="/organizational-transformation-consultant/">Organizational Transformation</a><a href="/fractional-chief-ai-officer/">Fractional CAIO</a>' +
    '</div>' +
    '<div class="fcol"><h4>Ventures</h4>' +
      '<a href="https://goodmanlantern.com/" target="_blank" rel="noopener">Goodman Lantern</a><a href="https://aifirstmindset.ai/" target="_blank" rel="noopener">AI-First Mindset</a>' +
    '</div>' +
    '<div class="fcol"><h4>Quick Links</h4>' +
      '<a href="/about/">About Raj</a><a href="/events/">Events</a><a href="/blog/">Blog</a><a href="/authors/">Authors</a><a href="/testimonials/">Testimonials</a><a href="/site-map/">Sitemap</a>' +
    '</div>' +
  '</div>' +
  '<div class="f-bot"><span>\u00a9 2026 RAJGOODMAN.COM - ALL RIGHTS RESERVED | <a href="/terms-and-conditions/">LEGAL</a></span><span>AI FUTURIST \u00b7 KEYNOTE SPEAKER</span></div>' +
  '</div></footer>';

  document.body.insertAdjacentHTML('afterbegin', nav);
  document.body.insertAdjacentHTML('beforeend', footer);
})();
