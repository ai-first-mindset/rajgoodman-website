/* Shared site chrome: injects the nav + footer used on every interior page.
   Set <body data-page="..."> to highlight the active nav item.
   Load this BEFORE common.js. The homepage (index.html) carries its own copy
   of this nav and footer inline: keep the two in step. */
(function () {
  'use strict';
  var page = document.body.getAttribute('data-page') || '';

  function on(group) { return page === group ? ' class="active"' : ''; }

  var MARK = 'assets/Layer-1-3.svg';
  var LOGO = 'assets/Raj-Goodman_logo-1.svg';
  var EXT = ' target="_blank" rel="noopener"';

  // Every "Book a discovery call" button goes to the contact form. Pages that
  // carry the form (#work) scroll to it; the rest go to the homepage form.
  var hasForm = typeof document.getElementById === 'function' ? !!document.getElementById('work') : true;
  var CALL = hasForm ? '#work' : '/#work';

  var OWNER_AI = 'https://aifirstmindset.ai/owner-ai/';
  var SPRINTS = 'https://resources.aifirstmindset.ai/membership';
  var AIFM_SERVICES = 'https://aifirstmindset.ai/services/';

  var nav =
  '<nav class="nav" data-nav><div class="wrap nav-in">' +
    '<a href="/" class="brand" aria-label="Raj Goodman home"><img class="mark" src="/' + MARK + '" alt="" width="27" height="32" aria-hidden="true"/><span class="wm">Raj Goodman</span></a>' +
    '<div class="nav-links">' +
      '<div class="nav-item' + (['about', 'eo-ypo', 'testimonials'].indexOf(page) > -1 ? ' active' : '') + '"><a>About</a>' +
        '<div class="nav-menu">' +
          '<a href="/about/">About Raj</a>' +
          '<a href="/eo-ypo-leadership/">EO Leadership &amp; YPO Impact</a>' +
          '<a href="/testimonials/">Testimonials</a>' +
        '</div>' +
      '</div>' +
      '<div class="nav-item' + (['keynote','workshops','exec-training','biz-leaders','ai-trainer'].indexOf(page) > -1 ? ' active' : '') + '"><a>Services</a>' +
        '<div class="nav-menu">' +
          '<a href="/workshops/tech-workshop/">Workshops</a>' +
          '<a href="/keynote-speaker/">Keynote Speaker</a>' +
          '<span class="grp">AI Training</span>' +
          '<a href="/ai-training-for-executives/">Executive AI Training</a>' +
          '<a href="/ai-for-business-leaders/">AI for Business Leaders</a>' +
          '<a href="/ai-trainer/">AI Trainer</a>' +
        '</div>' +
      '</div>' +
      '<div class="nav-item"><a>Programmes</a>' +
        '<div class="nav-menu">' +
          '<a href="' + OWNER_AI + '"' + EXT + '>OWNER/AI</a>' +
          '<a href="' + SPRINTS + '"' + EXT + '>AI Sprints</a>' +
          '<a href="' + AIFM_SERVICES + '"' + EXT + '>AI-First Mindset programmes</a>' +
        '</div>' +
      '</div>' +
      '<a href="/events/"' + on('events') + '>Events</a>' +
      '<div class="nav-item' + (['blog', 'media', 'authors', 'books'].indexOf(page) > -1 ? ' active' : '') + '"><a>Resources</a>' +
        '<div class="nav-menu">' +
          '<a href="/blog/">Blog</a>' +
          '<a href="/books/">Books</a>' +
          '<a href="/media/">Media</a>' +
          '<a href="/authors/">Authors</a>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="nav-cta">' +
      '<a href="' + CALL + '" class="btn btn-y">Book a discovery call <span class="ar">→</span></a>' +
      '<button class="burger" data-nav-toggle aria-label="Menu"><span></span><span></span><span></span></button>' +
    '</div>' +
  '</div></nav>' +
  '<div class="mnav" data-mobile-nav>' +
    '<span class="grp">About</span>' +
    '<a href="/about/">About Raj</a><a href="/eo-ypo-leadership/">EO Leadership &amp; YPO Impact</a><a href="/testimonials/">Testimonials</a>' +
    '<span class="grp">Services</span>' +
    '<a href="/workshops/tech-workshop/">Workshops</a><a href="/keynote-speaker/">Keynote Speaker</a>' +
    '<a href="/ai-training-for-executives/">Executive AI Training</a><a href="/ai-for-business-leaders/">AI for Business Leaders</a>' +
    '<a href="/ai-trainer/">AI Trainer</a>' +
    '<span class="grp">Programmes</span>' +
    '<a href="' + OWNER_AI + '"' + EXT + '>OWNER/AI</a><a href="' + SPRINTS + '"' + EXT + '>AI Sprints</a><a href="' + AIFM_SERVICES + '"' + EXT + '>AI-First Mindset programmes</a>' +
    '<span class="grp">More</span>' +
    '<a href="/events/">Events</a><a href="/blog/">Blog</a><a href="/books/">Books</a><a href="/media/">Media</a><a href="/authors/">Authors</a>' +
    '<a href="' + CALL + '" class="btn btn-y mnav-cta">Book a discovery call</a>' +
  '</div>';

  var footer =
  '<footer><div class="wrap"><div class="f-grid">' +
    '<div class="f-brand">' +
      '<a href="/" class="brand" aria-label="Raj Goodman home"><img class="full" src="/' + LOGO + '" alt="Raj Goodman" width="137" height="38"/></a>' +
      '<p>Raj Goodman Anand runs AI workshops and programmes for business owners and their leadership teams.</p>' +
    '</div>' +
    '<div class="fcol"><h4>Services</h4>' +
      '<a href="/workshops/tech-workshop/">Workshops</a><a href="/keynote-speaker/">Keynote Speaker</a><a href="/ai-training-for-executives/">AI Training</a>' +
    '</div>' +
    '<div class="fcol"><h4>Programmes</h4>' +
      '<a href="' + OWNER_AI + '"' + EXT + '>OWNER/AI</a><a href="' + SPRINTS + '"' + EXT + '>AI Sprints</a><a href="https://aifirstmindset.ai/"' + EXT + '>AI-First Mindset</a>' +
    '</div>' +
    '<div class="fcol"><h4>Resources</h4>' +
      '<a href="/blog/">Blog</a><a href="/books/">Books</a><a href="/#newsletter">Newsletter</a><a href="/media/">Media</a><a href="/events/">Events</a>' +
    '</div>' +
    '<div class="fcol"><h4>About</h4>' +
      '<a href="/about/">About Raj</a><a href="/eo-ypo-leadership/">EO &amp; YPO</a><a href="/testimonials/">Testimonials</a><a href="/authors/">Authors</a><a href="https://goodmanlantern.com/"' + EXT + '>Goodman Lantern</a><a href="/site-map/">Sitemap</a>' +
    '</div>' +
  '</div>' +
  '<div class="f-bot"><span>© 2026 rajgoodman.com. All rights reserved. <a href="/terms-and-conditions/">Legal</a> · <a href="/privacy-policy/">Privacy</a></span><span>AI workshops for owners and leadership teams</span></div>' +
  '</div></footer>';

  document.body.insertAdjacentHTML('afterbegin', nav);
  document.body.insertAdjacentHTML('beforeend', footer);
})();
