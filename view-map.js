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

  function getMapModel(lensType){
    if (lensType === "progressive") {
      return {
        positions:[0,25,50,75,100],
        fpPosition:null,
        labels:[
          {pos:0, text:"遠用部分", color:"#1e3a8a"},
          {pos:100, text:"近用部分", color:"#1e3a8a"}
        ]
      };
    }
    return {
      positions:[0,16.7,33.3,50,66.7,83.3,100],
      fpPosition:33.3,
      labels:[
        {pos:0, text:"遠用部分", color:"#1e3a8a"},
        {pos:33.3, text:"FP", color:"#b45309"},
        {pos:100, text:"近用部分", color:"#1e3a8a"}
      ]
    };
  }

  function currentEyes(){
    const mode = getTextValue("inputMode");
    const selected = getTextValue("selectedEye") || "R";
    return mode === "bothEyes" ? ["R", "L"] : [selected];
  }

  function addAtPosition(position, lensType, addPower, fpRate){
    if (lensType === "single") return 0;
    if (lensType === "progressive") {
      return addPower * (position / 100);
    }
    const fpPosition = 33.3;
    const fpAdd = addPower * fpRate;
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
    const model = getMapModel(lensType);
    const positions = model.positions;
    const accommodation = getAccommodation();
    const addPower = getValue("addPower");
    const fpRate = getValue("fpRate") / 100;
    const data = getEyeData(eye);
    const width = 760;
    const height = lensType === "progressive" ? 300 : 340;
    const left = 82;
    const top = 34;
    const bottom = 54;
    const plotW = width - left - 24;
    const plotH = height - top - bottom;
    const colW = plotW / DISTANCES.length;
    const rowH = plotH / positions.length;
    let cells = "";

    positions.forEach((pos, rowIndex) => {
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

    let guideLines = `
      <line x1="${left}" y1="${top}" x2="${left + plotW}" y2="${top}" stroke="#cbd5e1" />
      <line x1="${left}" y1="${top + plotH}" x2="${left + plotW}" y2="${top + plotH}" stroke="#cbd5e1" />
    `;
    if (model.fpPosition != null) {
      const fpY = top + (plotH * (model.fpPosition / 100));
      guideLines += `<line x1="${left}" y1="${fpY}" x2="${left + plotW}" y2="${fpY}" stroke="#f59e0b" stroke-width="2" stroke-dasharray="6 5" />`;
    }

    let yLabels = "";
    model.labels.forEach(label => {
      const y = top + (plotH * (label.pos / 100)) + 4;
      yLabels += `<text x="12" y="${y}" font-size="12" font-weight="700" fill="${label.color}">${label.text}</text>`;
    });

    return `<svg class="view-map-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="距離別見え方マップ ${eye}">
      <rect x="0" y="0" width="${width}" height="${height}" fill="#f8fbff" />
      ${guideLines}
      ${yLabels}
      ${cells}
      ${xLabels}
      <text x="${left + plotW / 2}" y="${height - 6}" text-anchor="middle" font-size="12" fill="#64748b">距離</text>
    </svg>`;
  }

  function buildMapHtml(){
    const lensType = getTextValue("lensType");
    if (lensType === "single") return "";
    const eyes = currentEyes();
    const rowsText = lensType === "progressive" ? "縦軸5段階" : "縦軸7段階 / FPは上から3段目";
    const maps = eyes.map(eye => {
      const label = eye === "R" ? "右眼 R" : "左眼 L";
      return `<div class="view-map-box"><div class="view-map-title"><strong>${label} 距離別見え方マップ</strong><span>${rowsText} / 濃いほど調節負担が少ない目安</span></div><div class="view-map-svg-wrap">${buildSvgForEye(eye)}</div></div>`;
    }).join("");

    const fpLegend = lensType === "indoor" ? "<span>破線：FP位置</span>" : "";
    return `<details class="view-map-details"><summary>距離別見え方マップを表示</summary>${maps}<div class="view-map-box"><div class="view-map-legend"><span><i class="view-map-dot dark"></i>調節負担が少ない</span><span><i class="view-map-dot light"></i>調節負担が大きい</span><span>空白：範囲外の目安</span>${fpLegend}</div><p class="view-map-note">※このマップは、正確なレンズ設計再現ではなく、加入量を上下方向に補間した説明用モデルです。各距離で必要な調節量を「必要調節量＝距離の逆数D−その位置の完全矯正との差」で求め、必要調節量が0以上かつ使用調節力以内なら表示しています。濃さは調節負担の少なさの目安です。実際の見え方は、レンズ設計、明瞭域の幅、視線、姿勢、フィッティング、慣れなどでも変わります。</p></div></details>`;
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
// version: view-map-v2
