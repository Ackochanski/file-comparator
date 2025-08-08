function compare() {
  const text1 = document.getElementById('input1').value.split('\n');
  const text2 = document.getElementById('input2').value.split('\n');
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
