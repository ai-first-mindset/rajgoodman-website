// Search box, author filter and pagination for the /blog/ listing. Filtering runs in the
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

// Every word typed must appear (in any order). Matches are shown PER_PAGE at a
// time with numbered pages under the list; searching or changing the author
// goes back to page 1, and the page number is kept in ?page= so the back button
// and shared links land on the same page. Every article stays in the HTML (for
// crawlers, and for no-JS readers, who simply get the whole list). Shown items
// are marked revealed: the scroll-reveal only checks on scroll, and paging
// moves items into view without one.
export const PER_PAGE = 12;

const SCRIPT = `<script>
(function () {
  var PER = ${PER_PAGE};
  var q = document.getElementById('bq'), who = document.getElementById('ba'), none = document.getElementById('bnone'), pager = document.getElementById('bpager');
  var items = [].slice.call(document.querySelectorAll('[data-search]'));
  var hasUrl = typeof location !== 'undefined' && typeof history !== 'undefined' && history.replaceState;
  var page = hasUrl ? Math.max(1, parseInt(new URLSearchParams(location.search).get('page'), 10) || 1) : 1;
  function matching() {
    var words = (q.value || '').toLowerCase().split(/\\s+/).filter(Boolean), a = who ? who.value : '';
    return items.filter(function (el) {
      var s = el.getAttribute('data-search');
      return words.every(function (w) { return s.indexOf(w) > -1; }) && (!a || el.getAttribute('data-author') === a);
    });
  }
  // 1 … 4 5 6 … 12: first, last, and the current page's neighbours.
  function numbers(pages) {
    var out = [], last = 0;
    for (var n = 1; n <= pages; n++) {
      if (n === 1 || n === pages || Math.abs(n - page) <= 1) {
        if (last && n - last > 1) out.push('<span class="bgap">&hellip;</span>');
        out.push(n === page
          ? '<span class="bpg on" aria-current="page">' + n + '</span>'
          : '<button type="button" class="bpg" data-p="' + n + '" aria-label="Page ' + n + '">' + n + '</button>');
        last = n;
      }
    }
    return out.join('');
  }
  function render() {
    var shown = matching(), pages = Math.max(1, Math.ceil(shown.length / PER));
    if (page > pages) page = pages;
    var from = (page - 1) * PER, onPage = shown.slice(from, from + PER);
    items.forEach(function (el) { el.style.display = 'none'; });
    onPage.forEach(function (el) { el.style.display = ''; el.classList.add('is-in'); });
    none.hidden = shown.length > 0;
    if (pager) {
      pager.hidden = pages < 2;
      pager.innerHTML = pages < 2 ? '' :
        (page > 1 ? '<button type="button" class="bpg bstep" data-p="' + (page - 1) + '">&#8592; Previous</button>' : '') +
        numbers(pages) +
        (page < pages ? '<button type="button" class="bpg bstep" data-p="' + (page + 1) + '">Next &#8594;</button>' : '');
    }
    if (hasUrl) {
      var u = new URL(location.href);
      if (page > 1) u.searchParams.set('page', page); else u.searchParams.delete('page');
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    }
  }
  function reset() { page = 1; render(); }
  q.addEventListener('input', reset);
  if (who) who.addEventListener('change', reset);
  if (pager) pager.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-p]') : null;
    if (!b) return;
    page = parseInt(b.getAttribute('data-p'), 10);
    render();
    var top = document.querySelector('.bfilter');
    if (top && top.scrollIntoView) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  render();
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
.bpager{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:36px 0 0}
.bpg{font:inherit;font-family:var(--mono);font-size:.82rem;color:var(--tx-60);background:transparent;border:1px solid var(--line);border-radius:6px;min-width:44px;min-height:44px;padding:0 .9rem;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:border-color .2s,color .2s}
.bpg:hover,.bpg:focus-visible{border-color:var(--yellow);color:var(--yellow);outline:none}
.bpg.on{border-color:var(--yellow);color:var(--yellow);cursor:default}
.bgap{color:var(--tx-40);padding:0 4px}
</style>
<div class="bfilter" role="search"><input id="bq" type="search" placeholder="Search articles" aria-label="Search articles" autocomplete="off" />${authorMenu}</div>`;
}

export function noMatches() {
  return `<p id="bnone" class="bnone" hidden>No articles match your search.</p><nav id="bpager" class="bpager" aria-label="Blog pages" hidden></nav>${SCRIPT}`;
}
