// Pasting from Word: headings, lists, bold, links and tables carry over without
// Word's hidden markup, and alignment/spacing follow the site, not the document.
// The sample below has the shape Word puts on the clipboard (conditional
// comments, <o:p>, mso-list paragraphs with typed bullets, a table, an image
// that only exists on the writer's disk).
// Run: node --test 'tests/**/*.test.js'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const require = createRequire(import.meta.url);
const { cleanPastedHtml } = require('../admin/admin.js');
const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'admin', 'admin.js'), 'utf8');

const bullet = (level, ch, text) => `<p class=MsoListParagraphCxSpMiddle style='text-indent:-18.0pt;mso-list:l0 level${level} lfo1'><![if !supportLists]><span style='font-family:Symbol'><span style='mso-list:Ignore'>${ch}<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; </span></span></span><![endif]>${text}<o:p></o:p></p>`;
const numbered = (n, text) => `<p class=MsoListParagraphCxSpMiddle style='text-indent:-18.0pt;mso-list:l1 level1 lfo2'><![if !supportLists]><span><span style='mso-list:Ignore'>${n}.<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp; </span></span></span><![endif]>${text}<o:p></o:p></p>`;

const WORD = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta http-equiv=Content-Type content="text/html; charset=utf-8"><meta name=Generator content="Microsoft Word 15">
<style><!-- p.MsoNormal {margin:0cm; font-family:"Calibri"} --></style><!--[if gte mso 9]><xml><o:shapedefaults spidmax="1026" /></xml><![endif]--></head>
<body lang=EN-GB><!--StartFragment-->
<h1 style='margin-top:12pt'>Why AI pilots stall<o:p></o:p></h1>
<p class=MsoNormal style='text-align:justify;line-height:150%'>Most pilots <b>never</b> reach <i>production</i>. See <a href="https://example.com/report">the report</a>.<o:p></o:p></p>
<p class=MsoNormal><o:p>&nbsp;</o:p></p>
<h2>What teams need to learn<o:p></o:p></h2>
${bullet(1, '·', 'Prompting basics')}
${bullet(2, 'o', 'Writing clear instructions')}
${bullet(1, '·', 'Checking outputs')}
${numbered(1, 'Assess')}
${numbered(2, 'Train')}
<table class=MsoTableGrid border=1 cellspacing=0 cellpadding=0 style='border-collapse:collapse'>
 <tr><td width=301 valign=top style='width:225.4pt'><p class=MsoNormal><b>Role<o:p></o:p></b></p></td><td width=301 valign=top><p class=MsoNormal><b>Hours<o:p></o:p></b></p></td></tr>
 <tr><td width=301 valign=top><p class=MsoNormal>Plant manager<o:p></o:p></p></td><td width=301 valign=top><p class=MsoNormal>6<o:p></o:p></p></td></tr>
</table>
<p class=MsoNormal><img width=602 height=339 src="file:///C:/Users/writer/AppData/Local/Temp/msohtmlclip1/01/clip_image001.png"><o:p></o:p></p>
<!--EndFragment--></body></html>`;

const out = cleanPastedHtml(WORD);
const flat = out.replace(/\s+/g, ' ');

test('Word markup is removed: comments, <o:p>, styles, meta, conditional blocks', () => {
  for (const junk of ['<o:p', '<!--', '<![if', '<style', '<meta', '<xml', 'StartFragment', 'supportLists']) {
    assert.ok(!out.includes(junk), `${junk} must not survive the paste`);
  }
});

test('Word bullet paragraphs become a real nested list, numbered ones an ordered list', () => {
  assert.ok(flat.includes('<ul><li><p>Prompting basics</p><ul><li><p>Writing clear instructions</p></li></ul></li><li><p>Checking outputs</p></li></ul>'), flat);
  assert.ok(flat.includes('<ol><li><p>Assess</p></li><li><p>Train</p></li></ol>'), flat);
  assert.ok(!/[·]/.test(out), 'the typed bullet characters are gone');
});

test('headings shift so the top pasted level is H2 (the title is the only H1)', () => {
  assert.match(out, /<h2[^>]*>Why AI pilots stall<\/h2>/);
  assert.match(out, /<h3>What teams need to learn<\/h3>/);
  assert.ok(!/<h1/i.test(out));
});

test('bold, italic, links and tables carry over', () => {
  assert.match(out, /<b>never<\/b>/);
  assert.match(out, /<i>production<\/i>/);
  assert.match(out, /<a href="https:\/\/example\.com\/report">the report<\/a>/);
  assert.match(out, /<table\b[\s\S]*<td\b[^>]*><p class=MsoNormal><b>Role<\/b><\/p><\/td>[\s\S]*Plant manager[\s\S]*<\/table>/);
});

test('empty spacer paragraphs and images on the writer\'s disk are dropped', () => {
  assert.ok(!out.includes('file:///'), 'a file:// image would be broken for every reader');
  assert.ok(!/<p\b[^>]*>(\s|&nbsp;)*<\/p>/.test(out), 'no empty paragraphs');
});

test('non-Word HTML passes through, apart from the heading shift', () => {
  assert.equal(cleanPastedHtml('<h2>A</h2><p>b <strong>c</strong></p>'), '<h2>A</h2><p>b <strong>c</strong></p>');
  assert.equal(cleanPastedHtml('<h1>Title</h1><h2>Sub</h2>'), '<h2>Title</h2><h3>Sub</h3>');
  assert.equal(cleanPastedHtml(''), '');
});

test('the editor runs pasted HTML through the cleaner and accepts tables', () => {
  assert.match(SRC, /editorProps:\s*\{\s*transformPastedHTML:\s*cleanPastedHtml\s*\}/);
  assert.match(SRC, /\.\.\.tableNodes\(\),/);
});
