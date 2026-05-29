// Lightweight fixes loaded after script.js
(function(){
  function fixedPatternName(index){
    return `処方案${String.fromCharCode(65 + index)}`;
  }

  function isDefaultPatternName(name){
    return /^処方案[A-C]$/.test(name || "");
  }

  function applyIndoorFpDefault(pattern){
    if (!pattern) return;
    // デフォルト未設定時だけ40にする。手入力された50などの数値は変更しない。
    if (pattern.fpPreset === "custom" && (pattern.fpRate === "" || pattern.fpRate == null)) {
      pattern.fpRate = "40";
    }
  }

  function ensurePatternOrderNames(){
    if (!Array.isArray(prescriptionPatterns)) return;
    for (let i = 0; i < 3; i++) {
      if (!prescriptionPatterns[i]) prescriptionPatterns[i] = defaultPattern(i);
      if (!prescriptionPatterns[i].name || isDefaultPatternName(prescriptionPatterns[i].name)) {
        prescriptionPatterns[i].name = fixedPatternName(i);
      }
      applyIndoorFpDefault(prescriptionPatterns[i]);
    }
  }

  function displayPatternName(index){
    const p = prescriptionPatterns[index];
    return p && p.name ? p.name : fixedPatternName(index);
  }

  function applyAgeEstimateLabels(){
    const option = document.querySelector('#ageFormula option[value="ishihara"]');
    if (option) option.textContent = "年齢別目安";

    const accPanel = document.getElementById("ageFormulaLabel")?.closest(".panel");
    const note = accPanel?.querySelector(".note");
    if (note) note.textContent = "Hofstetter最小値：15 − 0.25×年齢。年齢別目安は表の値から線形補間。";

    const details = document.querySelector(".ref-details");
    const summary = details?.querySelector("summary");
    if (summary) summary.textContent = "年齢別調節力目安表を表示";
    const tableNote = details?.querySelector(".note");
    if (tableNote) tableNote.textContent = "※表にない年齢は、前後の値から線形補間します。70歳以上は0.00Dとして扱います。";

    const rows = details?.querySelectorAll(".ishihara-row:not(.ishihara-head)");
    const values = [
      ["10歳", "12.00D"],
      ["20歳", "8.50D"],
      ["30歳", "7.00D"],
      ["40歳", "4.50D"],
      ["45歳", "2.50D"],
      ["50歳", "1.50D"],
      ["55歳", "1.00D"],
      ["60歳", "0.50D"],
      ["65歳", "0.25D"],
      ["70歳以上", "0.00D"]
    ];
    if (rows && rows.length) {
      rows.forEach((row, i) => {
        if (!values[i]) {
          row.remove();
          return;
        }
        const age = row.querySelector("span");
        const acc = row.querySelector("strong");
        if (age) age.textContent = values[i][0];
        if (acc) acc.textContent = values[i][1];
      });
    }
  }

  window.getIshiharaAccommodation = getIshiharaAccommodation = function(age){
    const points = [
      {age:10, acc:12.00},
      {age:20, acc:8.50},
      {age:30, acc:7.00},
      {age:40, acc:4.50},
      {age:45, acc:2.50},
      {age:50, acc:1.50},
      {age:55, acc:1.00},
      {age:60, acc:0.50},
      {age:65, acc:0.25},
      {age:70, acc:0.00}
    ];
    if (age <= 10) return 12;
    if (age >= 70) return 0;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      if (age >= a.age && age <= b.age) {
        const r = (age - a.age) / (b.age - a.age);
        return a.acc + (b.acc - a.acc) * r;
      }
    }
    return 0;
  };

  window.getBaseAccommodationLabel = getBaseAccommodationLabel = function(){
    const mode = getAccModeValue();
    if (mode === "measured") return `実測値 ${formatPower(getValue("measuredAcc"))}`;
    const label = getTextValue("ageFormula") === "hofstetterMin" ? "Hofstetter最小値" : "年齢別目安";
    return `${label} ${formatPower(Math.round(getAgeAccommodation() * 4) / 4)}`;
  };

  window.getPatternBaseAccommodationLabel = getPatternBaseAccommodationLabel = function(pattern){
    if (pattern.accMode !== "age") return `実測値 ${formatPower(Number(pattern.measuredAcc || 0))}`;
    const label = pattern.ageFormula === "hofstetterMin" ? "Hofstetter最小値" : "年齢別目安";
    return `${label} ${formatPower(Math.round(getPatternAgeAccommodation(pattern) * 4) / 4)}`;
  };

  function roundQuarter(value){
    return Math.round(Math.max(0, value) * 4) / 4;
  }

  function getBaseAccommodationValueForSimulation(){
    const mode = getAccModeValue();
    const base = mode === "measured" ? getValue("measuredAcc") : getAgeAccommodation();
    return roundQuarter(base);
  }

  function getEyesForSimulation(){
    const mode = getTextValue("inputMode");
    const selected = getTextValue("selectedEye");
    return mode === "bothEyes" ? ["R", "L"] : [selected];
  }

  function compactRangeText(zone){
    return zone.range.message ? zone.range.message : zone.rangeText;
  }

  function buildEyeSimulationLine(eye, lensType, accommodation, addPower, fpRate){
    const data = getEyeData(eye);
    const zones = enrichZones(getZones(lensType, data.baseRelative, addPower, fpRate), accommodation);
    const text = zones.map(zone => `${zone.part} ${compactRangeText(zone)}`).join(" / ");
    return `<div class="sim-eye-line"><span>${eye === "R" ? "右眼" : "左眼"}</span><strong>${text}</strong></div>`;
  }

  function buildSimulationRows(items, eyes, lensType){
    return items.map(item => {
      const eyeLines = eyes.map(eye => buildEyeSimulationLine(eye, lensType, item.accommodation, item.addPower, item.fpRate)).join("");
      const sub = item.sub ? `<div class="sim-row-sub">${item.sub}</div>` : "";
      return `<div class="sim-row"><div class="sim-row-label"><strong>${item.label}</strong>${sub}</div><div class="sim-row-result">${eyeLines}</div></div>`;
    }).join("");
  }

  function uniqueByKey(items){
    const seen = new Set();
    return items.filter(item => {
      const key = item.key;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function buildComparisonSimulations(mode, lensType, accommodation, addPower, fpRate){
    const eyes = getEyesForSimulation();
    const baseAccommodation = getBaseAccommodationValueForSimulation();
    const rateItems = [
      {label:"100%使用", rate:1},
      {label:"2/3使用", rate:0.6667},
      {label:"1/2使用", rate:0.5}
    ].map(item => ({
      key:`rate-${item.rate}`,
      label:item.label,
      sub:`使用調節力 ${formatPower(roundQuarter(baseAccommodation * item.rate))}`,
      accommodation:roundQuarter(baseAccommodation * item.rate),
      addPower,
      fpRate
    }));

    let html = `<details class="sim-details"><summary>比較シミュレーションを表示</summary><div class="sim-note">現在の処方案を基準に、条件を変えた場合の明視域を比較します。</div><div class="sim-section"><h3>調節力使用率の比較</h3>${buildSimulationRows(rateItems, eyes, lensType)}</div>`;

    if (lensType !== "single") {
      const addCandidates = uniqueByKey([
        addPower - 0.50,
        addPower,
        addPower + 0.50
      ].filter(v => v >= 0).map(v => {
        const fixed = Math.round(v * 4) / 4;
        return {
          key:`add-${fixed.toFixed(2)}`,
          label:`ADD ${formatPower(fixed)}`,
          sub: fixed === addPower ? "現在の加入度" : "加入度変更時",
          accommodation,
          addPower:fixed,
          fpRate
        };
      }));
      html += `<div class="sim-section"><h3>加入度変更シミュレーション</h3>${buildSimulationRows(addCandidates, eyes, lensType)}</div>`;
    }

    if (lensType === "indoor") {
      const currentFpPercent = Math.round(fpRate * 100);
      const fpCandidates = uniqueByKey([25, 40, currentFpPercent].filter(v => v >= 0).map(v => ({
        key:`fp-${v}`,
        label:`FP ${v}%`,
        sub: v === currentFpPercent ? "現在のFP加入変化率" : "FP変更時",
        accommodation,
        addPower,
        fpRate:v / 100
      })));
      html += `<div class="sim-section"><h3>FP変化率シミュレーション</h3>${buildSimulationRows(fpCandidates, eyes, lensType)}</div>`;
    }

    html += `<p class="sim-caution">※比較シミュレーションも計算上の目安です。実際の見え方を保証するものではありません。</p></details>`;
    return html;
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
      applyAgeEstimateLabels();
      toggleMode();
      updateDisabledStates();
      saveActivePattern();
      ensurePatternOrderNames();
      const mode = getTextValue("inputMode");
      const lensType = getTextValue("lensType");
      const selected = getTextValue("selectedEye");
      const accommodation = getAccommodation();
      const addPower = getValue("addPower");
      const fpRate = getValue("fpRate") / 100;
      const resultHtml = mode === "bothEyes"
        ? `<div class="both-eye-results compact-diagram-results">${["R", "L"].map(eye => makeEyeResult(getEyeData(eye), lensType, accommodation, addPower, fpRate)).join("")}</div>`
        : makeEyeResult(getEyeData(selected), lensType, accommodation, addPower, fpRate);
      const simulationHtml = buildComparisonSimulations(mode, lensType, accommodation, addPower, fpRate);
      document.getElementById("result").innerHTML = resultHtml + simulationHtml;
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
  applyAgeEstimateLabels();
  saveActivePattern();
  updatePatternTabs();
  calculate(false);
})();
// version: app-fixes-v8
