/* ============================================================================
 * xmlFormatter.js
 * - Flatten XML into canonical, order-insensitive record strings
 * - Use with multiset comparison to diff records regardless of element order
 * - Exposes: window.XMLFmt.recordsToCanonicalStrings(xmlText, { recordSelector })
 * ========================================================================== */

(function (global) {
  var XMLFmt = {
    parseXml: parseXml,
    recordsToCanonicalStrings: recordsToCanonicalStrings
  };

  // --- Public: parse string -> XMLDocument (throws on error) ---
  function parseXml(xmlText) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(String(xmlText || ''), 'application/xml');
    var err = doc.querySelector('parsererror');
    if (err) {
      var msg = err.textContent || 'XML parse error';
      throw new Error(msg.replace(/\s+/g, ' ').trim());
    }
    return doc;
  }

  // --- Public: flatten each record element into a canonical string ---
  // Options:
  //   recordSelector: CSS selector for record elements (default 'Incident')
  //   includeText: include non-whitespace text nodes (default true)
  //   includeAttributes: include all attributes (default true)
  //   ignoreEmptyText: skip empty/whitespace-only text (default true)
  //   collapseInnerWhitespace: normalize inner whitespace in text to single space (default true)
  function recordsToCanonicalStrings(xmlText, opts) {
    opts = opts || {};
    var recordSelector = opts.recordSelector || 'Incident';
    var includeText = ('includeText' in opts) ? !!opts.includeText : true;
    var includeAttributes = ('includeAttributes' in opts) ? !!opts.includeAttributes : true;
    var ignoreEmptyText = ('ignoreEmptyText' in opts) ? !!opts.ignoreEmptyText : true;
    var collapseInnerWhitespace = ('collapseInnerWhitespace' in opts) ? !!opts.collapseInnerWhitespace : true;

    var doc = parseXml(xmlText);
    var records = Array.prototype.slice.call(doc.querySelectorAll(recordSelector));
    var out = [];

    for (var r = 0; r < records.length; r++) {
      var rec = records[r];
      var parts = [];

      // Collect attributes and subtree into "path=value" entries
      flattenNode(rec, '/' + rec.nodeName, parts, {
        includeText: includeText,
        includeAttributes: includeAttributes,
        ignoreEmptyText: ignoreEmptyText,
        collapseInnerWhitespace: collapseInnerWhitespace
      });

      // Sort parts for order-independence
      parts.sort();

      // Build canonical record string:
      // Prefix with the record element name and any direct attributes for readability.
      var headerAttrs = [];
      if (rec.attributes) {
        for (var i = 0; i < rec.attributes.length; i++) {
          var a = rec.attributes[i];
          headerAttrs.push(a.name + '=' + JSON.stringify(a.value));
        }
      }
      headerAttrs.sort();
      var header = '<' + rec.nodeName + (headerAttrs.length ? ' ' + headerAttrs.join(' ') : '') + '>';

      out.push(header + '|' + parts.join('|'));
    }

    return out;
  }

  // --- Internal: recursively flatten a node into path=value entries ---
  function flattenNode(node, path, out, opts) {
    // Attributes
    if (opts.includeAttributes && node.attributes && node.attributes.length) {
      var attrs = Array.prototype.slice.call(node.attributes).map(function (a) {
        return a.name;
      }).sort();
      for (var ai = 0; ai < attrs.length; ai++) {
        var name = attrs[ai];
        var val = node.getAttribute(name);
        out.push(path + '/@' + name + '=' + q(val));
      }
    }

    // Child nodes (elements + text)
    var children = node.childNodes ? Array.prototype.slice.call(node.childNodes) : [];
    for (var ci = 0; ci < children.length; ci++) {
      var c = children[ci];
      if (c.nodeType === 1) { // ELEMENT_NODE
        flattenNode(c, path + '/' + c.nodeName, out, opts);
      } else if (c.nodeType === 3 && opts.includeText) { // TEXT_NODE
        var t = String(c.nodeValue || '');
        if (opts.ignoreEmptyText && /^\s*$/.test(t)) continue;
        if (opts.collapseInnerWhitespace) t = t.replace(/\s+/g, ' ');
        t = t.trim();
        if (!(opts.ignoreEmptyText && t === '')) {
          out.push(path + '/#text=' + q(t));
        }
      }
    }
  }

  // Quote a value consistently
  function q(v) {
    return JSON.stringify(String(v == null ? '' : v));
  }

  // Expose
  global.XMLFmt = XMLFmt;

})(window);
