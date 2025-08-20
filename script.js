/* ============================================================================
 * File Comparator - script.js (compat version + XML record multiset)
 * - Order-insensitive (multiset) compare with duplicate preservation
 * - XML-aware multiset: compares whole <Incident> records (if XMLFmt is loaded)
 * - Order-sensitive unified diff (LCS-based) fallback
 * - No optional chaining (?.) and no String.replaceAll for older browsers
 * ========================================================================== */

/* ------------------------------ Utilities -------------------------------- */

function byId(id) { return document.getElementById(id); }

function safeChecked(id, fallback) {
  var el = byId(id);
  return el && typeof el.checked === 'boolean' ? el.checked : !!fallback;
}

function getInputTexts() {
  var aEl = byId('inputA') || byId('fileA');
  var bEl = byId('inputB') || byId('fileB');
  var a = aEl ? (aEl.value || '') : '';
  var b = bEl ? (bEl.value || '') : '';
  return [a, b];
}

function optsFromUI() {
  return {
    trim: safeChecked('trimTrailing', true),
    collapseWhitespace: safeChecked('collapseWS', false),
    caseSensitive: safeChecked('caseSensitive', true)
  };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
}

/* ---------------------- Canonicalization & Bags -------------------------- */

function canonicalizeRow(s, opts) {
  opts = opts || {};
  var trim = opts.trim !== false; // default true
  var collapseWhitespace = !!opts.collapseWhitespace;
  var caseSensitive = !!opts.caseSensitive;

  var out = String(s == null ? '' : s).replace(/\r\n?/g, '\n'); // normalize newlines
  if (trim) out = out.replace(/[ \t]+$/g, '');      // trim trailing spaces only
  if (collapseWhitespace) out = out.replace(/[ \t]+/g, ' ');
  if (!caseSensitive) out = out.toLowerCase();
  return out;
}

function toBag(strings, opts) {
  var bag = new Map();
  for (var i=0; i<strings.length; i++) {
    var k = canonicalizeRow(strings[i], opts);
    bag.set(k, (bag.get(k) || 0) + 1);
  }
  return bag;
}

function diffBags(bagA, bagB) {
  var keys = new Set([].concat(Array.from(bagA.keys()), Array.from(bagB.keys())));
  var onlyInA = [];
  var onlyInB = [];
  var freqDelta = [];
  keys.forEach(function(k){
    var a = bagA.get(k) || 0;
    var b = bagB.get(k) || 0;
    if (a && !b) onlyInA.push({ value: k, count: a });
    else if (!a && b) onlyInB.push({ value: k, count: b });
    else if (a !== b) freqDelta.push({ value: k, a: a, b: b, delta: a - b });
  });
  onlyInA.sort(function(x,y){ return x.value.localeCompare(y.value); });
  onlyInB.sort(function(x,y){ return x.value.localeCompare(y.value); });
  freqDelta.sort(function(x,y){
    var d = Math.abs(y.delta) - Math.abs(x.delta);
    return d !== 0 ? d : x.value.localeCompare(y.value);
  });
  return { onlyInA: onlyInA, onlyInB: onlyInB, freqDelta: freqDelta };
}

/* ---------------------- Multiset (order-insensitive) --------------------- */

function compareTextAsMultisets(textA, textB, opts) {
  function split(t){ return String(t == null ? '' : t).split(/\r?\n/); }
  function prune(arr){ return (arr.length && arr[arr.length-1] === '') ? arr.slice(0, -1) : arr; }

  var A = prune(split(textA));
  var B = prune(split(textB));
  var bagA = toBag(A, opts);
  var bagB = toBag(B, opts);
  var diff = diffBags(bagA, bagB);
  return {
    summary: {
      totalA: A.length, totalB: B.length,
      uniqueA: bagA.size, uniqueB: bagB.size,
      onlyInA: diff.onlyInA.length, onlyInB: diff.onlyInB.length,
      freqDelta: diff.freqDelta.length,
      identical: diff.onlyInA.length === 0 && diff.onlyInB.length === 0 && diff.freqDelta.length === 0
    },
    details: diff
  };
}

function renderMultisetReport(result) {
  var summaryEl = byId('summary'); var detailsEl = byId('details');
  if (!summaryEl || !detailsEl) return;
  var s = result.summary;
  summaryEl.innerHTML = ''
    + '<strong>Summary</strong>'
    + '<div>Total A: ' + s.totalA + ' · Total B: ' + s.totalB + '</div>'
    + '<div>Unique A: ' + s.uniqueA + ' · Unique B: ' + s.uniqueB + '</div>'
    + '<div>Only-in-A: ' + s.onlyInA + ' · Only-in-B: ' + s.onlyInB + ' · Count mismatches: ' + s.freqDelta + '</div>'
    + '<div>Status: <span class="' + (s.identical ? 'status-ok' : 'status-bad') + '">'
    + (s.identical ? '✅ Identical as multisets' : '❌ Differences found')
    + '</span></div>';

  function list(arr, head) {
    var html = '<h3>' + head + ' (' + arr.length + ')</h3><ul>';
    for (var i=0; i<Math.min(arr.length, 200); i++) {
      var e = arr[i];
      html += '<li><code>' + escapeHtml(e.value) + '</code> × ' + (e.count != null ? e.count : (e.a + e.b)) + '</li>';
    }
    html += '</ul>';
    if (arr.length > 200) html += '<em>Showing first 200…</em>';
    return html;
  }

  var freqRows = '';
  var fr = result.details.freqDelta;
  for (var i=0; i<Math.min(fr.length, 500); i++) {
    var e = fr[i];
    freqRows += '<tr>'
      + '<td><code>' + escapeHtml(e.value) + '</code></td>'
      + '<td>' + e.a + '</td><td>' + e.b + '</td>'
      + '<td>' + (e.delta > 0 ? ('+' + e.delta) : e.delta) + '</td>'
      + '</tr>';
  }

  detailsEl.innerHTML = ''
    + list(result.details.onlyInA, 'Only in A')
    + list(result.details.onlyInB, 'Only in B')
    + '<h3>Count mismatches (' + fr.length + ')</h3>'
    + '<table class="freq-table">'
    + '  <thead><tr><th>Row</th><th>A</th><th>B</th><th>Δ</th></tr></thead>'
    + '  <tbody>' + freqRows + '</tbody>'
    + '</table>';
}

/* ---------------------- XML record-level multiset ------------------------ */

function looksLikeXml(text) {
  return /^\s*<[^>]+>/.test(String(text == null ? '' : text));
}

// Uses window.XMLFmt.recordsToCanonicalStrings if available; falls back to line-based.
function compareXmlRecordsAsMultisets(xmlA, xmlB, options) {
  try {
    if (window && window.XMLFmt && typeof window.XMLFmt.recordsToCanonicalStrings === 'function') {
      var recA = window.XMLFmt.recordsToCanonicalStrings(xmlA, options || { recordSelector: 'Incident' });
      var recB = window.XMLFmt.recordsToCanonicalStrings(xmlB, options || { recordSelector: 'Incident' });
      var bagA = toBag(recA, { trim: true, collapseWhitespace: false, caseSensitive: true });
      var bagB = toBag(recB, { trim: true, collapseWhitespace: false, caseSensitive: true });
      var diff = diffBags(bagA, bagB);
      return {
        summary: {
          totalA: recA.length,
          totalB: recB.length,
          uniqueA: bagA.size,
          uniqueB: bagB.size,
          onlyInA: diff.onlyInA.length,
          onlyInB: diff.onlyInB.length,
          freqDelta: diff.freqDelta.length,
          identical: diff.onlyInA.length === 0 && diff.onlyInB.length === 0 && diff.freqDelta.length === 0
        },
        details: diff
      };
    } else {
      // No XML formatter loaded; degrade gracefully
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('XMLFmt not found; using line-based multiset for XML.');
      }
      return compareTextAsMultisets(xmlA, xmlB, { trim: true });
    }
  } catch (e) {
    if (typeof console !== 'undefined' && console.error) {
      console.error('XML compare error; falling back to line-based:', e);
    }
    return compareTextAsMultisets(xmlA, xmlB, { trim: true });
  }
}

/* ---------------------- Order-sensitive diff (LCS) ----------------------- */

function lcs(a, b) {
  var n = a.length, m = b.length;
  var dp = Array(n+1); for (var i=0;i<=n;i++){ dp[i] = Array(m+1).fill(0); }
  for (var i2=1;i2<=n;i2++){
    for (var j2=1;j2<=m;j2++){
      if (a[i2-1] === b[j2-1]) dp[i2][j2] = dp[i2-1][j2-1]+1;
      else dp[i2][j2] = Math.max(dp[i2-1][j2], dp[i2][j2-1]);
    }
  }
  var seq = [];
  var i3=n, j3=m;
  while (i3>0 && j3>0) {
    if (a[i3-1] === b[j3-1]) { seq.push(a[i3-1]); i3--; j3--; }
    else if (dp[i3-1][j3] >= dp[i3][j3-1]) i3--;
    else j3--;
  }
  return seq.reverse();
}

function unifiedDiff(aText, bText, opts) {
  opts = opts || {};
  var A = String(aText == null ? '' : aText).replace(/\r\n?/g, '\n').split('\n');
  var B = String(bText == null ? '' : bText).replace(/\r\n?/g, '\n').split('\n');
  if (A.length && A[A.length-1]==='') A.pop();
  if (B.length && B[B.length-1]==='') B.pop();

  var common = lcs(A, B);
  var i=0, j=0, k=0;
  var hunks = [];
  var cur = null;

  function pushCur() {
    if (!cur) return;
    hunks.push(cur);
    cur = null;
  }
  function startHunk(ai, bi) { cur = { aStart: ai+1, bStart: bi+1, lines: [] }; }

  while (i < A.length || j < B.length) {
    if (k < common.length && i < A.length && j < B.length && A[i] === common[k] && B[j] === common[k]) {
      if (cur) { cur.lines.push(' ' + A[i]); }
      i++; j++; k++;
    } else {
      if (!cur) startHunk(i, j);
      if (j < B.length && (k >= common.length || B[j] !== common[k])) { cur.lines.push('+' + B[j]); j++; continue; }
      if (i < A.length && (k >= common.length || A[i] !== common[k])) { cur.lines.push('-' + A[i]); i++; continue; }
    }
  }
  if (cur) pushCur();

  var header = '--- A\n+++ B\n';
  var body = hunks.map(function(h){
    var aCount = h.lines.filter(function(l){ return l.charAt(0) !== '+'; }).length;
    var bCount = h.lines.filter(function(l){ return l.charAt(0) !== '-'; }).length;
    var hHeader = '@@ -' + h.aStart + ',' + aCount + ' +' + h.bStart + ',' + bCount + ' @@';
    return [hHeader].concat(h.lines.map(escapeHtml)).join('\n');
  }).join('\n');

  return header + body;
}

function renderOrderSensitive(aText, bText) {
  var summaryEl = byId('summary'); var detailsEl = byId('details');
  if (!summaryEl || !detailsEl) return;

  var A = String(aText == null ? '' : aText).split(/\r?\n/);
  var B = String(bText == null ? '' : bText).split(/\r?\n/);
  var identical = String(aText == null ? '' : aText).replace(/\r\n?/g,'\n') === String(bText == null ? '' : bText).replace(/\r\n?/g,'\n');

  summaryEl.innerHTML = ''
    + '<strong>Summary</strong>'
    + '<div>Total A: ' + (A[A.length-1]===''?A.length-1:A.length) + ' · Total B: ' + (B[B.length-1]===''?B.length-1:B.length) + '</div>'
    + '<div>Status: <span class="' + (identical ? 'status-ok' : 'status-bad') + '">'
    + (identical ? '✅ Identical (order-sensitive)' : '❌ Differences found')
    + '</span></div>';

  if (identical) {
    detailsEl.innerHTML = '<em>No differences.</em>';
    return;
  }

  var diff = unifiedDiff(aText, bText, { context: 3 });
  detailsEl.innerHTML = ''
    + '<h3>Unified diff</h3>'
    + '<pre class="diff"><code>' + diff + '</code></pre>'
    + '<p style="margin-top:8px"><small>Tip: For a shell check, sort both files first: <code>LC_ALL=C sort A &amp;&amp; LC_ALL=C sort B</code></small></p>';
}

/* --------------------------- Event wiring -------------------------------- */

function runComparison() {
  var pair = getInputTexts();
  var a = pair[0], b = pair[1];
  var ignoreOrder = safeChecked('ignoreOrderToggle', false);

  if (ignoreOrder) {
    // If both inputs look like XML, and XMLFmt is present, compare records; else line-based.
    if (looksLikeXml(a) && looksLikeXml(b)) {
      var resultXml = compareXmlRecordsAsMultisets(a, b, { recordSelector: 'Incident' });
      renderMultisetReport(resultXml);
    } else {
      var resultTxt = compareTextAsMultisets(a, b, optsFromUI());
      renderMultisetReport(resultTxt);
    }
  } else {
    renderOrderSensitive(a, b);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  try {
    var btn = byId('compareBtn');
    if (!btn) {
      if (typeof console !== 'undefined' && console.error) {
        console.error('Compare button (#compareBtn) not found.');
      }
      return;
    }
    // Capture-phase: if Ignore Order is ON, prevent other listeners and handle here
    btn.addEventListener('click', function(ev){
      if (safeChecked('ignoreOrderToggle', false)) {
        ev.stopImmediatePropagation();
        ev.preventDefault();
        runComparison();
      }
    }, true);

    // Bubble phase: if toggle is OFF, handle here
    btn.addEventListener('click', function(ev){
      if (!safeChecked('ignoreOrderToggle', false)) {
        ev.preventDefault();
        runComparison();
      }
    });
  } catch (e) {
    if (typeof console !== 'undefined' && console.error) {
      console.error('Error wiring compare button:', e);
    }
  }

  // Optional: Ctrl/Cmd + Enter triggers compare
  var aEl = byId('inputA'); var bEl = byId('inputB');
  [aEl, bEl].forEach(function(el){
    if (!el) return;
    el.addEventListener('keydown', function(e){
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        runComparison();
      }
    });
  });
});
