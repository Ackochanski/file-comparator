function normalizeXML(xmlString) {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'application/xml');
    const serializer = new XMLSerializer();
    const formatted = serializer.serializeToString(xmlDoc);
    return formatted.replace(/>\s+</g, '><')  // remove whitespace between tags
                    .replace(/\s{2,}/g, ' ')   // collapse multiple spaces
                    .trim();
  } catch (e) {
    return xmlString; // fallback if parse fails
  }
}
