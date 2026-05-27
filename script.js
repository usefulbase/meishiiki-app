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
  fpRate: "50",
  rxS_R: "-3.00",
  rxC_R: "0.00",
  rxS_L: "-3.00",
  rxC_L: "0.00"
});

let prescriptionPatterns = [defaultPattern(0), defaultPattern(1), defaultPattern(2)];

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
function updateKeypadDisplay() { document.getElementById("keypadDisplay").textContent = activeInput ? activeInput.value : ""; }
function pressKey(key) { if (!activeInput) return; if (key === "." && activeInput.value.includes(".")) return; activeInput.value = activeInput.value === "0" && key !== "." ? key : activeInput.value + key; updateKeypadDisplay(); handleFpPreset(); saveActivePattern(); calculate(false); }
function backspaceKey() { if (!activeInput) return; activeInput.value = activeInput.value.slice(0, -1); updateKeypadDisplay(); handleFpPreset(); saveActivePattern(); calculate(false); }
function clearKey() { if (!activeInput) return; activeInput.value = ""; updateKeypadDisplay(); handleFpPreset(); saveActivePattern(); calculate(false); }
function toggleSign() { if (!activeInput) return; activeInput.value = activeInput.value.startsWith("-") ? activeInput.value.slice(1) : "-" + activeInput.value; updateKeypadDisplay(); saveActivePattern(); calculate(false); }
function stepValue(step) { if (!activeInput) return; const next = Math.round(((Number(activeInput.value) || 0) + step) * 100) / 100; activeInput.value = next.toFixed(2); updateKeypadDisplay(); handleFpPreset(); saveActivePattern(); calculate(false); }

function getValue(id) { const el = document.getElementById(id); return el ? Number(el.value) : 0; }
function getTextValue(id) { const el = document.getElementById(id); return el ? el.value : ""; }
function sphericalEquivalent(s, c) { return s + c / 2; }
function formatPower(value) { return (value > 0 ? "+" : "") + Number(value).toFixed(2) + "D"; }
function formatSigned(value) { return (value > 0 ? "+" : "") + Number(value).toFixed(2); }
function formatSC(s, c) { return `S ${formatSigned(Number(s))} / C ${formatSigned(Number(c))}`; }
function formatDistance(meter) { if (meter === Infinity) return "∞"; if (meter === null) return "実距離なし"; const cm = meter * 100; return cm >= 100 ? meter.toFixed(2) + "m" : Math.round(cm) + "cm"; }
function formatRange(far, near, message) { if (message) return "明視域なし"; const farText = formatDistance(far); const nearText = formatDistance(near); return farText === nearText ? farText : `${farText}〜${nearText}`; }

function handleFpPreset() { const preset = document.getElementById("fpPreset"); const fpRate = document.getElementById("fpRate"); if (preset && fpRate && preset.value !== "custom") fpRate.value = preset.value; }
function saveActivePattern() { if (isLoadingPattern) return; prescriptionPatterns[activePatternIndex] = { name:getTextValue("patternName") || defaultPattern(activePatternIndex).name, lensType:getTextValue("lensType"), addPower:getTextValue("addPower"), fpPreset:getTextValue("fpPreset"), fpRate:getTextValue("fpRate"), rxS_R:getTextValue("rxS_R"), rxC_R:getTextValue("rxC_R"), rxS_L:getTextValue("rxS_L"), rxC_L:getTextValue("rxC_L") }; updatePatternTabs(); }
function loadPattern(index) { const p = prescriptionPatterns[index]; isLoadingPattern = true; document.getElementById("patternName").value = p.name; document.getElementById("lensType").value = p.lensType; document.getElementById("addPower").value = p.addPower; document.getElementById("fpPreset").value = p.fpPreset; document.getElementById("fpRate").value = p.fpRate; document.getElementById("rxS_R").value = p.rxS_R; document.getElementById("rxC_R").value = p.rxC_R; document.getElementById("rxS_L").value = p.rxS_L; document.getElementById("rxC_L").value = p.rxC_L; isLoadingPattern = false; }
function switchPattern(index) { if (index >= activePatternCount || index === activePatternIndex) return; saveActivePattern(); activePatternIndex = index; loadPattern(index); updatePatternTabs(); updateDisabledStates(); calculate(false); }
function addPattern() { saveActivePattern(); if (activePatternCount >= 3) return; activePatternCount++; activePatternIndex = activePatternCount - 1; loadPattern(activePatternIndex); updatePatternTabs(); updateDisabledStates(); calculate(false); }
function removeActivePattern() { if (activePatternCount <= 1) return; prescriptionPatterns.splice(activePatternIndex, 1); prescriptionPatterns.push(defaultPattern(2)); activePatternCount--; activePatternIndex = Math.max(0, activePatternIndex - 1); loadPattern(activePatternIndex); updatePatternTabs(); updateDisabledStates(); calculate(false); }
function updatePatternTabs() { for (let i = 0; i < 3; i++) { const btn = document.getElementById(`patternTab${i}`); if (!btn) continue; btn.textContent = prescriptionPatterns[i].name || defaultPattern(i).name; btn.classList.toggle("active", i === activePatternIndex); btn.classList.toggle("hidden", i >= activePatternCount); } const label = document.getElementById("activePatternLabel"); if (label) label.textContent = prescriptionPatterns[activePatternIndex].name || defaultPattern(activePatternIndex).name; const addBtn = document.getElementById("addPatternBtn"); const removeBtn = document.getElementById("removePatternBtn"); if (addBtn) addBtn.disabled = activePatternCount >= 3; if (removeBtn) removeBtn.disabled = activePatternCount <= 1; }

function updateDisabledStates() { const checked = document.querySelector('input[name="accMode"]:checked'); const accMode = checked ? checked.value : "measured"; const lensType = getTextValue("lensType"); setDisabled("measuredAcc", accMode !== "measured", "measuredLabel"); setDisabled("age", accMode !== "age", "ageLabel"); setDisabled("ageFormula", accMode !== "age", "ageFormulaLabel"); setDisabled("addPower", lensType === "single", "addLabel"); setDisabled("fpPreset", lensType !== "indoor", "fpPresetLabel"); setDisabled("fpRate", lensType !== "indoor", "fpRateLabel"); }
function setDisabled(id, disabled, labelId) { const el = document.getElementById(id); const label = document.getElementById(labelId); if (!el) return; el.disabled = disabled; if (label) label.classList.toggle("is-disabled", disabled); if (disabled && activeInput === el) closeKeypad(); }

function getIshiharaAccommodation(age) { const points = [{age:20,acc:10},{age:30,acc:7},{age:40,acc:4.5},{age:50,acc:1.5},{age:60,acc:1}]; if (age <= 20) return 10; if (age >= 60) return 1; for (let i=0;i<points.length-1;i++) { const a=points[i], b=points[i+1]; if (age>=a.age && age<=b.age) { const r=(age-a.age)/(b.age-a.age); return a.acc+(b.acc-a.acc)*r; } } return 0; }
function getAgeAccommodation() { const age = getValue("age"); const formula = getTextValue("ageFormula"); return formula === "hofstetterMin" ? Math.max(0, 15 - 0.25 * age) : Math.max(0, getIshiharaAccommodation(age)); }
function getAccommodation() { const checked = document.querySelector('input[name="accMode"]:checked'); const mode = checked ? checked.value : "measured"; const base = mode === "measured" ? getValue("measuredAcc") : getAgeAccommodation(); const useRate = getValue("accUseRate") || 1; return Math.round(Math.max(0, base * useRate) * 4) / 4; }
function getBaseAccommodationLabel() { const checked = document.querySelector('input[name="accMode"]:checked'); const mode = checked ? checked.value : "measured"; if (mode === "measured") return `実測値 ${formatPower(getValue("measuredAcc"))}`; const label = getTextValue("ageFormula") === "hofstetterMin" ? "Hofstetter最小値" : "石原式目安"; return `${label} ${formatPower(Math.round(getAgeAccommodation() * 4) / 4)}`; }
function getUseRateLabel() { const value = getTextValue("accUseRate"); if (value === "1") return "100%"; if (value === "0.6667") return "2/3"; return "1/2"; }
function getLensLabel(lensType) { if (lensType === "single") return "単焦点"; if (lensType === "progressive") return "遠近両用"; return "中近・室内用"; }

function calculateRange(relativePower, accommodation) { const p = relativePower; const acc = accommodation; if (-p > acc) return {far:null,near:null,message:"調節力不足で明視域なし"}; const far = p > 0 ? 1 / p : Infinity; const nearVergence = -p - acc; let near; if (nearVergence < 0) near = -1 / nearVergence; else if (nearVergence === 0) near = Infinity; else near = null; return {far,near,message:""}; }
function getZones(lensType, baseRelative, addPower, fpRate) { if (lensType === "single") return [{lens:"単焦点",part:"処方度数",key:"single",relative:baseRelative}]; if (lensType === "progressive") return [{lens:"遠近両用",part:"遠用部分",key:"distance",relative:baseRelative},{lens:"遠近両用",part:"近用部分",key:"near",relative:baseRelative + addPower}]; return [{lens:"中近・室内用",part:"遠用部分",key:"distance",relative:baseRelative},{lens:"中近・室内用",part:"フィッティングポイント",key:"fitting",relative:baseRelative + addPower * fpRate},{lens:"中近・室内用",part:"近用部分",key:"near",relative:baseRelative + addPower}]; }
function getEyeData(eye, pattern = null) { const rxS = pattern ? Number(pattern[`rxS_${eye}`]) : getValue(`rxS_${eye}`); const rxC = pattern ? Number(pattern[`rxC_${eye}`]) : getValue(`rxC_${eye}`); const fullSE = sphericalEquivalent(getValue(`fullS_${eye}`), getValue(`fullC_${eye}`)); const rxSE = sphericalEquivalent(rxS, rxC); return {eye,fullSE,rxSE,baseRelative:rxSE-fullSE,rxS,rxC}; }
function toggleMode() { const mode = getTextValue("inputMode"); const selected = getTextValue("selectedEye"); document.getElementById("eyeSelectArea").style.display = mode === "singleEye" ? "block" : "none"; document.getElementById("rightEyeBlock").style.display = mode === "bothEyes" || selected === "R" ? "block" : "none"; document.getElementById("leftEyeBlock").style.display = mode === "bothEyes" || selected === "L" ? "block" : "none"; }
function enrichZones(zones, accommodation) { return zones.map(zone => { const range = calculateRange(zone.relative, accommodation); return {...zone, range, farText:formatDistance(range.far), nearText:formatDistance(range.near), rangeText:formatRange(range.far, range.near, range.message)}; }); }

function drawLensDiagram(lensType, zones, compact = false) {
  const find = key => zones.find(zone => zone.key === key);
  const single = find("single");
  const distance = find("distance");
  const fitting = find("fitting");
  const near = find("near");
  const viewBox = compact ? "0 0 420 230" : "0 0 560 310";
  const sideX = 340;
  const cx = 170;
  const outline = `<path d="M28 118 C54 78,106 61,179 63 C249 65,305 90,326 132 C347 174,321 222,255 246 C193 268,103 260,55 224 C14 193,8 148,28 118 Z" fill="#fff" stroke="#2563eb" stroke-width="4" stroke-linejoin="round"/>`;
  const sideSingle = compact ? "" : `<foreignObject x="${sideX}" y="104" width="200" height="100"><div xmlns="http://www.w3.org/1999/xhtml" class="side-item"><div class="side-title">処方度数</div><div class="side-value">${single.rangeText}</div></div></foreignObject>`;
  const sideProgressive = compact ? "" : `<foreignObject x="${sideX}" y="82" width="200" height="150"><div xmlns="http://www.w3.org/1999/xhtml" class="side-box"><div class="side-item"><div class="side-title">遠用部分</div><div class="side-value">${distance.rangeText}</div></div><div class="side-item"><div class="side-title">近用部分</div><div class="side-value">${near.rangeText}</div></div></div></foreignObject>`;
  const sideIndoor = compact ? "" : `<foreignObject x="${sideX}" y="58" width="210" height="190"><div xmlns="http://www.w3.org/1999/xhtml" class="side-box"><div class="side-item"><div class="side-title">遠用部分</div><div class="side-value">${distance.rangeText}</div></div><div class="side-item"><div class="side-title">フィッティングポイント</div><div class="side-value">${fitting.rangeText}</div></div><div class="side-item"><div class="side-title">近用部分</div><div class="side-value">${near.rangeText}</div></div></div></foreignObject>`;
  if (lensType === "single") return `<div class="diagram-wrap"><svg viewBox="${viewBox}">${outline}<ellipse cx="${cx}" cy="154" rx="126" ry="58" fill="#dbeafe"/><text x="${cx}" y="149" text-anchor="middle" class="zone-text">単焦点</text><text x="${cx}" y="181" text-anchor="middle" class="zone-small">${single.rangeText}</text>${sideSingle}</svg></div>`;
  if (lensType === "progressive") return `<div class="diagram-wrap"><svg viewBox="${viewBox}">${outline}<ellipse cx="${cx}" cy="121" rx="118" ry="31" fill="#dbeafe"/><ellipse cx="${cx}" cy="193" rx="88" ry="31" fill="#93c5fd"/><text x="${cx}" y="116" text-anchor="middle" class="zone-text">遠用</text><text x="${cx}" y="143" text-anchor="middle" class="zone-small">${distance.rangeText}</text><text x="${cx}" y="188" text-anchor="middle" class="zone-text">近用</text><text x="${cx}" y="215" text-anchor="middle" class="zone-small">${near.rangeText}</text>${sideProgressive}</svg></div>`;
  return `<div class="diagram-wrap"><svg viewBox="${viewBox}">${outline}<ellipse cx="${cx}" cy="108" rx="110" ry="27" fill="#dbeafe"/><ellipse cx="${cx}" cy="157" rx="96" ry="27" fill="#bfdbfe"/><ellipse cx="${cx}" cy="206" rx="78" ry="27" fill="#93c5fd"/><text x="${cx}" y="103" text-anchor="middle" class="zone-text">遠用</text><text x="${cx}" y="127" text-anchor="middle" class="zone-small">${distance.rangeText}</text><text x="${cx}" y="152" text-anchor="middle" class="zone-text">FP</text><text x="${cx}" y="176" text-anchor="middle" class="zone-small">${fitting.rangeText}</text><text x="${cx}" y="201" text-anchor="middle" class="zone-text">近用</text><text x="${cx}" y="225" text-anchor="middle" class="zone-small">${near.rangeText}</text>${sideIndoor}</svg></div>`;
}

function conditionRows(lensType, eyeData, accommodation, addPower, fpRate) { const addRelevant = lensType !== "single"; const fpRelevant = lensType === "indoor"; return `<div class="summary-row"><span>完全矯正値 SE</span><strong>${formatPower(eyeData.fullSE)}</strong></div><div class="summary-row"><span>処方値 SE</span><strong>${formatPower(eyeData.rxSE)}</strong></div><div class="summary-row"><span>処方差</span><strong>${formatPower(eyeData.baseRelative)}</strong></div><div class="summary-row"><span>調節力計算</span><strong>${getBaseAccommodationLabel()}</strong></div><div class="summary-row"><span>使用調節力</span><strong>${formatPower(accommodation)}（${getUseRateLabel()}）</strong></div><div class="summary-row ${addRelevant ? "" : "muted"}"><span>加入度 ADD</span><strong>${addRelevant ? formatPower(addPower) : "—"}</strong></div><div class="summary-row ${fpRelevant ? "" : "muted"}"><span>フィッティングポイント加入変化率</span><strong>${fpRelevant ? Math.round(fpRate * 100) + "%" : "—"}</strong></div>`; }
function makeEyeResult(eyeData, lensType, accommodation, addPower, fpRate) { const zones = enrichZones(getZones(lensType, eyeData.baseRelative, addPower, fpRate), accommodation); let html = `<div class="eye-result"><div class="eye-title">👁 ${eyeData.eye === "R" ? "右眼 R" : "左眼 L"}</div><div class="result-flex">${drawLensDiagram(lensType, zones)}<div class="summary-box">${conditionRows(lensType, eyeData, accommodation, addPower, fpRate)}</div></div><div class="table-wrap"><table><thead><tr><th>レンズ種別</th><th>部分</th><th>完全矯正との差</th><th>遠点</th><th>近点</th><th>明視域</th></tr></thead><tbody>`; zones.forEach(zone => { html += `<tr><td>${zone.lens}</td><td><span class="badge">${zone.part}</span></td><td>${formatPower(zone.relative)}</td><td>${zone.farText}</td><td>${zone.nearText}</td><td class="big-result">${zone.range.message ? `<span class="warning">${zone.range.message}</span>` : zone.rangeText}</td></tr>`; }); html += `</tbody></table></div></div>`; return html; }

function calculate(manual = false) { try { toggleMode(); updateDisabledStates(); saveActivePattern(); const mode = getTextValue("inputMode"); const lensType = getTextValue("lensType"); const selected = getTextValue("selectedEye"); const accommodation = getAccommodation(); const addPower = getValue("addPower"); const fpRate = getValue("fpRate") / 100; let html; if (mode === "bothEyes") html = `<div class="both-eye-results">${["R","L"].map(eye => makeEyeResult(getEyeData(eye), lensType, accommodation, addPower, fpRate)).join("")}</div>`; else html = makeEyeResult(getEyeData(selected), lensType, accommodation, addPower, fpRate); document.getElementById("result").innerHTML = html; updatePatternTabs(); showUpdatedStatus(manual); } catch (e) { const result = document.getElementById("result"); if (result) result.innerHTML = `<div class="warning">計算表示エラー：${e.message}</div>`; console.error(e); } }

function buildPrintPage(pattern, index) { const lensType = pattern.lensType; const accommodation = getAccommodation(); const addPower = Number(pattern.addPower) || 0; const fpRate = (Number(pattern.fpRate) || 0) / 100; const eyeHtml = ["R", "L"].map(eye => { const data = getEyeData(eye, pattern); const zones = enrichZones(getZones(lensType, data.baseRelative, addPower, fpRate), accommodation); const rangeRows = zones.map(zone => `<div class="print-range-row"><span>${zone.part}</span><strong>${zone.range.message ? zone.range.message : zone.rangeText}</strong></div>`).join(""); return `<div class="print-eye"><h3>${eye === "R" ? "右眼 R" : "左眼 L"}</h3><div class="print-power"><div><strong>7A</strong>${formatSC(getTextValue(`fullS_${eye}`), getTextValue(`fullC_${eye}`))}</div><div><strong>処方値</strong>${formatSC(pattern[`rxS_${eye}`], pattern[`rxC_${eye}`])}</div></div><div class="print-diagram">${drawLensDiagram(lensType, zones, true)}</div><div class="print-ranges">${rangeRows}</div></div>`; }).join(""); const addText = lensType === "single" ? "—" : formatPower(addPower); const fpText = lensType === "indoor" ? Math.round(fpRate * 100) + "%" : "—"; const checked = document.querySelector('input[name="accMode"]:checked'); const ageMode = checked && checked.value === "age"; return `<section class="print-page"><h1 class="print-title">メガネの見え方の目安</h1><div class="print-subtitle">${pattern.name || `処方案${String.fromCharCode(65 + index)}`}</div><div class="print-info"><div class="print-info-item">レンズタイプ<strong>${getLensLabel(lensType)}</strong></div><div class="print-info-item">加入度 ADD<strong>${addText}</strong></div><div class="print-info-item">使用調節力<strong>${formatPower(accommodation)}（${getUseRateLabel()}）</strong></div><div class="print-info-item">調節力計算<strong>${getBaseAccommodationLabel()}</strong></div><div class="print-info-item">FP加入変化率<strong>${fpText}</strong></div></div><div class="print-eyes">${eyeHtml}</div><div class="print-notes"><div>※∞は無限遠を表します。</div><div>※明視域は計算上の目安です。実際の見え方には、眼の状態・レンズ設計・フレーム調整・慣れなどが影響します。</div>${ageMode ? "<div>※調節力は年齢から算出した目安値を使用しています。実際の調節力には個人差があります。</div>" : ""}</div></section>`; }
function printCustomerPdf() { saveActivePattern(); const printArea = document.getElementById("printArea"); printArea.innerHTML = prescriptionPatterns.slice(0, activePatternCount).map((pattern, index) => buildPrintPage(pattern, index)).join(""); window.print(); }

loadPattern(0);
setupEvents();
updatePatternTabs();
toggleMode();
updateDisabledStates();
calculate(false);
