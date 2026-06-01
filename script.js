let activeInput = null;
let statusTimer = null;
let activePatternIndex = 0;
let activePatternCount = 1;
let isLoadingPattern = false;

const defaultPattern = index => ({
  name: `処方案${String.fromCharCode(65 + index)}`,
  lensType: "single",
  addPower: "2.00",
  fpPreset: "custom",
  fpRate: "40",
  rxS_R: "-3.00",
  rxC_R: "0.00",
  rxS_L: "-3.00",
  rxC_L: "0.00",
  accMode: "measured",
  measuredAcc: "2.50",
  age: "45",
  ageFormula: "ishihara",
  accUseRate: "1"
});

let prescriptionPatterns = [defaultPattern(0), defaultPattern(1), defaultPattern(2)];

function fixedPatternName(index) {
  return `処方案${String.fromCharCode(65 + index)}`;
}

function isDefaultPatternName(name) {
  return /^処方案[A-C]$/.test(name || "");
}

function applyIndoorFpDefault(pattern) {
  if (!pattern) return;
  // デフォルト未設定時だけ40にする。手入力された50などの数値は変更しない。
  if (pattern.fpPreset === "custom" && (pattern.fpRate === "" || pattern.fpRate == null)) {
    pattern.fpRate = "40";
  }
}

function ensurePatternOrderNames() {
  if (!Array.isArray(prescriptionPatterns)) return;
  for (let i = 0; i < 3; i++) {
    if (!prescriptionPatterns[i]) prescriptionPatterns[i] = defaultPattern(i);
    if (!prescriptionPatterns[i].name || isDefaultPatternName(prescriptionPatterns[i].name)) {
      prescriptionPatterns[i].name = fixedPatternName(i);
    }
    applyIndoorFpDefault(prescriptionPatterns[i]);
  }
}

function displayPatternName(index) {
  const p = prescriptionPatterns[index];
  return p && p.name ? p.name : fixedPatternName(index);
}

function getValue(id) {
  const el = document.getElementById(id);
  return el ? Number(el.value) : 0;
}

function getTextValue(id) {
  const el = document.getElementById(id);
  return el ? el.value : "";
}

function getAccModeValue() {
  const checked = document.querySelector('input[name="accMode"]:checked');
  return checked ? checked.value : "measured";
}

function setAccModeValue(value) {
  const target = document.querySelector(`input[name="accMode"][value="${value}"]`);
  if (target) target.checked = true;
}

function sphericalEquivalent(s, c) {
  return s + c / 2;
}

function formatPower(value) {
  return (value > 0 ? "+" : "") + Number(value).toFixed(2) + "D";
}

function formatSigned(value) {
  return (value > 0 ? "+" : "") + Number(value).toFixed(2);
}

function formatSC(s, c) {
  return `S ${formatSigned(Number(s))} / C ${formatSigned(Number(c))}`;
}

function formatDistance(meter) {
  if (meter === Infinity) return "∞";
  if (meter === null) return "実距離なし";
  const cm = meter * 100;
  return cm >= 100 ? meter.toFixed(2) + "m" : Math.round(cm) + "cm";
}

function formatRange(far, near, message) {
  if (message) return "明視域なし";
  const farText = formatDistance(far);
  const nearText = formatDistance(near);
  return farText === nearText ? farText : `${farText}〜${nearText}`;
}

function setupEvents() {
  document.querySelectorAll("input, select").forEach(el => {
    el.addEventListener("input", () => {
      if (el.id === "patternName") prescriptionPatterns[activePatternIndex].name = el.value || defaultPattern(activePatternIndex).name;
      handleFpPreset();
      saveActivePattern();
      updateDisabledStates();
      calculate(false);
    });
    el.addEventListener("change", () => {
      handleFpPreset();
      saveActivePattern();
      updateDisabledStates();
      calculate(false);
    });
  });
  document.querySelectorAll(".num-input").forEach(input => {
    input.addEventListener("click", () => {
      if (!input.disabled) openKeypad(input);
    });
  });
}

function manualCalculate() {
  const btn = document.getElementById("calcBtn");
  btn.classList.add("pressed");
  setTimeout(() => btn.classList.remove("pressed"), 160);
  calculate(true);
}

function showUpdatedStatus(manual = false) {
  const status = document.getElementById("updateStatus");
  if (!status) return;
  status.textContent = manual ? "再計算しました" : "自動更新しました";
  status.classList.add("flash");
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    status.textContent = "入力すると自動更新";
    status.classList.remove("flash");
  }, 1200);
}

function openKeypad(input) {
  activeInput = input;
  document.querySelectorAll(".num-input").forEach(el => el.classList.remove("active"));
  input.classList.add("active");
  document.getElementById("keypad").classList.add("show");
  document.body.classList.add("keypad-open");
  document.getElementById("keypadTitle").textContent = input.closest("label").innerText.trim();
  updateKeypadDisplay();
}

function closeKeypad() {
  document.getElementById("keypad").classList.remove("show");
  document.body.classList.remove("keypad-open");
  if (activeInput) activeInput.classList.remove("active");
  activeInput = null;
  saveActivePattern();
  calculate(false);
}

function updateKeypadDisplay() {
  document.getElementById("keypadDisplay").textContent = activeInput ? activeInput.value : "";
}

function pressKey(key) {
  if (!activeInput) return;
  if (key === "." && activeInput.value.includes(".")) return;
  activeInput.value = activeInput.value === "0" && key !== "." ? key : activeInput.value + key;
  updateKeypadDisplay();
  handleFpPreset();
  saveActivePattern();
  calculate(false);
}

function backspaceKey() {
  if (!activeInput) return;
  activeInput.value = activeInput.value.slice(0, -1);
  updateKeypadDisplay();
  handleFpPreset();
  saveActivePattern();
  calculate(false);
}

function clearKey() {
  if (!activeInput) return;
  activeInput.value = "";
  updateKeypadDisplay();
  handleFpPreset();
  saveActivePattern();
  calculate(false);
}

function toggleSign() {
  if (!activeInput) return;
  activeInput.value = activeInput.value.startsWith("-") ? activeInput.value.slice(1) : "-" + activeInput.value;
  updateKeypadDisplay();
  saveActivePattern();
  calculate(false);
}

function stepValue(step) {
  if (!activeInput) return;
  const next = Math.round(((Number(activeInput.value) || 0) + step) * 100) / 100;
  activeInput.value = next.toFixed(2);
  updateKeypadDisplay();
  handleFpPreset();
  saveActivePattern();
  calculate(false);
}

function handleFpPreset() {
  const preset = document.getElementById("fpPreset");
  const fpRate = document.getElementById("fpRate");
  if (preset && fpRate && preset.value !== "custom") fpRate.value = preset.value;
}

function saveActivePattern() {
  if (isLoadingPattern) return;
  prescriptionPatterns[activePatternIndex] = {
    name: getTextValue("patternName") || defaultPattern(activePatternIndex).name,
    lensType: getTextValue("lensType"),
    addPower: getTextValue("addPower"),
    fpPreset: getTextValue("fpPreset"),
    fpRate: getTextValue("fpRate"),
    rxS_R: getTextValue("rxS_R"),
    rxC_R: getTextValue("rxC_R"),
    rxS_L: getTextValue("rxS_L"),
    rxC_L: getTextValue("rxC_L"),
    accMode: getAccModeValue(),
    measuredAcc: getTextValue("measuredAcc"),
    age: getTextValue("age"),
    ageFormula: getTextValue("ageFormula"),
    accUseRate: getTextValue("accUseRate")
  };
  updatePatternTabs();
}

function loadPattern(index) {
  const p = prescriptionPatterns[index];
  isLoadingPattern = true;
  document.getElementById("patternName").value = p.name;
  document.getElementById("lensType").value = p.lensType;
  document.getElementById("addPower").value = p.addPower;
  document.getElementById("fpPreset").value = p.fpPreset;
  document.getElementById("fpRate").value = p.fpRate;
  document.getElementById("rxS_R").value = p.rxS_R;
  document.getElementById("rxC_R").value = p.rxC_R;
  document.getElementById("rxS_L").value = p.rxS_L;
  document.getElementById("rxC_L").value = p.rxC_L;
  setAccModeValue(p.accMode || "measured");
  document.getElementById("measuredAcc").value = p.measuredAcc || "2.50";
  document.getElementById("age").value = p.age || "45";
  document.getElementById("ageFormula").value = p.ageFormula || "ishihara";
  document.getElementById("accUseRate").value = p.accUseRate || "1";
  isLoadingPattern = false;
}

function switchPattern(index) {
  if (index >= activePatternCount || index === activePatternIndex) return;
  saveActivePattern();
  activePatternIndex = index;
  loadPattern(index);
  updatePatternTabs();
  updateDisabledStates();
  calculate(false);
}

function addPattern() {
  saveActivePattern();
  if (activePatternCount >= 3) return;
  activePatternCount++;
  ensurePatternOrderNames();
  activePatternIndex = activePatternCount - 1;
  loadPattern(activePatternIndex);
  updatePatternTabs();
  updateDisabledStates();
  calculate(false);
}

function removeActivePattern() {
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
}

function updatePatternTabs() {
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
}

function updateDisabledStates() {
  const accMode = getAccModeValue();
  const lensType = getTextValue("lensType");
  setDisabled("measuredAcc", accMode !== "measured", "measuredLabel");
  setDisabled("age", accMode !== "age", "ageLabel");
  setDisabled("ageFormula", accMode !== "age", "ageFormulaLabel");
  setDisabled("addPower", lensType === "single", "addLabel");
  setDisabled("fpPreset", lensType !== "indoor", "fpPresetLabel");
  setDisabled("fpRate", lensType !== "indoor", "fpRateLabel");
}

function setDisabled(id, disabled, labelId) {
  const el = document.getElementById(id);
  const label = document.getElementById(labelId);
  if (!el) return;
  el.disabled = disabled;
  if (label) label.classList.toggle("is-disabled", disabled);
  if (disabled && activeInput === el) closeKeypad();
}

function getIshiharaAccommodation(age) {
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
}

function getAgeAccommodation() {
  const age = getValue("age");
  const formula = getTextValue("ageFormula");
  return formula === "hofstetterMin" ? Math.max(0, 15 - 0.25 * age) : Math.max(0, getIshiharaAccommodation(age));
}

function getAccommodation() {
  const mode = getAccModeValue();
  const base = mode === "measured" ? getValue("measuredAcc") : getAgeAccommodation();
  const useRate = getValue("accUseRate") || 1;
  return Math.round(Math.max(0, base * useRate) * 4) / 4;
}

function getBaseAccommodationLabel() {
  const mode = getAccModeValue();
  if (mode === "measured") return `実測値 ${formatPower(getValue("measuredAcc"))}`;
  const label = getTextValue("ageFormula") === "hofstetterMin" ? "Hofstetter最小値" : "年齢別目安";
  return `${label} ${formatPower(Math.round(getAgeAccommodation() * 4) / 4)}`;
}

function getUseRateLabel() {
  const value = getTextValue("accUseRate");
  if (value === "1") return "100%";
  if (value === "0.6667") return "2/3";
  return "1/2";
}

function getLensLabel(lensType) {
  if (lensType === "single") return "単焦点";
  if (lensType === "progressive") return "遠近両用";
  return "中近・室内用";
}

function calculateRange(relativePower, accommodation) {
  const p = relativePower;
  const acc = accommodation;
  if (-p > acc) return {far:null, near:null, message:"調節力不足で明視域なし"};
  const far = p > 0 ? 1 / p : Infinity;
  const nearVergence = -p - acc;
  let near;
  if (nearVergence < 0) near = -1 / nearVergence;
  else if (nearVergence === 0) near = Infinity;
  else near = null;
  return {far, near, message:""};
}

function getZones(lensType, baseRelative, addPower, fpRate) {
  if (lensType === "single") return [{lens:"単焦点", part:"処方度数", key:"single", relative:baseRelative}];
  if (lensType === "progressive") return [
    {lens:"遠近両用", part:"遠用部分", key:"distance", relative:baseRelative},
    {lens:"遠近両用", part:"近用部分", key:"near", relative:baseRelative + addPower}
  ];
  return [
    {lens:"中近・室内用", part:"遠用部分", key:"distance", relative:baseRelative},
    {lens:"中近・室内用", part:"フィッティングポイント", key:"fitting", relative:baseRelative + addPower * fpRate},
    {lens:"中近・室内用", part:"近用部分", key:"near", relative:baseRelative + addPower}
  ];
}

function getEyeData(eye, pattern = null) {
  const rxS = pattern ? Number(pattern[`rxS_${eye}`]) : getValue(`rxS_${eye}`);
  const rxC = pattern ? Number(pattern[`rxC_${eye}`]) : getValue(`rxC_${eye}`);
  const fullSE = sphericalEquivalent(getValue(`fullS_${eye}`), getValue(`fullC_${eye}`));
  const rxSE = sphericalEquivalent(rxS, rxC);
  return {eye, fullSE, rxSE, baseRelative:rxSE - fullSE, rxS, rxC};
}

function toggleMode() {
  const mode = getTextValue("inputMode");
  const selected = getTextValue("selectedEye");
  document.getElementById("eyeSelectArea").style.display = mode === "singleEye" ? "block" : "none";
  document.getElementById("rightEyeBlock").style.display = mode === "bothEyes" || selected === "R" ? "block" : "none";
  document.getElementById("leftEyeBlock").style.display = mode === "bothEyes" || selected === "L" ? "block" : "none";
}

function enrichZones(zones, accommodation) {
  return zones.map(zone => {
    const range = calculateRange(zone.relative, accommodation);
    return {...zone, range, farText:formatDistance(range.far), nearText:formatDistance(range.near), rangeText:formatRange(range.far, range.near, range.message)};
  });
}

function drawLensDiagram(lensType, zones, compact = false) {
  const single = zones.find(z => z.key === "single");
  const distance = zones.find(z => z.key === "distance");
  const fitting = zones.find(z => z.key === "fitting");
  const near = zones.find(z => z.key === "near");
  const viewBox = compact ? "0 0 360 230" : "0 0 360 230";
  const cx = 180;
  const outline = `<ellipse cx="${cx}" cy="115" rx="154" ry="84" fill="#fff" stroke="#2563eb" stroke-width="4"/>`;

  if (lensType === "single" && single) {
    return `<div class="diagram-wrap"><svg viewBox="${viewBox}">${outline}<ellipse cx="${cx}" cy="115" rx="130" ry="64" fill="#dbeafe"/><text x="${cx}" y="108" text-anchor="middle" class="zone-text">単焦点</text><text x="${cx}" y="145" text-anchor="middle" class="zone-small">${single.rangeText}</text></svg></div>`;
  }
  if (lensType === "progressive" && distance && near) {
    return `<div class="diagram-wrap"><svg viewBox="${viewBox}">${outline}<ellipse cx="${cx}" cy="76" rx="128" ry="38" fill="#dbeafe"/><ellipse cx="${cx}" cy="158" rx="94" ry="38" fill="#93c5fd"/><text x="${cx}" y="70" text-anchor="middle" class="zone-text">遠用</text><text x="${cx}" y="102" text-anchor="middle" class="zone-small">${distance.rangeText}</text><text x="${cx}" y="152" text-anchor="middle" class="zone-text">近用</text><text x="${cx}" y="184" text-anchor="middle" class="zone-small">${near.rangeText}</text></svg></div>`;
  }
  if (lensType === "indoor" && distance && fitting && near) {
    return `<div class="diagram-wrap"><svg viewBox="${viewBox}">${outline}<ellipse cx="${cx}" cy="62" rx="118" ry="31" fill="#dbeafe"/><ellipse cx="${cx}" cy="115" rx="106" ry="31" fill="#bfdbfe"/><ellipse cx="${cx}" cy="168" rx="88" ry="31" fill="#93c5fd"/><text x="${cx}" y="57" text-anchor="middle" class="zone-text">遠用</text><text x="${cx}" y="82" text-anchor="middle" class="zone-small">${distance.rangeText}</text><text x="${cx}" y="110" text-anchor="middle" class="zone-text">FP</text><text x="${cx}" y="135" text-anchor="middle" class="zone-small">${fitting.rangeText}</text><text x="${cx}" y="163" text-anchor="middle" class="zone-text">近用</text><text x="${cx}" y="188" text-anchor="middle" class="zone-small">${near.rangeText}</text></svg></div>`;
  }
  return `<div class="diagram-wrap"><svg viewBox="${viewBox}">${outline}<text x="${cx}" y="120" text-anchor="middle" class="zone-text">表示なし</text></svg></div>`;
}

function conditionRows(lensType, eyeData, accommodation, addPower, fpRate) {
  const addRelevant = lensType !== "single";
  const fpRelevant = lensType === "indoor";
  return `<div class="summary-row"><span>完全矯正値 SE</span><strong>${formatPower(eyeData.fullSE)}</strong></div><div class="summary-row"><span>処方値 SE</span><strong>${formatPower(eyeData.rxSE)}</strong></div><div class="summary-row"><span>処方差</span><strong>${formatPower(eyeData.baseRelative)}</strong></div><div class="summary-row"><span>調節力計算</span><strong>${getBaseAccommodationLabel()}</strong></div><div class="summary-row"><span>使用調節力</span><strong>${formatPower(accommodation)}（${getUseRateLabel()}）</strong></div><div class="summary-row ${addRelevant ? "" : "muted"}"><span>加入度 ADD</span><strong>${addRelevant ? formatPower(addPower) : "—"}</strong></div><div class="summary-row ${fpRelevant ? "" : "muted"}"><span>フィッティングポイント加入変化率</span><strong>${fpRelevant ? Math.round(fpRate * 100) + "%" : "—"}</strong></div>`;
}

function rangeCards(zones) {
  return `<div class="range-cards">${zones.map(zone => `<div class="range-card"><div class="range-card-head"><span>${zone.part}</span><strong>${zone.range.message ? zone.range.message : zone.rangeText}</strong></div><div class="range-card-sub"><span>差 ${formatPower(zone.relative)}</span><span>遠点 ${zone.farText}</span><span>近点 ${zone.nearText}</span></div></div>`).join("")}</div>`;
}

function roundQuarter(value) {
  return Math.round(Math.max(0, value) * 4) / 4;
}

function getBaseAccommodationValueForSimulation() {
  const mode = getAccModeValue();
  const base = mode === "measured" ? getValue("measuredAcc") : getAgeAccommodation();
  return roundQuarter(base);
}

function getEyesForSimulation() {
  const mode = getTextValue("inputMode");
  const selected = getTextValue("selectedEye");
  return mode === "bothEyes" ? ["R", "L"] : [selected];
}

function compactRangeText(zone) {
  return zone.range.message ? zone.range.message : zone.rangeText;
}

function buildEyeSimulationLine(eye, lensType, accommodation, addPower, fpRate) {
  const data = getEyeData(eye);
  const zones = enrichZones(getZones(lensType, data.baseRelative, addPower, fpRate), accommodation);
  const text = zones.map(zone => `${zone.part} ${compactRangeText(zone)}`).join(" / ");
  return `<div class="sim-eye-line"><span>${eye === "R" ? "右眼" : "左眼"}</span><strong>${text}</strong></div>`;
}

function buildSimulationRows(items, eyes, lensType) {
  return items.map(item => {
    const eyeLines = eyes.map(eye => buildEyeSimulationLine(eye, lensType, item.accommodation, item.addPower, item.fpRate)).join("");
    const sub = item.sub ? `<div class="sim-row-sub">${item.sub}</div>` : "";
    return `<div class="sim-row"><div class="sim-row-label"><strong>${item.label}</strong>${sub}</div><div class="sim-row-result">${eyeLines}</div></div>`;
  }).join("");
}

function uniqueByKey(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = item.key;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildComparisonSimulations(mode, lensType, accommodation, addPower, fpRate) {
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

function makeEyeResult(eyeData, lensType, accommodation, addPower, fpRate) {
  const zones = enrichZones(getZones(lensType, eyeData.baseRelative, addPower, fpRate), accommodation);
  let html = `<div class="eye-result"><div class="eye-title">👁 ${eyeData.eye === "R" ? "右眼 R" : "左眼 L"}</div><div class="result-flex">${drawLensDiagram(lensType, zones)}</div>${rangeCards(zones)}<div class="summary-box">${conditionRows(lensType, eyeData, accommodation, addPower, fpRate)}</div><div class="table-wrap"><table><thead><tr><th>レンズ種別</th><th>部分</th><th>完全矯正との差</th><th>遠点</th><th>近点</th><th>明視域</th></tr></thead><tbody>`;
  zones.forEach(zone => {
    html += `<tr><td>${zone.lens}</td><td><span class="badge">${zone.part}</span></td><td>${formatPower(zone.relative)}</td><td>${zone.farText}</td><td>${zone.nearText}</td><td class="big-result">${zone.range.message ? `<span class="warning">${zone.range.message}</span>` : zone.rangeText}</td></tr>`;
  });
  html += `</tbody></table></div></div>`;
  return html;
}

function calculate(manual = false) {
  try {
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
}

function buildPrintPage(pattern, index) {
  const lensType = pattern.lensType;
  const accommodation = getPatternAccommodation(pattern);
  const addPower = Number(pattern.addPower) || 0;
  const fpRate = (Number(pattern.fpRate) || 0) / 100;
  const mode = getTextValue("inputMode");
  const selected = getTextValue("selectedEye");
  const eyesToPrint = mode === "bothEyes" ? ["R", "L"] : [selected];
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

function getPatternAgeAccommodation(pattern) {
  const age = Number(pattern.age) || 0;
  if (pattern.ageFormula === "hofstetterMin") return Math.max(0, 15 - 0.25 * age);
  return Math.max(0, getIshiharaAccommodation(age));
}

function getPatternAccommodation(pattern) {
  const base = pattern.accMode === "age" ? getPatternAgeAccommodation(pattern) : Number(pattern.measuredAcc || 0);
  const useRate = Number(pattern.accUseRate || 1);
  return Math.round(Math.max(0, base * useRate) * 4) / 4;
}

function getPatternBaseAccommodationLabel(pattern) {
  if (pattern.accMode !== "age") return `実測値 ${formatPower(Number(pattern.measuredAcc || 0))}`;
  const label = pattern.ageFormula === "hofstetterMin" ? "Hofstetter最小値" : "年齢別目安";
  return `${label} ${formatPower(Math.round(getPatternAgeAccommodation(pattern) * 4) / 4)}`;
}

function getPatternUseRateLabel(pattern) {
  if (pattern.accUseRate === "1") return "100%";
  if (pattern.accUseRate === "0.6667") return "2/3";
  return "1/2";
}

function printCustomerPdf() {
  saveActivePattern();
  ensurePatternOrderNames();
  const printArea = document.getElementById("printArea");
  printArea.innerHTML = prescriptionPatterns.slice(0, activePatternCount).map((pattern, index) => buildPrintPage(pattern, index)).join("");
  window.print();
}

ensurePatternOrderNames();
loadPattern(0);
setupEvents();
updatePatternTabs();
toggleMode();
updateDisabledStates();
calculate(false);

// version: v15
