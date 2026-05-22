let activeInput = null;
let statusTimer = null;

function setupEvents() {
  document.querySelectorAll("input, select").forEach(el => {
    el.addEventListener("input", () => {
      handleFpPreset();
      updateDisabledStates();
      calculate(false);
    });

    el.addEventListener("change", () => {
      handleFpPreset();
      updateDisabledStates();
      calculate(false);
    });
  });

  document.querySelectorAll(".num-input").forEach(input => {
    input.addEventListener("click", () => {
      if (!input.disabled) {
        openKeypad(input);
      }
    });
  });
}

function manualCalculate() {
  const btn = document.getElementById("calcBtn");

  btn.classList.add("pressed");

  setTimeout(() => {
    btn.classList.remove("pressed");
  }, 160);

  calculate(true);
}

function showUpdatedStatus(manual = false) {
  const status = document.getElementById("updateStatus");

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

  document.querySelectorAll(".num-input").forEach(el => {
    el.classList.remove("active");
  });

  input.classList.add("active");

  const keypad = document.getElementById("keypad");
  keypad.classList.add("show");
  document.body.classList.add("keypad-open");

  document.getElementById("keypadTitle").textContent =
    input.closest("label").innerText.trim();

  updateKeypadDisplay();
}

function closeKeypad() {
  const keypad = document.getElementById("keypad");

  keypad.classList.remove("show");
  document.body.classList.remove("keypad-open");

  if (activeInput) {
    activeInput.classList.remove("active");
  }

  activeInput = null;

  calculate(false);
}

function updateKeypadDisplay() {
  document.getElementById("keypadDisplay").textContent =
    activeInput ? activeInput.value : "";
}

function pressKey(key) {
  if (!activeInput) return;

  if (key === "." && activeInput.value.includes(".")) return;

  if (activeInput.value === "0" && key !== ".") {
    activeInput.value = key;
  } else {
    activeInput.value += key;
  }

  updateKeypadDisplay();
  handleFpPreset();
  calculate(false);
}

function backspaceKey() {
  if (!activeInput) return;

  activeInput.value = activeInput.value.slice(0, -1);

  updateKeypadDisplay();
  handleFpPreset();
  calculate(false);
}

function clearKey() {
  if (!activeInput) return;

  activeInput.value = "";

  updateKeypadDisplay();
  handleFpPreset();
  calculate(false);
}

function toggleSign() {
  if (!activeInput) return;

  activeInput.value = activeInput.value.startsWith("-")
    ? activeInput.value.slice(1)
    : "-" + activeInput.value;

  updateKeypadDisplay();
  calculate(false);
}

function stepValue(step) {
  if (!activeInput) return;

  const current = Number(activeInput.value) || 0;
  const next = Math.round((current + step) * 100) / 100;

  activeInput.value = next.toFixed(2);

  updateKeypadDisplay();
  handleFpPreset();
  calculate(false);
}

function getValue(id) {
  return Number(document.getElementById(id).value);
}

function sphericalEquivalent(s, c) {
  return s + c / 2;
}

function formatPower(value) {
  return (value > 0 ? "+" : "") + value.toFixed(2) + "D";
}

function formatDistance(meter) {
  if (meter === Infinity) return "∞";
  if (meter === null) return "実距離なし";

  const cm = meter * 100;

  if (cm >= 100) {
    return meter.toFixed(2) + "m";
  }

  return Math.round(cm) + "cm";
}

function formatRange(far, near, message) {
  if (message) return "明視域なし";

  const farText = formatDistance(far);
  const nearText = formatDistance(near);

  if (farText === nearText) {
    return farText;
  }

  return `${farText}〜${nearText}`;
}

function handleFpPreset() {
  const preset = document.getElementById("fpPreset");
  const fpRate = document.getElementById("fpRate");

  if (preset.value !== "custom") {
    fpRate.value = preset.value;
  }
}

function updateDisabledStates() {
  const accMode = document.querySelector('input[name="accMode"]:checked').value;
  const lensType = document.getElementById("lensType").value;

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

  if (label) {
    label.classList.toggle("is-disabled", disabled);
  }

  if (disabled && activeInput === el) {
    closeKeypad();
  }
}

function getIshiharaAccommodation(age) {
  const points = [
    { age: 20, acc: 10 },
    { age: 30, acc: 7 },
    { age: 40, acc: 4.5 },
    { age: 50, acc: 1.5 },
    { age: 60, acc: 1 }
  ];

  if (age <= 20) return 10;
  if (age >= 60) return 1;

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];

    if (age >= a.age && age <= b.age) {
      const ratio = (age - a.age) / (b.age - a.age);
      return a.acc + (b.acc - a.acc) * ratio;
    }
  }

  return 0;
}

function getAgeAccommodation() {
  const age = getValue("age");
  const formula = document.getElementById("ageFormula").value;

  if (formula === "hofstetterMin") {
    return Math.max(0, 15 - 0.25 * age);
  }

  return Math.max(0, getIshiharaAccommodation(age));
}

function getAccommodation() {
  const mode = document.querySelector('input[name="accMode"]:checked').value;

  const base =
    mode === "measured"
      ? getValue("measuredAcc")
      : getAgeAccommodation();

  const useRate = getValue("accUseRate") || 1;
  const used = base * useRate;

  return Math.round(Math.max(0, used) * 4) / 4;
}

function getBaseAccommodationLabel() {
  const mode = document.querySelector('input[name="accMode"]:checked').value;

  if (mode === "measured") {
    return `実測値 ${formatPower(getValue("measuredAcc"))}`;
  }

  const formula = document.getElementById("ageFormula").value;
  const base = Math.round(getAgeAccommodation() * 4) / 4;

  const label =
    formula === "hofstetterMin"
      ? "Hofstetter最小値"
      : "石原式目安";

  return `${label} ${formatPower(base)}`;
}

function getUseRateLabel() {
  const value = document.getElementById("accUseRate").value;

  if (value === "1") return "100%";
  if (value === "0.6667") return "2/3";

  return "1/2";
}

function calculateRange(relativePower, accommodation) {
  const p = relativePower;
  const acc = accommodation;

  if (-p > acc) {
    return {
      far: null,
      near: null,
      message: "調節力不足で明視域なし"
    };
  }

  const far = p > 0 ? 1 / p : Infinity;
  const nearVergence = -p - acc;

  let near;

  if (nearVergence < 0) {
    near = -1 / nearVergence;
  } else if (nearVergence === 0) {
    near = Infinity;
  } else {
    near = null;
  }

  return {
    far,
    near,
    message: ""
  };
}

function getZones(lensType, baseRelative, addPower, fpRate) {
  if (lensType === "single") {
    return [
      {
        lens: "単焦点",
        part: "処方度数",
        key: "single",
        relative: baseRelative
      }
    ];
  }

  if (lensType === "progressive") {
    return [
      {
        lens: "遠近両用",
        part: "遠用部分",
        key: "distance",
        relative: baseRelative
      },
      {
        lens: "遠近両用",
        part: "近用部分",
        key: "near",
        relative: baseRelative + addPower
      }
    ];
  }

  return [
    {
      lens: "中近・室内用",
      part: "遠用部分",
      key: "distance",
      relative: baseRelative
    },
    {
      lens: "中近・室内用",
      part: "フィッティングポイント",
      key: "fitting",
      relative: baseRelative + addPower * fpRate
    },
    {
      lens: "中近・室内用",
      part: "近用部分",
      key: "near",
      relative: baseRelative + addPower
    }
  ];
}

function getEyeData(eye) {
  const fullSE = sphericalEquivalent(
    getValue(`fullS_${eye}`),
    getValue(`fullC_${eye}`)
  );

  const rxSE = sphericalEquivalent(
    getValue(`rxS_${eye}`),
    getValue(`rxC_${eye}`)
  );

  return {
    eye,
    fullSE,
    rxSE,
    baseRelative: rxSE - fullSE
  };
}

function toggleMode() {
  const mode = document.getElementById("inputMode").value;
  const selected = document.getElementById("selectedEye").value;

  document.getElementById("eyeSelectArea").style.display =
    mode === "singleEye" ? "block" : "none";

  document.getElementById("rightEyeBlock").style.display =
    mode === "bothEyes" || selected === "R" ? "block" : "none";

  document.getElementById("leftEyeBlock").style.display =
    mode === "bothEyes" || selected === "L" ? "block" : "none";
}

function enrichZones(zones, accommodation) {
  return zones.map(zone => {
    const range = calculateRange(zone.relative, accommodation);

    return {
      ...zone,
      range,
      farText: formatDistance(range.far),
      nearText: formatDistance(range.near),
      rangeText: formatRange(range.far, range.near, range.message)
    };
  });
}

function drawLensDiagram(lensType, zones) {
  const find = key => zones.find(zone => zone.key === key);

  const single = find("single");
  const distance = find("distance");
  const fitting = find("fitting");
  const near = find("near");

  const outline = `
    <path
      d="M48 126
         C72 72,216 66,246 118
         C276 170,238 238,186 254
         C140 268,75 251,49 211
         C31 181,34 149,48 126 Z"
      fill="#fff"
      stroke="#2563eb"
      stroke-width="4"
    />
  `;

  if (lensType === "single") {
    return `
      <div class="diagram-wrap">
        <svg viewBox="0 0 560 350">
          ${outline}

          <ellipse cx="145" cy="170" rx="102" ry="70" fill="#dbeafe"/>

          <text x="145" y="164" text-anchor="middle" class="zone-text">単焦点</text>
          <text x="145" y="195" text-anchor="middle" class="zone-small">${single.rangeText}</text>

          <foreignObject x="315" y="125" width="220" height="110">
            <div xmlns="http://www.w3.org/1999/xhtml" class="side-item">
              <div class="side-title">処方度数</div>
              <div class="side-value">${single.rangeText}</div>
            </div>
          </foreignObject>
        </svg>
      </div>
    `;
  }

  if (lensType === "progressive") {
    return `
      <div class="diagram-wrap">
        <svg viewBox="0 0 560 350">
          ${outline}

          <ellipse cx="145" cy="138" rx="94" ry="38" fill="#dbeafe"/>
          <ellipse cx="145" cy="208" rx="66" ry="34" fill="#93c5fd"/>

          <text x="145" y="132" text-anchor="middle" class="zone-text">遠用</text>
          <text x="145" y="160" text-anchor="middle" class="zone-small">${distance.rangeText}</text>

          <text x="145" y="202" text-anchor="middle" class="zone-text">近用</text>
          <text x="145" y="230" text-anchor="middle" class="zone-small">${near.rangeText}</text>

          <foreignObject x="315" y="92" width="220" height="170">
            <div xmlns="http://www.w3.org/1999/xhtml" class="side-box">
              <div class="side-item">
                <div class="side-title">遠用部分</div>
                <div class="side-value">${distance.rangeText}</div>
              </div>

              <div class="side-item">
                <div class="side-title">近用部分</div>
                <div class="side-value">${near.rangeText}</div>
              </div>
            </div>
          </foreignObject>
        </svg>
      </div>
    `;
  }

  return `
    <div class="diagram-wrap">
      <svg viewBox="0 0 560 350">
        ${outline}

        <ellipse cx="145" cy="118" rx="84" ry="30" fill="#dbeafe"/>
        <ellipse cx="145" cy="170" rx="72" ry="30" fill="#bfdbfe"/>
        <ellipse cx="145" cy="220" rx="60" ry="30" fill="#93c5fd"/>

        <text x="145" y="111" text-anchor="middle" class="zone-text">遠用</text>
        <text x="145" y="136" text-anchor="middle" class="zone-small">${distance.rangeText}</text>

        <text x="145" y="164" text-anchor="middle" class="zone-text">FP</text>
        <text x="145" y="190" text-anchor="middle" class="zone-small">${fitting.rangeText}</text>

        <text x="145" y="214" text-anchor="middle" class="zone-text">近用</text>
        <text x="145" y="240" text-anchor="middle" class="zone-small">${near.rangeText}</text>

        <foreignObject x="315" y="70" width="230" height="220">
          <div xmlns="http://www.w3.org/1999/xhtml" class="side-box">
            <div class="side-item">
              <div class="side-title">遠用部分</div>
              <div class="side-value">${distance.rangeText}</div>
            </div>

            <div class="side-item">
              <div class="side-title">フィッティングポイント</div>
              <div class="side-value">${fitting.rangeText}</div>
            </div>

            <div class="side-item">
              <div class="side-title">近用部分</div>
              <div class="side-value">${near.rangeText}</div>
            </div>
          </div>
        </foreignObject>
      </svg>
    </div>
  `;
}

function conditionRows(lensType, eyeData, accommodation, addPower, fpRate) {
  const addRelevant = lensType !== "single";
  const fpRelevant = lensType === "indoor";

  return `
    <div class="summary-row">
      <span>完全矯正値 SE</span>
      <strong>${formatPower(eyeData.fullSE)}</strong>
    </div>

    <div class="summary-row">
      <span>処方値 SE</span>
      <strong>${formatPower(eyeData.rxSE)}</strong>
    </div>

    <div class="summary-row">
      <span>処方差</span>
      <strong>${formatPower(eyeData.baseRelative)}</strong>
    </div>

    <div class="summary-row">
      <span>調節力計算</span>
      <strong>${getBaseAccommodationLabel()}</strong>
    </div>

    <div class="summary-row">
      <span>使用調節力</span>
      <strong>${formatPower(accommodation)}（${getUseRateLabel()}）</strong>
    </div>

    <div class="summary-row ${addRelevant ? "" : "muted"}">
      <span>加入度 ADD</span>
      <strong>${addRelevant ? formatPower(addPower) : "—"}</strong>
    </div>

    <div class="summary-row ${fpRelevant ? "" : "muted"}">
      <span>フィッティングポイント加入変化率</span>
      <strong>${fpRelevant ? Math.round(fpRate * 100) + "%" : "—"}</strong>
    </div>
  `;
}

function makeEyeResult(eyeData, lensType, accommodation, addPower, fpRate) {
  const zones = enrichZones(
    getZones(lensType, eyeData.baseRelative, addPower, fpRate),
    accommodation
  );

  let html = `
    <div class="eye-result">
      <div class="eye-title">
        👁 ${eyeData.eye === "R" ? "右眼 R" : "左眼 L"}
      </div>

      <div class="result-flex">
        ${drawLensDiagram(lensType, zones)}

        <div class="summary-box">
          ${conditionRows(lensType, eyeData, accommodation, addPower, fpRate)}
        </div>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>レンズ種別</th>
              <th>部分</th>
              <th>完全矯正との差</th>
              <th>遠点</th>
              <th>近点</th>
              <th>明視域</th>
            </tr>
          </thead>
          <tbody>
  `;

  zones.forEach(zone => {
    html += `
      <tr>
        <td>${zone.lens}</td>
        <td><span class="badge">${zone.part}</span></td>
        <td>${formatPower(zone.relative)}</td>
        <td>${zone.farText}</td>
        <td>${zone.nearText}</td>
        <td class="big-result">
          ${
            zone.range.message
              ? `<span class="warning">${zone.range.message}</span>`
              : zone.rangeText
          }
        </td>
      </tr>
    `;
  });

  html += `
          </tbody>
        </table>
      </div>
    </div>
  `;

  return html;
}

function calculate(manual = false) {
  toggleMode();
  updateDisabledStates();

  const mode = document.getElementById("inputMode").value;
  const lensType = document.getElementById("lensType").value;
  const selected = document.getElementById("selectedEye").value;

  const accommodation = getAccommodation();
  const addPower = getValue("addPower");
  const fpRate = getValue("fpRate") / 100;

  const eyes = mode === "singleEye" ? [selected] : ["R", "L"];

  const html = eyes
    .map(eye => {
      const eyeData = getEyeData(eye);

      return makeEyeResult(
        eyeData,
        lensType,
        accommodation,
        addPower,
        fpRate
      );
    })
    .join("");

  document.getElementById("result").innerHTML = html;

  showUpdatedStatus(manual);
}

setupEvents();
toggleMode();
updateDisabledStates();
calculate(false);