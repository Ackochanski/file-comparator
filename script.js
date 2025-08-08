function looksLikeXML(text) {
  const trimmed = text.trim();
  return trimmed.startsWith('<') && trimmed.endsWith('>');
}

function compare() {
  const raw1 = document.getElementById('input1').value;
  const raw2 = document.getElementById('input2').value;

  const formatted1 = looksLikeXML(raw1) ? normalizeXML(raw1) : raw1;
  const formatted2 = looksLikeXML(raw2) ? normalizeXML(raw2) : raw2;

  const text1 = formatted1.split('\n');
  const text2 = formatted2.split('\n');

  const resultDiv = document.getElementById('result');
  let output = '';

  const maxLength = Math.max(text1.length, text2.length);
  for (let i = 0; i < maxLength; i++) {
    const line1 = text1[i] || '';
    const line2 = text2[i] || '';
    if (line1 === line2) {
      output += `<div class="unchanged">${line1}</div>`;
    } else {
      if (line1) output += `<div class="removed">- ${line1}</div>`;
      if (line2) output += `<div class="added">+ ${line2}</div>`;
    }
  }

  resultDiv.innerHTML = output;
}
