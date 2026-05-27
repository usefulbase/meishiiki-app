// Lightweight fixes loaded after script.js
(function(){
  function fixedPatternName(index){
    return `処方案${String.fromCharCode(65 + index)}`;
  }

  function isDefaultPatternName(name){
    return /^処方案[A-C]$/.test(name || "");
  }

  function ensurePatternOrderNames(){
    if (!Array.isArray(prescriptionPatterns)) return;
    for (let i = 0; i < 3; i++) {
      if (!prescriptionPatterns[i]) prescriptionPatterns[i] = defaultPattern(i);
      if (!prescriptionPatterns[i].name || isDefaultPatternName(prescriptionPatterns[i].name)) {
        prescriptionPatterns[i].name = fixedPatternName(i);
      }
    }
  }

  function displayPatternName(index){
    const p = prescriptionPatterns[index];
    return p && p.name ? p.name : fixedPatternName(index);
  }

  window.updatePatternTabs = updatePatternTabs = function(){
    ensurePatternOrderNames();
    for (let i = 0; i < 3; i++) {
      const btn = document.getElementById(`patternTab${i}`);
      if (!btn) continue;
      btn.textContent = displayPatternName(i);
      btn.classList.toggle("active", i === activePatternIndex);
      btn.classList.toggle("hidden", i >= activePatternCount);
    }
    const label = document.getElementById("activePatternLabel");
    if (label) label.textContent = displayPatternName(activePatternIndex);
    const addBtn = document.getElementById("addPatternBtn");
    const removeBtn = document.getElementById("removePatternBtn");
    if (addBtn) addBtn.disabled = activePatternCount >= 3;
    if (removeBtn) removeBtn.disabled = activePatternCount <= 1;
  };

  window.addPattern = addPattern = function(){
    saveActivePattern();
    if (activePatternCount >= 3) return;
    activePatternCount++;
    ensurePatternOrderNames();
    activePatternIndex = activePatternCount - 1;
    loadPattern(activePatternIndex);
    updatePatternTabs();
    updateDisabledStates();
    calculate(false);
  };

  window.removeActivePattern = removeActivePattern = function(){
    if (activePatternCount <= 1) return;
    saveActivePattern();
    prescriptionPatterns.splice(activePatternIndex, 1);
    prescriptionPatterns.push(defaultPattern(2));
    activePatternCount--;
    activePatternIndex = Math.min(activePatternIndex, activePatternCount - 1);
    ensurePatternOrderNames();
    loadPattern(activePatternIndex);
    updatePatternTabs();
    updateDisabledStates();
    calculate(false);
  };

  window.makeEyeResult = makeEyeResult = function(eyeData, lensType, accommodation, addPower, fpRate){
    const zones = enrichZones(getZones(lensType, eyeData.baseRelative, addPower, fpRate), accommodation);
    let html = `<div class="eye-result"><div class="eye-title">👁 ${eyeData.eye === "R" ? "右眼 R" : "左眼 L"}</div><div class="result-flex">${drawLensDiagram(lensType, zones)}</div>${rangeCards(zones)}<div class="summary-box">${conditionRows(lensType, eyeData, accommodation, addPower, fpRate)}</div><div class="table-wrap"><table><thead><tr><th>レンズ種別</th><th>部分</th><th>完全矯正との差</th><th>遠点</th><th>近点</th><th>明視域</th></tr></thead><tbody>`;
    zones.forEach(zone => {
      html += `<tr><td>${zone.lens}</td><td><span class="badge">${zone.part}</span></td><td>${formatPower(zone.relative)}</td><td>${zone.farText}</td><td>${zone.nearText}</td><td class="big-result">${zone.range.message ? `<span class="warning">${zone.range.message}</span>` : zone.rangeText}</td></tr>`;
    });
    html += `</tbody></table></div></div>`;
    return html;
  };

  window.calculate = calculate = function(manual = false){
    try {
      toggleMode();
      updateDisabledStates();
      saveActivePattern();
      const mode = getTextValue("inputMode");
      const lensType = getTextValue("lensType");
      const selected = getTextValue("selectedEye");
      const accommodation = getAccommodation();
      const addPower = getValue("addPower");
      const fpRate = getValue("fpRate") / 100;
      const html = mode === "bothEyes"
        ? `<div class="both-eye-results compact-diagram-results">${["R", "L"].map(eye => makeEyeResult(getEyeData(eye), lensType, accommodation, addPower, fpRate)).join("")}</div>`
        : makeEyeResult(getEyeData(selected), lensType, accommodation, addPower, fpRate);
      document.getElementById("result").innerHTML = html;
      updatePatternTabs();
      showUpdatedStatus(manual);
    } catch (e) {
      const result = document.getElementById("result");
      if (result) result.innerHTML = `<div class="warning">計算表示エラー：${e.message}</div>`;
      console.error(e);
    }
  };

  function buildPrintPageFixed(pattern, index, eyesToPrint){
    const lensType = pattern.lensType;
    const accommodation = getPatternAccommodation(pattern);
    const addPower = Number(pattern.addPower) || 0;
    const fpRate = (Number(pattern.fpRate) || 0) / 100;
    const eyeHtml = eyesToPrint.map(eye => {
      const data = getEyeData(eye, pattern);
      const zones = enrichZones(getZones(lensType, data.baseRelative, addPower, fpRate), accommodation);
      const rangeRows = zones.map(zone => `<div class="print-range-row"><span>${zone.part}</span><strong>${zone.range.message ? zone.range.message : zone.rangeText}</strong></div>`).join("");
      return `<div class="print-eye"><h3>${eye === "R" ? "右眼 R" : "左眼 L"}</h3><div class="print-power"><div><strong>7A</strong>${formatSC(getTextValue(`fullS_${eye}`), getTextValue(`fullC_${eye}`))}</div><div><strong>処方値</strong>${formatSC(pattern[`rxS_${eye}`], pattern[`rxC_${eye}`])}</div></div><div class="print-diagram">${drawLensDiagram(lensType, zones, true)}</div><div class="print-ranges">${rangeRows}</div></div>`;
    }).join("");
    const addText = lensType === "single" ? "—" : formatPower(addPower);
    const fpText = lensType === "indoor" ? Math.round(fpRate * 100) + "%" : "—";
    const ageMode = pattern.accMode === "age";
    const oneEyeClass = eyesToPrint.length === 1 ? " single-print-eye" : "";
    return `<section class="print-page"><h1 class="print-title">メガネの見え方の目安</h1><div class="print-subtitle">${displayPatternName(index)}</div><div class="print-info"><div class="print-info-item">レンズタイプ<strong>${getLensLabel(lensType)}</strong></div><div class="print-info-item">加入度 ADD<strong>${addText}</strong></div><div class="print-info-item">使用調節力<strong>${formatPower(accommodation)}（${getPatternUseRateLabel(pattern)}）</strong></div><div class="print-info-item">調節力計算<strong>${getPatternBaseAccommodationLabel(pattern)}</strong></div><div class="print-info-item">FP加入変化率<strong>${fpText}</strong></div></div><div class="print-eyes${oneEyeClass}">${eyeHtml}</div><div class="print-notes"><div>※∞は無限遠を表します。</div><div>※明視域は計算上の目安です。実際の見え方には、眼の状態・レンズ設計・フレーム調整・慣れなどが影響します。</div>${ageMode ? "<div>※調節力は年齢から算出した目安値を使用しています。実際の調節力には個人差があります。</div>" : ""}</div></section>`;
  }

  window.printCustomerPdf = printCustomerPdf = function(){
    saveActivePattern();
    const mode = getTextValue("inputMode");
    const selected = getTextValue("selectedEye");
    const eyesToPrint = mode === "bothEyes" ? ["R", "L"] : [selected];
    const printArea = document.getElementById("printArea");
    printArea.innerHTML = prescriptionPatterns.slice(0, activePatternCount).map((pattern, index) => buildPrintPageFixed(pattern, index, eyesToPrint)).join("");
    window.print();
  };

  ensurePatternOrderNames();
  updatePatternTabs();
  calculate(false);
})();
// version: app-fixes-v3
