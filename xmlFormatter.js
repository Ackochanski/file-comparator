unction normalizeXML(xmlString) {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'application/xml');

    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
      return xmlString; // return original if parse failed
    }

    const serializer = new XMLSerializer();
    const rawString = serializer.serializeToString(xmlDoc);

    // Pretty print: insert new lines between tags
    const formatted = rawString.replace(/(>)(<)(\/?)/g, '$1\n$2$3');

    // Optional: indent based on tag depth
    const lines = formatted.split('\n');
    let indent = 0;
    return lines.map(line => {
      if (line.match(/^<\//)) indent--;
      const padded = '  '.repeat(Math.max(indent, 0)) + line;
      if (line.match(/^<[^!?][^>]*[^/]>/)) indent++;
      return padded;
    }).join('\n').trim();

  } catch (e) {
    return xmlString;
  }
}
