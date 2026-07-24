/* Page-builder block editing UI (classic script, loaded before admin.js).
   Exposes window.BLOCKS_UI: block-type metadata, a factory for new blocks, and
   a form builder that renders the editable fields for a block. Field forms
   mutate the block object in place, so the page builder just reads the blocks
   array back on save. The field names here must stay a subset of BLOCK_TYPES in
   api/_blocks.js — a test (tests/blocks-drift.test.js) enforces that. */
(function () {
  var TYPES = {
    'rich-text': { label: 'Rich text', fields: ['html'] },
    'section-heading': { label: 'Section heading', fields: ['idx', 'kicker', 'heading', 'showLine'] },
    cta: { label: 'Call to action', fields: ['idx', 'kicker', 'heading', 'text', 'label', 'url'] },
    faq: { label: 'FAQ accordion', fields: ['idx', 'kicker', 'heading', 'items'] },
    'raw-html': { label: 'Raw HTML', fields: ['html'] },
  };

  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (html != null) e.innerHTML = html;
    return e;
  }
  function field(label, input) {
    var w = el('div', { class: 'fld' });
    w.appendChild(el('label', null, label));
    w.appendChild(input);
    return w;
  }
  function textInput(val, oninput, ph) {
    var i = el('input');
    i.value = val || '';
    if (ph) i.placeholder = ph;
    i.addEventListener('input', function () { oninput(i.value); });
    return i;
  }
  function textArea(val, oninput, rows, ph) {
    var t = el('textarea');
    if (rows) t.rows = rows;
    if (ph) t.placeholder = ph;
    t.value = val || '';
    t.addEventListener('input', function () { oninput(t.value); });
    return t;
  }

  function make(type) {
    var id = 'b_' + Math.random().toString(36).slice(2, 9);
    switch (type) {
      case 'faq': return { type: 'faq', id: id, idx: '', kicker: 'FAQs', heading: 'Questions, answered', items: [{ question: '', answer_html: '', open: true }] };
      case 'section-heading': return { type: 'section-heading', id: id, idx: '', kicker: '', heading: '', showLine: true };
      case 'cta': return { type: 'cta', id: id, idx: '', kicker: '', heading: '', text: '', label: '', url: '' };
      case 'rich-text': return { type: 'rich-text', id: id, html: '' };
      default: return { type: 'raw-html', id: id, html: '' };
    }
  }

  function buildFaqItems(block) {
    if (!Array.isArray(block.items)) block.items = [];
    var box = el('div', { class: 'faq-items' });
    function redraw() {
      box.innerHTML = '';
      block.items.forEach(function (it, i) {
        var row = el('div', { class: 'card', style: 'padding:12px;margin:8px 0' });
        row.appendChild(field('Question', textInput(it.question, function (v) { it.question = v; }, 'Question')));
        row.appendChild(field('Answer', textArea(it.answer_html, function (v) { it.answer_html = v; }, 3, 'Answer (HTML allowed)')));
        var ctrls = el('div', { class: 'actions', style: 'margin-top:6px;align-items:center' });
        var openLbl = el('label', { style: 'display:flex;align-items:center;gap:6px;font-weight:600;margin:0' });
        var openR = el('input'); openR.type = 'radio'; openR.name = 'faqopen_' + block.id; openR.checked = !!it.open; openR.style.width = 'auto';
        openR.addEventListener('change', function () { block.items.forEach(function (x) { x.open = false; }); it.open = true; });
        openLbl.appendChild(openR); openLbl.appendChild(document.createTextNode('Open by default'));
        ctrls.appendChild(openLbl);
        var up = el('button', { type: 'button' }, '&uarr;'); up.addEventListener('click', function () { if (i > 0) { var t = block.items[i - 1]; block.items[i - 1] = it; block.items[i] = t; redraw(); } });
        var dn = el('button', { type: 'button' }, '&darr;'); dn.addEventListener('click', function () { if (i < block.items.length - 1) { var t = block.items[i + 1]; block.items[i + 1] = it; block.items[i] = t; redraw(); } });
        var del = el('button', { type: 'button', class: 'danger' }, 'Remove'); del.addEventListener('click', function () { block.items.splice(i, 1); if (!block.items.length) block.items.push({ question: '', answer_html: '', open: true }); redraw(); });
        ctrls.appendChild(up); ctrls.appendChild(dn); ctrls.appendChild(del);
        row.appendChild(ctrls);
        box.appendChild(row);
      });
      var add = el('button', { type: 'button' }, '+ Add item');
      add.addEventListener('click', function () { block.items.push({ question: '', answer_html: '', open: false }); redraw(); });
      box.appendChild(add);
    }
    redraw();
    return box;
  }

  // Build the editable field form for a block (mutates the block in place).
  function buildForm(block) {
    var wrap = el('div', { class: 'block-fields' });
    var t = block.type;
    if (t === 'raw-html' || t === 'rich-text') {
      wrap.appendChild(field(t === 'raw-html' ? 'HTML (verbatim)' : 'Content (HTML)', textArea(block.html, function (v) { block.html = v; }, 8)));
    }
    if (t === 'section-heading' || t === 'cta' || t === 'faq') {
      var row = el('div', { class: 'row2' });
      row.appendChild(field('Index label', textInput(block.idx, function (v) { block.idx = v; }, 'e.g. [ 01 ]')));
      row.appendChild(field('Kicker', textInput(block.kicker, function (v) { block.kicker = v; })));
      wrap.appendChild(row);
      wrap.appendChild(field('Heading', textInput(block.heading, function (v) { block.heading = v; })));
    }
    if (t === 'cta') {
      wrap.appendChild(field('Sub text', textArea(block.text, function (v) { block.text = v; }, 2)));
      var row2 = el('div', { class: 'row2' });
      row2.appendChild(field('Button label', textInput(block.label, function (v) { block.label = v; })));
      row2.appendChild(field('Button URL', textInput(block.url, function (v) { block.url = v; })));
      wrap.appendChild(row2);
    }
    if (t === 'faq') wrap.appendChild(buildFaqItems(block));
    return wrap;
  }

  window.BLOCKS_UI = {
    TYPES: TYPES,
    make: make,
    buildForm: buildForm,
    label: function (t) { return (TYPES[t] || {}).label || t; },
  };
})();
