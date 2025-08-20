/* ============================================================================
 * File Comparator - Full script.js
 * - Order-insensitive (multiset) compare with duplicate preservation
 * - Order-sensitive unified diff (LCS-based) fallback
 * - Expects DOM elements:
 *     #inputA, #inputB (textareas)
 *     #compareBtn (button)
 *     #ignoreOrderToggle, #trimTrailing, #collapseWS, #caseSensitive (checkboxes)
 *     #summary, #details (result containers)
 * ========================================================================== */

/* ------------------------------ Utilities -------------------------------- */

function byId(id) { return document.getElementById(id); }

function getInputTexts() {
  const aEl = byId('inputA') || byId('fileA');
  const bEl = byId('inputB') || byId('fileB');
  const a = aEl ? (aEl.value ?? '') : '';
  const b = bEl ? (bEl.value ?? '') : '';
  return [a, b];
}

function optsFromUI() {
  return {
    trim: byId('trimTrailing')?.checked ?? true,
    collapseWhitespace: byId('collapseWS')?.checked ?? false,
    caseSensitive: byId('caseSensitive')?.checked ?? true
  };
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;');
}

/* ---------------------- Canonicalization & Bags -------------------------- */

function canonicalizeRow(s, { trim = true, collapseWhitespace = false, caseSensitive = true } = {}) {
  let out = String(s ?? '').replace(/\r\n?/g, '\n'); // normalize newlines
  if (trim) out = out.replace(/[ \t]+$/g, '');      // trim trailing spaces only (keep leading)
  if (collapseWhitespace) out = out.replace(/[ \t]+/g, ' ');
  if (!caseSensitive) out = out.toLowerCase();
  return out;
}

function toBag(strings, opts) {
  const bag = new Map();
  for (const s of strings) {
    const k = canonicalizeRow(s, opts);
    bag.set(k, (bag.get(k) || 0) + 1);
  }
  return bag;
}

function diffBags(bagA, bagB) {
  const keys = new Set([...bagA.keys(), ...bagB.keys()]);
  const onlyInA = [];
  const onlyInB = [];
  const freqDelta = [];
  for (const k of keys) {
    const a = bagA.get(k) || 0;
    const b = bagB.get(k) || 0;
    if (a && !b) onlyInA.push({ value: k, count: a });
    else if (!a && b) onlyInB.push({ value: k, count: b });
    else if (a !== b) freqDelta.push({ value: k, a, b, delta: a - b });
  }
  // Stable sorting for display
  onlyInA.sort((x,y)=>x.value.localeCompare(y.value));
  onlyInB.sort((x,y)=>x.value.localeCompare(y.value));
  freqDelta.sort((x,y)=>Math.sign(Math.abs(y.delta)-Math.abs(x.delta)) || x.value.localeCompare(y.value));
  return { onlyInA, onlyInB, freqDelta };
}

/* ---------------------- Multiset (order-insensitive) --------------------- */

function compareTextAsMultisets(textA, textB, opts) {
  const split = (t) => String(t ?? '').split(/\r?\n/);
  const prune = (arr) => (arr.length && arr[arr.length-1] === '' ? arr.slice(0, -1) : arr);
  const A = prune(split(textA));
  const B = prune(split(textB));
  const bagA = toBag(A, opts);
  const bagB = toBag(B, opts);
  const diff = diffBags(bagA, bagB);
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

function renderMultisetReport({ summary, details }) {
  const summaryEl = byId('summary'); const detailsEl = byId('details');
  if (!summaryEl || !detailsEl) return;
  const s = summary;
  summaryEl.innerHTML = `
    <strong>Summary</strong>
    <div>Total A: ${s.totalA} · Total B: ${s.totalB}</div>
    <div>Unique A: ${s.uniqueA} · Unique B: ${s.uniqueB}</div>
    <div>Only-in-A: ${s.onlyInA} · Only-in-B: ${s.onlyInB} · Count mismatches: ${s.freqDelta}</div>
    <div>Status: <span class="${s.identical ? 'status-ok' : 'status-bad'}">
      ${s.identical ? '✅ Identical as multisets' : '❌ Differences found'}
    </span></div>
  `;

  const list = (arr, head) => `
    <h3>${head} (${arr.length})</h3>
    <ul>${arr.slice(0, 200).map(e => `<li><code>${escapeHtml(e.value)}</code> × ${e.count ?? (e.a + e.b)}</li>`).join('')}</ul>
    ${arr.length > 200 ? '<em>Showing first 200…</em>' : ''}
  `;

  detailsEl.innerHTML = `
    ${list(details.onlyInA, 'Only in A')}
    ${list(details.onlyInB, 'Only in B')}
    <h3>Count mismatches (${details.freqDelta.length})</h3>
    <table class="freq-table">
      <thead><tr><th>Row</th><th>A</th><th>B</th><th>Δ</th></tr></thead>
      <tbody>
        ${details.freqDelta.slice(0, 500).map(e => `
          <tr>
            <td><code>${escapeHtml(e.value)}</code></td>
            <td>${e.a}</td><td>${e.b}</td>
            <td>${e.delta > 0 ? '+'+e.delta : e.delta}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

/* ---------------------- Order-sensitive diff (LCS) ----------------------- */
/* Simple unified diff-ish output for when Ignore Order is OFF */

function lcs(a, b) {
  const n = a.length, m = b.length;
  const dp = Array(n+1).fill(null).map(()=>Array(m+1).fill(0));
  for (let i=1;i<=n;i++){
    for (let j=1;j<=m;j++){
      if (a[i-1] === b[j-1]) dp[i][j] = dp[i-1][j-1]+1;
      else dp[i][j] = Math.max(dp[i-1][j], dp[i][j-1]);
    }
  }
  // backtrack
  const seq = [];
  let i=n, j=m;
  while (i>0 && j>0) {
    if (a[i-1] === b[j-1]) { seq.push(a[i-1]); i--; j--; }
    else if (dp[i-1][j] >= dp[i][j-1]) i--;
    else j--;
  }
  return seq.reverse();
}

function unifiedDiff(aText, bText, { context = 3 } = {}) {
  const A = String(aText ?? '').replace(/\r\n?/g, '\n').split('\n');
  const B = String(bText ?? '').replace(/\r\n?/g, '\n').split('\n');
  // Remove trailing empty line alignment
  if (A.length && A[A.length-1]==='') A.pop();
  if (B.length && B[B.length-1]==='') B.pop();

  const common = lcs(A, B);
  let i=0, j=0, k=0;
  const hunks = [];
  let cur = null;

  function pushCur() {
    if (!cur) return;
    // collapse leading/trailing context to 'context' lines
    const lines = cur.lines;
    // trim internal representation already contextualized; keep as-is
    hunks.push(cur);
    cur = null;
  }

  function startHunk(ai, bi) {
    cur = { aStart: ai+1, bStart: bi+1, lines: [] };
  }

  while (i < A.length || j < B.length) {
    if (k < common.length && i < A.length && j < B.length && A[i] === common[k] && B[j] === common[k]) {
      // context
      if (cur) {
        cur.lines.push(' ' + A[i]);
        // If context exceeds, consider splitting hunks; we keep simple and let it accumulate.
      }
      i++; j++; k++;
    } else {
      // difference area: start hunk if needed
      if (!cur) startHunk(i, j);
      // consume removes and adds until we realign on next common line (or end)
      if (j < B.length && (k >= common.length || B[j] !== common[k])) {
        cur.lines.push('+' + B[j]); j++;
        continue;
      }
      if (i < A.length && (k >= common.length || A[i] !== common[k])) {
        cur.lines.push('-' + A[i]); i++;
        continue;
      }
    }
    // If we have a hunk and next line is common but we have enough trailing context, close it
    if (cur && (k >= common.length || (i < A.length && j < B.length && A[i] === common[k] && B[j] === common[k]))) {
      // keep some context lines around differences (already included as ' ' lines)
      // We close hunks lazily at the end or when a big gap occurs; simplicity over perfect headers.
    }
  }
  if (cur) pushCur();

  // Build unified diff text
  const header = `--- A\n+++ B\n`;
  const body = hunks.map(h => {
    const aCount = h.lines.filter(l=>l[0] !== '+').length;
    const bCount = h.lines.filter(l=>l[0] !== '-').length;
    const hHeader = `@@ -${h.aStart},${aCount} +${h.bStart},${bCount} @@`;
    return [hHeader, ...h.lines.map(escapeHtml)].join('\n');
  }).join('\n');

  return header + body;
}

function renderOrderSensitive(aText, bText) {
  const summaryEl = byId('summary'); const detailsEl = byId('details');
  if (!summaryEl || !detailsEl) return;

  const A = String(aText ?? '').split(/\r?\n/);
  const B = String(bText ?? '').split(/\r?\n/);
  // naive quick identical check
  const identical = aText.replace(/\r\n?/g,'\n') === bText.replace(/\r\n?/g,'\n');

  summaryEl.innerHTML = `
    <strong>Summary</strong>
    <div>Total A: ${A[A.length-1]===''?A.length-1:A.length} · Total B: ${B[B.length-1]===''?B.length-1:B.length}</div>
    <div>Status: <span class="${identical ? 'status-ok' : 'status-bad'}">
      ${identical ? '✅ Identical (order-sensitive)' : '❌ Differences found'}
    </span></div>
  `;

  if (identical) {
    detailsEl.innerHTML = '<em>No differences.</em>';
    return;
  }

  const diff = unifiedDiff(aText, bText, { context: 3 });
  detailsEl.innerHTML = `
    <h3>Unified diff</h3>
    <pre class="diff"><code>${diff}</code></pre>
    <p style="margin-top:8px"><small>Tip: For a shell check, run <code>diff -u &lt;(printf %s "${'${A}'.replace(/"/g,'\\"')}") &lt;(printf %s "${'${B}'.replace(/"/g,'\\"')}")</code></small></p>
  `;
}

/* --------------------------- Event wiring -------------------------------- */

function runComparison() {
  const [a, b] = getInputTexts();
  const ignoreOrder = byId('ignoreOrderToggle')?.checked;
  if (ignoreOrder) {
    const result = compareTextAsMultisets(a, b, optsFromUI());
    renderMultisetReport(result);
  } else {
    renderOrderSensitive(a, b);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = byId('compareBtn');
  if (btn) {
    // Capture-phase interceptor: if Ignore Order is ON, avoid other listeners
    btn.addEventListener('click', (ev) => {
      const toggle = byId('ignoreOrderToggle');
      if (toggle && toggle.checked) {
        ev.stopImmediatePropagation();
        ev.preventDefault();
        runComparison();
      }
    }, { capture: true });

    // Normal bubble listener (works when toggle is off, or as fallback)
    btn.addEventListener('click', (ev) => {
      // If toggle is on, capture listener already handled it.
      if (!(byId('ignoreOrderToggle')?.checked)) {
        ev.preventDefault();
        runComparison();
      }
    });
  }

  // Optional: Ctrl+Enter to compare
  const aEl = byId('inputA'); const bEl = byId('inputB');
  [aEl, bEl].forEach(el => {
    if (!el) return;
    el.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        runComparison();
      }
    });
  });
});
