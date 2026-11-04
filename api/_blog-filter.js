// Search box + author filter for the /blog/ listing. Filtering runs in the
// browser over the list the server already rendered, so every article stays in
// the HTML for crawlers and filtering needs no extra request. The author menu
// only appears once two or more authors have published posts: with a single
// author it would be a menu of one.

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// Attributes for one listing item: who wrote it, and the lower-cased text the
// search box matches against (title, excerpt, categories, author).
export function filterAttrs(p) {
  const text = [p.title, p.excerpt, ...(p.categories || []), p.author].filter(Boolean).join(' ').toLowerCase();
  return ` data-author="${esc(p.author || '')}" data-search="${esc(text)}"`;
}

export function authorsOf(posts) {
  return [...new Set(posts.map((p) => p.author).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

// Every word typed must appear (in any order). Matching items are marked
// revealed: the scroll-reveal only checks on scroll, and filtering moves items
// into view without one.
const SCRIPT = `<script>
(function () {
  var q = document.getElementById('bq'), who = document.getElementById('ba'), none = document.getElementById('bnone');
  var items = [].slice.call(document.querySelectorAll('[data-search]'));
  function run() {
    var words = (q.value || '').toLowerCase().split(/\\s+/).filter(Boolean), a = who ? who.value : '', shown = 0;
    items.forEach(function (el) {
      var s = el.getAttribute('data-search');
      var ok = words.every(function (w) { return s.indexOf(w) > -1; }) && (!a || el.getAttribute('data-author') === a);
      el.style.display = ok ? '' : 'none';
      if (ok) { shown++; el.classList.add('is-in'); }
    });
    none.hidden = shown > 0;
  }
  q.addEventListener('input', run);
  if (who) who.addEventListener('change', run);
})();
</script>`;

export function filterBar(posts) {
  if (!posts.length) return '';
  const authors = authorsOf(posts);
  const authorMenu = authors.length > 1
    ? `<select id="ba" aria-label="Filter by author"><option value="">All authors</option>${authors.map((a) => `<option value="${esc(a)}">${esc(a)}</option>`).join('')}</select>`
    : '';
  return `<style>
.bfilter{display:flex;flex-wrap:wrap;gap:12px;margin:0 0 26px;color-scheme:dark}
.bfilter input,.bfilter select{font:inherit;font-size:.95rem;color:var(--tx);background:transparent;border:1px solid var(--line);border-radius:6px;padding:.7rem 1rem;min-height:44px}
.bfilter input{flex:1 1 260px;min-width:0}
.bfilter select{flex:0 1 220px}
.bfilter input::placeholder{color:var(--tx-40)}
.bfilter input:focus,.bfilter select:focus{outline:none;border-color:var(--yellow)}
.bnone{color:var(--tx-60);margin:8px 0 0}
</style>
<div class="bfilter" role="search"><input id="bq" type="search" placeholder="Search articles" aria-label="Search articles" autocomplete="off" />${authorMenu}</div>`;
}

export function noMatches() {
  return `<p id="bnone" class="bnone" hidden>No articles match your search.</p>${SCRIPT}`;
}
