// Experimental distance view map loaded after app-fixes.js
(function(){
  const DISTANCES = [
    {label:"∞", meter:Infinity},
    {label:"3m", meter:3},
    {label:"2m", meter:2},
    {label:"1.25m", meter:1.25},
    {label:"1m", meter:1},
    {label:"70cm", meter:0.7},
    {label:"50cm", meter:0.5},
    {label:"40cm", meter:0.4},
    {label:"30cm", meter:0.3},
    {label:"25cm", meter:0.25},
    {label:"22cm", meter:0.22}
  ];

  const POSITIONS = [0,10,20,30,40,50,60,70,80,90,100];

  function currentEyes(){
    const mode = getTextValue("inputMode");
    const selected = getTextValue("selectedEye") || "R";
    return mode === "bothEyes" ? ["R", "L"] : [selected];
  }

  function addAtPosition(position, lensType, addPower, fpRate){
    if (lensType === "single") return 0;
    const fpPosition = 50;
    const fpAdd = lensType === "indoor" ? addPower * fpRate : addPower * 0.5;
    if (position <= fpPosition) {
      return fpAdd * (position / fpPosition);
    }
    const r = (position - fpPosition) / (100 - fpPosition);
    return fpAdd + (addPower - fpAdd) * r;
  }

  function requiredAccommodation(relativePower, meter){
    if (meter === Infinity) {
      return relativePower <= 0 ? 0 : -1;
    }
    return (1 / meter) - relativePower;
  }

  function visibilityScore(relativePower, meter, accommodation){
    const required = requiredAccommodation(relativePower, meter);
    if (required < -0.0001) return 0;
    if (required > accommodation + 0.0001) return 0;
    if (accommodation <= 0) return required <= 0.0001 ? 1 : 0;
    const burden = Math.max(0, required) / accommodation;
    return Math.max(0.12, 1 - burden);
  }

  function cellColor(score){
    const opacity = Math.min(0.92, Math.max(0.10, score));
    return `rgba(37, 99, 235, ${opacity.toFixed(2)})`;
  }

  function buildSvgForEye(eye){
    const lensType = getTextValue("lensType");
    const accommodation = getAccommodation();
    const addPower = getValue("addPower");
    const fpRate = getValue("fpRate") / 100;
    const data = getEyeData(eye);
    const width = 760;
    const height = 360;
    const left = 72;
    const top = 34;
    const bottom = 54;
    const plotW = width - left - 24;
    const plotH = height - top - bottom;
    const colW = plotW / DISTANCES.length;
    const rowH = plotH / POSITIONS.length;
    let cells = "";

    POSITIONS.forEach((pos, rowIndex) => {
      const y = top + rowIndex * rowH + 3;
      DISTANCES.forEach((dist, colIndex) => {
        const add = addAtPosition(pos, lensType, addPower, fpRate);
        const relative = data.baseRelative + add;
        const score = visibilityScore(relative, dist.meter, accommodation);
        if (score <= 0) return;
        const x = left + colIndex * colW + 4;
        const h = Math.max(5, rowH - 6);
        const w = Math.max(8, colW - 8);
        cells += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="${cellColor(score)}" />`;
      });
    });

    let xLabels = "";
    DISTANCES.forEach((dist, i) => {
      const x = left + i * colW + colW / 2;
      xLabels += `<text x="${x}" y="${height - 24}" text-anchor="middle" font-size="11" fill="#475569">${dist.label}</text>`;
    });

    const fpY = top + (plotH * 0.5);
    return `<svg class="view-map-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="距離別見え方マップ ${eye}">
      <rect x="0" y="0" width="${width}" height="${height}" fill="#f8fbff" />
      <line x1="${left}" y1="${top}" x2="${left + plotW}" y2="${top}" stroke="#cbd5e1" />
      <line x1="${left}" y1="${fpY}" x2="${left + plotW}" y2="${fpY}" stroke="#f59e0b" stroke-width="2" stroke-dasharray="6 5" />
      <line x1="${left}" y1="${top + plotH}" x2="${left + plotW}" y2="${top + plotH}" stroke="#cbd5e1" />
      <text x="18" y="${top + 5}" font-size="12" font-weight="700" fill="#1e3a8a">遠用</text>
      <text x="26" y="${fpY + 4}" font-size="12" font-weight="700" fill="#b45309">FP</text>
      <text x="18" y="${top + plotH + 4}" font-size="12" font-weight="700" fill="#1e3a8a">近用</text>
      <text x="${left}" y="20" font-size="12" fill="#64748b">上ほど遠用寄り、下ほど近用寄り</text>
      ${cells}
      ${xLabels}
      <text x="${left + plotW / 2}" y="${height - 6}" text-anchor="middle" font-size="12" fill="#64748b">距離</text>
    </svg>`;
  }

  function buildMapHtml(){
    const lensType = getTextValue("lensType");
    if (lensType === "single") return "";
    const eyes = currentEyes();
    const maps = eyes.map(eye => {
      const label = eye === "R" ? "右眼 R" : "左眼 L";
      return `<div class="view-map-box"><div class="view-map-title"><strong>${label} 距離別見え方マップ</strong><span>濃いほど調節負担が少ない目安</span></div><div class="view-map-svg-wrap">${buildSvgForEye(eye)}</div></div>`;
    }).join("");

    return `<details class="view-map-details"><summary>距離別見え方マップを表示</summary>${maps}<div class="view-map-box"><div class="view-map-legend"><span><i class="view-map-dot dark"></i>余裕あり</span><span><i class="view-map-dot light"></i>ギリギリ</span><span>空白：範囲外の目安</span><span>破線：FP位置</span></div><p class="view-map-note">※このマップは計算上の目安です。縦軸はレンズ内の位置を表し、上が遠用寄り、中央がFP、下が近用寄りです。実際の見え方はレンズ設計、視線、姿勢、フィッティング、慣れなどでも変わります。</p></div></details>`;
  }

  function appendViewMap(){
    const result = document.getElementById("result");
    if (!result) return;
    const existing = document.getElementById("viewMapContainer");
    if (existing) existing.remove();
    const html = buildMapHtml();
    if (!html) return;
    const div = document.createElement("div");
    div.id = "viewMapContainer";
    div.innerHTML = html;
    result.appendChild(div);
  }

  if (typeof calculate === "function") {
    const originalCalculate = calculate;
    window.calculate = calculate = function(manual = false){
      originalCalculate(manual);
      appendViewMap();
    };
    setTimeout(appendViewMap, 0);
  }
})();
// version: view-map-v1
