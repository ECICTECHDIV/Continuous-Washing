/* ============================================================
 * app.js — 連續水洗能耗計算工具：邏輯（計算 / 畫面互動 / 存讀檔 / PWA 註冊）
 * 這個檔案依賴 data.js 先載入（用到 TRANSLATIONS、DEFAULT_SETTINGS、
 * HEAT_SOURCE_PRESETS 等常數）。
 * ============================================================ */


/* Consolidated JS */


document.querySelectorAll(".tab-btn").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p=>p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("panel-"+btn.dataset.tab).classList.add("active");
  });
});






const state = { lang:"zh" };
function T(key){ return TRANSLATIONS[state.lang][key] || key; }

function setLanguage(lang){
  state.lang = lang;
  document.getElementById("langBtnZh").classList.toggle("active", lang==="zh");
  document.getElementById("langBtnEn").classList.toggle("active", lang==="en");
  applyLanguage();
}
function applyLanguage(){
  document.querySelectorAll("[data-i18n]").forEach(el=>{
    el.textContent = T(el.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el=>{
    el.placeholder = T(el.getAttribute("data-i18n-placeholder"));
  });
  document.querySelectorAll("[data-i18n-title]").forEach(el=>{
    el.title = T(el.getAttribute("data-i18n-title"));
    el.setAttribute("aria-label", T(el.getAttribute("data-i18n-title")));
  });

  if (loadedSetName) {
    document.getElementById("setNameInput").placeholder = state.lang === "en"
      ? `Loaded: ${loadedSetName} (blank = overwrite)`
      : `目前載入：${loadedSetName}（留空即覆蓋）`;
  }

  updateSetList();

  processes.forEach((p, i) => {
    if (/^(流程|Line) \d+$/.test(p.name)) {
      p.name = (state.lang === "en" ? "Line " : "流程 ") + (i + 1);
    }
  });

  renderProcessList();
  renderMethodsPanel();

  const outputEl = document.getElementById("resultsOutput");
  if (outputEl && outputEl.children.length > 0) {
    runCalculation();
  }
}



function getSettings(){
  return {
    heatSource: document.getElementById("s_heatSource").value,
    carbonFactor: Number(document.getElementById("s_carbonFactor").value) || 0,
    fuelHeatValue: Number(document.getElementById("s_fuelHeatValue").value) || 0,
    electricityCarbonFactor: Number(document.getElementById("s_electricityCarbonFactor").value) || 0,
    steamLatentHeat: Number(document.getElementById("s_steamLatentHeat").value) || 0,
    boilerEfficiency: Number(document.getElementById("s_boilerEfficiency").value) || 0,
    preheatingTime: Number(document.getElementById("s_preheatingTime").value) || 0,
    baseLoadPower: Number(document.getElementById("s_baseLoadPower").value) || 0,
    singleDrumPower: Number(document.getElementById("s_singleDrumPower").value) || 0,
    doubleDrumPower: Number(document.getElementById("s_doubleDrumPower").value) || 0,
    stackedWashPower: Number(document.getElementById("s_stackedWashPower").value) || 0,
    heatRecoveryEfficiency: Number(document.getElementById("s_heatRecoveryEfficiency").value) || 0,
    insulationFactor: Number(document.getElementById("s_insulationFactor").value) || 0
  };
}
function applySettingsToForm(s){
  document.getElementById("s_heatSource").value = s.heatSource;
  document.getElementById("s_carbonFactor").value = s.carbonFactor;
  document.getElementById("s_fuelHeatValue").value = s.fuelHeatValue;
  document.getElementById("s_electricityCarbonFactor").value = s.electricityCarbonFactor;
  document.getElementById("s_steamLatentHeat").value = s.steamLatentHeat;
  document.getElementById("s_boilerEfficiency").value = s.boilerEfficiency;
  document.getElementById("s_preheatingTime").value = s.preheatingTime;
  document.getElementById("s_baseLoadPower").value = s.baseLoadPower;
  document.getElementById("s_singleDrumPower").value = s.singleDrumPower;
  document.getElementById("s_doubleDrumPower").value = s.doubleDrumPower;
  document.getElementById("s_stackedWashPower").value = s.stackedWashPower;
  document.getElementById("s_heatRecoveryEfficiency").value = s.heatRecoveryEfficiency;
  document.getElementById("s_insulationFactor").value = s.insulationFactor;
}
function updateHeatSourceParams(){
  const key = document.getElementById("s_heatSource").value;
  const preset = HEAT_SOURCE_PRESETS[key];
  if(!preset) return;
  document.getElementById("s_fuelHeatValue").value = preset.fuelHeatValue;
  document.getElementById("s_carbonFactor").value = preset.carbonFactor;
}
applySettingsToForm(DEFAULT_SETTINGS);
document.getElementById("resetSettingsBtn").addEventListener("click", ()=>{
  applySettingsToForm(DEFAULT_SETTINGS);
});



/* ============================================================
   水洗流程／單元 資料模型
   ============================================================ */
let processes = [];
let processIdCounter = 0;

function defaultFirstUnit(){
  return { type:"singleDrum", waterRatio:5.0, recycledWaterTemp:40, targetTemp:80 };
}
function defaultMiddleUnit(){
  return { type:"singleDrum", waterRatio:5.0, recycleRatio:30, recycledWaterTemp:40, targetTemp:80 };
}
function defaultStackedUnit(sprayCount, defaultTemp){
  return {
    type:"stackedWash", waterRatio:5.0, recycleRatio:30, recycledWaterTemp:40,
    sprayCount, processTime:5, sprayTemps: Array(sprayCount).fill(defaultTemp)
  };
}
function defaultFinalUnit(){
  return { waterRatio:3.0, recycleRatio:70 };
}

function createProcess(){
  processIdCounter++;
  return {
    id: processIdCounter,
    name: T("processNameDefault") + " " + (processes.length + 1),
    fabricSpeed: 40, fabricWeight: 500, fabricLength: 1000,
    hotWaterTemp: 80, coldWaterTemp: 30,
    units: [ defaultFirstUnit(), defaultStackedUnit(4,60), defaultStackedUnit(6,90), defaultStackedUnit(6,70), defaultFinalUnit() ]
  };
}
function addProcess(){
  processes.push(createProcess());
  renderProcessList();
}
function deleteProcess(id){
  processes = processes.filter(p => p.id !== id);
  renderProcessList();
}
function findProcess(id){
  return processes.find(p => p.id === id);
}
function unitRole(p, idx){
  if(idx === 0) return "first";
  if(idx === p.units.length - 1) return "final";
  return "middle";
}

/* ============================================================
   流程卡片 渲染
   ============================================================ */
function renderProcessList(){
  const list = document.getElementById("processList");
  list.innerHTML = processes.map(p => renderProcessCardHTML(p)).join("");
  processes.forEach(p => wireProcessCard(p));
}

function renderProcessCardHTML(p){
  return `
    <div class="process-card" data-id="${p.id}">
      <div class="process-card-header open" data-toggle-id="${p.id}">
        <span class="process-card-chevron open">▾</span>
        <input type="text" class="process-name-input" data-id="${p.id}" value="${escapeHtmlE(p.name)}">
        <button type="button" class="process-card-delete" data-del-id="${p.id}">✕</button>
      </div>
      <div class="process-card-body" data-body-id="${p.id}" style="display:block;">
        <div class="row2">
          <div class="field">
            <label data-i18n="fabricSpeedLabel">${T("fabricSpeedLabel")}</label>
            <input type="number" class="p-input" data-id="${p.id}" data-field="fabricSpeed" value="${p.fabricSpeed}" min="0">
          </div>
          <div class="field">
            <label data-i18n="fabricWeightLabel">${T("fabricWeightLabel")}</label>
            <input type="number" class="p-input" data-id="${p.id}" data-field="fabricWeight" value="${p.fabricWeight}" min="0" step="1">
          </div>
          <div class="field">
            <label data-i18n="fabricLengthLabel">${T("fabricLengthLabel")}</label>
            <input type="number" class="p-input" data-id="${p.id}" data-field="fabricLength" value="${p.fabricLength}" min="0">
          </div>
          <div class="field">
            <label data-i18n="hotWaterTempLabel">${T("hotWaterTempLabel")}</label>
            <input type="number" class="p-input" data-id="${p.id}" data-field="hotWaterTemp" value="${p.hotWaterTemp}">
          </div>
          <div class="field">
            <label data-i18n="coldWaterTempLabel">${T("coldWaterTempLabel")}</label>
            <input type="number" class="p-input" data-id="${p.id}" data-field="coldWaterTemp" value="${p.coldWaterTemp}">
          </div>
        </div>

        <div class="grp-title" data-i18n="unitsTitle">${T("unitsTitle")}</div>
        <div class="units-rows" data-unitsrows-id="${p.id}">
          ${renderUnitsRowsHTML(p)}
        </div>
        <button type="button" class="add-row-btn" data-addunit-id="${p.id}" data-i18n="addUnitBtn">${T("addUnitBtn")}</button>
      </div>
    </div>
  `;
}

function renderUnitsRowsHTML(p){
  return p.units.map((u, idx) => renderUnitRowHTML(p.id, idx, u, unitRole(p, idx))).join("");
}

function renderUnitRowHTML(pid, idx, u, role){
  const isFirst = role === "first", isFinal = role === "final";
  const label = isFirst ? T("firstUnitLabel") : (isFinal ? T("finalColdUnitLabel") : T("unitLabel"));
  let html = `<div class="stage-row">
    <div class="stage-row-top">
      <span style="font-weight:700;font-size:.85rem;">${idx+1}. ${label}</span>
      ${(!isFirst && !isFinal) ? `<button type="button" class="stage-row-del" data-pid="${pid}" data-deluidx="${idx}">✕</button>` : ""}
    </div>`;

  if(!isFinal){
    html += `<div class="field" style="margin-bottom:8px;">
      <label style="font-size:.74rem;color:var(--ink-soft);font-weight:600;">${T("unitTypeLabel")}</label>
      <select class="u-input" data-pid="${pid}" data-uidx="${idx}" data-field="type">
        <option value="singleDrum" ${u.type==="singleDrum"?"selected":""}>${T("singleDrum")}</option>
        <option value="doubleDrum" ${u.type==="doubleDrum"?"selected":""}>${T("doubleDrum")}</option>
        <option value="stackedWash" ${u.type==="stackedWash"?"selected":""}>${T("stackedWash")}</option>
      </select>
    </div>`;
  } else {
    html += `<div class="field" style="margin-bottom:8px;">
      <label style="font-size:.74rem;color:var(--ink-soft);font-weight:600;">${T("unitTypeLabel")}</label>
      <div style="padding:10px 12px;color:var(--ink-soft);font-size:.95rem;">${T("finalColdUnitLabel")}</div>
    </div>`;
  }

  html += `<div class="stage-row-grid">
    <div><label>${T("waterRatioLabel")}</label><input type="number" class="u-input" data-pid="${pid}" data-uidx="${idx}" data-field="waterRatio" value="${u.waterRatio}" step="0.1" min="0"></div>`;
  if(!isFirst){
    html += `<div><label>${T("recycleRatioLabel")}</label><input type="number" class="u-input" data-pid="${pid}" data-uidx="${idx}" data-field="recycleRatio" value="${u.recycleRatio}" min="0" max="80"></div>`;
  }
  if(!isFinal){
    html += `<div><label>${T("recycledWaterTempLabel")}</label><input type="number" class="u-input" data-pid="${pid}" data-uidx="${idx}" data-field="recycledWaterTemp" value="${u.recycledWaterTemp}"></div>`;
  }
  html += `</div>`;

  if(!isFinal){
    if(u.type === "stackedWash"){
      html += `<div class="row2" style="margin-top:8px;">
        <div><label style="font-size:.74rem;color:var(--ink-soft);font-weight:600;">${T("sprayCountLabel")}</label><input type="number" class="u-input" data-pid="${pid}" data-uidx="${idx}" data-field="sprayCount" value="${u.sprayCount}" min="1"></div>
        <div><label style="font-size:.74rem;color:var(--ink-soft);font-weight:600;">${T("processTimeLabel")}</label><input type="number" class="u-input" data-pid="${pid}" data-uidx="${idx}" data-field="processTime" value="${u.processTime}" step="0.1" min="0"></div>
      </div>
      <div class="row3" style="margin-top:8px;">
        ${u.sprayTemps.map((t,si)=>`<div><label style="font-size:.72rem;color:var(--ink-soft);">${T("sprayTempLabel").replace("{i}", si+1)}</label><input type="number" class="u-input" data-pid="${pid}" data-uidx="${idx}" data-field="sprayTemp" data-sprayidx="${si}" value="${t}"></div>`).join("")}
      </div>`;
    } else {
      html += `<div class="field" style="margin-top:8px;">
        <label style="font-size:.74rem;color:var(--ink-soft);font-weight:600;">${T("targetTempLabel")}</label>
        <input type="number" class="u-input" data-pid="${pid}" data-uidx="${idx}" data-field="targetTemp" value="${u.targetTemp}">
      </div>`;
    }
  }

  html += `</div>`;
  return html;
}

function wireProcessCard(p){
  const header = document.querySelector(`.process-card-header[data-toggle-id="${p.id}"]`);
  header.addEventListener("click", (e)=>{
    if(e.target.tagName === "INPUT" || e.target.tagName === "BUTTON" || e.target.closest("button")) return;
    const body = document.querySelector(`.process-card-body[data-body-id="${p.id}"]`);
    const open = body.style.display !== "none";
    body.style.display = open ? "none" : "block";
    header.classList.toggle("open", !open);
    header.querySelector(".process-card-chevron").classList.toggle("open", !open);
  });
  document.querySelector(`.process-name-input[data-id="${p.id}"]`).addEventListener("input", (e)=>{
    p.name = e.target.value;
  });
  document.querySelector(`.process-card-delete[data-del-id="${p.id}"]`).addEventListener("click", ()=>{
    deleteProcess(p.id);
  });
  document.querySelectorAll(`.p-input[data-id="${p.id}"]`).forEach(el=>{
    el.addEventListener("input", ()=>{
      p[el.dataset.field] = Number(el.value) || 0;
    });
  });
  document.querySelector(`.add-row-btn[data-addunit-id="${p.id}"]`).addEventListener("click", ()=>{
    p.units.splice(p.units.length - 1, 0, defaultMiddleUnit());
    rerenderUnits(p);
  });
  wireUnitsRows(p);
}

function wireUnitsRows(p){
  const root = document.querySelector(`.units-rows[data-unitsrows-id="${p.id}"]`);
  root.querySelectorAll(".u-input").forEach(el=>{
    const evt = el.tagName === "SELECT" ? "change" : "input";
    el.addEventListener(evt, ()=>{
      const uidx = Number(el.dataset.uidx);
      const field = el.dataset.field;
      const u = p.units[uidx];
      if(field === "sprayTemp"){
        const si = Number(el.dataset.sprayidx);
        u.sprayTemps[si] = Number(el.value) || 0;
        return;
      }
      if(field === "type"){
        u.type = el.value;
        if(u.type === "stackedWash" && (!u.sprayTemps || u.sprayTemps.length === 0)){
          u.sprayCount = u.sprayCount || 6;
          u.sprayTemps = Array(u.sprayCount).fill(u.targetTemp || 80);
        }
        if(u.type !== "stackedWash" && u.targetTemp == null){
          u.targetTemp = 80;
        }
        rerenderUnits(p);
        return;
      }
      if(field === "sprayCount"){
        const n = Math.max(1, Math.round(Number(el.value)) || 1);
        const old = u.sprayTemps || [];
        const fallback = old[0] != null ? old[0] : 80;
        u.sprayCount = n;
        u.sprayTemps = Array.from({length:n}, (_, i)=> old[i] != null ? old[i] : fallback);
        rerenderUnits(p);
        return;
      }
      u[field] = Number(el.value) || 0;
    });
  });
  root.querySelectorAll(".stage-row-del").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const idx = Number(btn.dataset.deluidx);
      p.units.splice(idx, 1);
      rerenderUnits(p);
    });
  });
}

function rerenderUnits(p){
  const root = document.querySelector(`.units-rows[data-unitsrows-id="${p.id}"]`);
  root.innerHTML = renderUnitsRowsHTML(p);
  wireUnitsRows(p);
}

document.getElementById("addProcessBtn").addEventListener("click", addProcess);
document.getElementById("clearProcessBtn").addEventListener("click", ()=>{
  const msg = state.lang==="en" ? "Clear all wash lines and start fresh? This cannot be undone." : "確定要清空所有水洗流程、重新開始嗎？此動作無法復原。";
  if(!confirm(msg)) return;
  processes = [];
  processIdCounter = 0;
  addProcess();
  document.getElementById("resultsOutput").innerHTML = "";
});
addProcess(); // 預設先給一個流程

function escapeHtmlE(str){
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}



/* ============================================================
   儲存/載入/分享：邏輯比照浸染試染工具與染色能耗工具
   ============================================================ */
const SAVED_SETS_KEY = "contWash_savedSets";
let loadedSetName = "";

function getSavedSets(){
  try{
    return JSON.parse(localStorage.getItem(SAVED_SETS_KEY) || "{}");
  }catch(err){
    console.error("Failed to read saved sets:", err);
    alert(state.lang==="en"
      ? "Unable to read saved sets. This browser/mode may be restricting local storage."
      : "無法讀取已儲存的流程組。此瀏覽器/模式可能限制了本機儲存功能。");
    return null;
  }
}
function setSavedSets(sets){
  try{
    localStorage.setItem(SAVED_SETS_KEY, JSON.stringify(sets));
    return true;
  }catch(err){
    console.error("Failed to save sets:", err);
    alert(state.lang==="en"
      ? "Save failed. Storage may be restricted or full."
      : "儲存失敗：此瀏覽器/模式可能限制了本機儲存功能，或儲存空間已滿。");
    return false;
  }
}

function collectAllData(){
  return { processes: processes, settings: getSettings() };
}
function applyAllData(data){
  processes = data.processes || [];
  if(processes.length === 0) processes.push(createProcess());
  applySettingsToForm(data.settings || DEFAULT_SETTINGS);
  renderProcessList();
  document.getElementById("resultsOutput").innerHTML = "";
}

function saveProcessSet(){
  const typedName = document.getElementById("setNameInput").value.trim();
  const setName = typedName || loadedSetName;
  if(!setName){
    alert(state.lang==="en" ? "Please enter a name." : "請輸入流程組名稱。");
    return;
  }
  const existing = getSavedSets();
  if(existing === null) return;
  if(existing[setName]){
    const msg = state.lang==="en" ? `A set named "${setName}" already exists. Overwrite it?` : `已存在同名流程組「${setName}」，是否要覆蓋？`;
    if(!confirm(msg)) return;
  }
  existing[setName] = collectAllData();
  if(!setSavedSets(existing)) return;
  updateSetList();
  document.getElementById("savedSetsSel").value = setName;
  loadedSetName = setName;
  const input = document.getElementById("setNameInput");
  input.value = "";
  input.placeholder = state.lang==="en" ? `Loaded: ${setName} (blank = overwrite)` : `目前載入：${setName}（留空即覆蓋）`;
  alert(state.lang==="en" ? "Saved!" : "儲存成功！");
}

function loadProcessSet(){
  const sel = document.getElementById("savedSetsSel");
  const name = sel.value;
  if(!name) return;
  const sets = getSavedSets();
  if(sets === null) return;
  const data = sets[name];
  if(!data){
    alert(state.lang==="en" ? "Set not found." : "找不到流程組。");
    return;
  }
  applyAllData(data);
  loadedSetName = name;
  const input = document.getElementById("setNameInput");
  input.value = "";
  input.placeholder = state.lang==="en" ? `Loaded: ${name} (blank = overwrite)` : `目前載入：${name}（留空即覆蓋）`;
  alert(state.lang==="en" ? "Loaded!" : "載入成功！");
}

function deleteProcessSet(){
  const sel = document.getElementById("savedSetsSel");
  const name = sel.value;
  if(!name){
    alert(state.lang==="en" ? "Please select one to delete." : "請選擇要刪除的流程組。");
    return;
  }
  const msg = state.lang==="en" ? `Delete "${name}"?` : `確定要刪除「${name}」嗎？`;
  if(!confirm(msg)) return;
  const sets = getSavedSets();
  if(sets === null) return;
  delete sets[name];
  if(!setSavedSets(sets)) return;
  updateSetList();
  alert(state.lang==="en" ? "Deleted." : "刪除成功！");
}

function updateSetList(){
  const sets = getSavedSets();
  const sel = document.getElementById("savedSetsSel");
  const current = sel.value;
  sel.innerHTML = `<option value="">${T("selectSetOpt")}</option>`;
  if(sets){
    Object.keys(sets).sort().forEach(name=>{
      const opt = document.createElement("option");
      opt.value = name; opt.textContent = name;
      sel.appendChild(opt);
    });
  }
  sel.value = current;
}
updateSetList();

async function shareToolUrl(){
  const url = window.location.href;
  const btn = document.getElementById("shareBtn");
  const original = btn.innerHTML;
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      await navigator.clipboard.writeText(url);
    }else{
      const ta = document.createElement("textarea");
      ta.value = url; ta.style.position="fixed"; ta.style.opacity="0";
      document.body.appendChild(ta); ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    btn.textContent = state.lang==="en" ? "Copied!" : "已複製！";
    setTimeout(()=>{ btn.innerHTML = original; }, 2000);
  }catch(err){
    console.error("Copy failed:", err);
    alert(state.lang==="en" ? "Copy failed — please copy the URL from the address bar manually." : "複製失敗，請手動複製網址列的網址。");
  }
}



/* ============================================================
   計算引擎：逐行對照原本「連續水洗機能耗計算器」的公式搬過來，數字邏輯完全不變
   ============================================================ */
function heatingEnergy(waterMass, inletTemp, outletTemp){
  return Math.max(0, (waterMass * 4.186 * (outletTemp - inletTemp)) / 3600);
}

function calcTotalPower(units, settings){
  let total = settings.baseLoadPower;
  units.forEach((u, idx) => {
    const isFinal = idx === units.length - 1;
    const type = isFinal ? "singleDrum" : u.type;
    if(type === "doubleDrum") total += settings.doubleDrumPower;
    else if(type === "stackedWash") total += settings.stackedWashPower;
    else total += settings.singleDrumPower;
  });
  return total;
}

function calcUnitWaterRequirement(unit, role, totalFabricWeight, incomingRecycledWater, isLast){
  const waterRatio = unit.waterRatio || 0;
  const recycleRatio = (role === "first") ? 0 : (unit.recycleRatio || 0) / 100;
  const targetTemp = (role === "final") ? 25 : (unit.targetTemp != null ? unit.targetTemp : 25);
  const recycledWaterTemp = (role === "final") ? targetTemp : (unit.recycledWaterTemp != null ? unit.recycledWaterTemp : targetTemp);

  const totalWater = totalFabricWeight * waterRatio;
  let recycledWater = 0;
  let freshWater = totalWater;
  if(!isLast){
    recycledWater = Math.min(incomingRecycledWater, totalWater);
    freshWater = totalWater - recycledWater;
  }

  const type = isLast ? "finalColdDrum" : unit.type;
  const data = {
    unit, role, type, totalWater, recycledWater, freshWater, targetTemp, recycledWaterTemp,
    providedRecycledWater: totalWater * recycleRatio
  };
  if(type === "stackedWash"){
    data.sprayTemps = (unit.sprayTemps || []).slice();
  }
  return data;
}

function calcUnitHeatingEnergy(d, hotWaterTemp, coldWaterTemp){
  if(d.type === "finalColdDrum") return 0;
  const mixedTemp = (d.freshWater * hotWaterTemp + d.recycledWater * d.recycledWaterTemp) / d.totalWater;
  if(d.type === "stackedWash"){
    const n = d.sprayTemps.length || 1;
    const waterPerSpray = d.totalWater / n;
    let total = 0;
    d.sprayTemps.forEach(t => { total += heatingEnergy(waterPerSpray, mixedTemp, t); });
    return total;
  }
  return heatingEnergy(d.totalWater, mixedTemp, d.targetTemp);
}

function calcProcessEnergy(p, settings){
  const totalFabricWeight = (p.fabricWeight / 1000) * p.fabricLength; // kg

  const unitsRev = p.units.slice().reverse();
  let unitsData = [];
  let totalWaterConsumption = 0;
  let totalHeatingEnergy = 0;
  let additionalProcessTime = 0;
  let availableRecycledWater = 0;
  let totalFreshWater = 0;

  unitsRev.forEach((unit, i) => {
    const isLast = i === 0;
    const idxInOriginal = p.units.length - 1 - i;
    const role = unitRole(p, idxInOriginal);
    const d = calcUnitWaterRequirement(unit, role, totalFabricWeight, availableRecycledWater, isLast);
    unitsData.unshift(d);
    totalWaterConsumption += d.freshWater;
    totalFreshWater += d.freshWater;
    availableRecycledWater = d.providedRecycledWater;
  });

  const preheatingThermalEnergy = heatingEnergy(totalFreshWater, p.coldWaterTemp, p.hotWaterTemp);

  unitsData.forEach(d => {
    totalHeatingEnergy += calcUnitHeatingEnergy(d, p.hotWaterTemp, p.coldWaterTemp);
    if(d.type === "stackedWash") additionalProcessTime += (d.unit.processTime || 0);
  });

  const baseProcessTime = p.fabricLength / p.fabricSpeed;
  const totalWashingTime = baseProcessTime + additionalProcessTime;
  const totalProcessTime = settings.preheatingTime + totalWashingTime;

  const totalEquipmentPower = calcTotalPower(p.units, settings);
  const preheatingElectricityConsumption = totalEquipmentPower * (settings.preheatingTime / 60);
  const washingElectricityConsumption = totalEquipmentPower * (totalWashingTime / 60);
  const totalElectricityConsumption = preheatingElectricityConsumption + washingElectricityConsumption;

  const totalThermalEnergy = (preheatingThermalEnergy + totalHeatingEnergy) * (1 - settings.heatRecoveryEfficiency / 100) / settings.insulationFactor;

  const boilerEfficiency = settings.boilerEfficiency / 100;
  const steamConsumption = (totalThermalEnergy * 3600) / (settings.steamLatentHeat * boilerEfficiency);
  const fuelConsumption = (totalThermalEnergy * 3600) / (settings.fuelHeatValue * boilerEfficiency);

  const electricityCarbonEmissions = totalElectricityConsumption * settings.electricityCarbonFactor;
  const fuelCarbonEmissions = fuelConsumption * settings.carbonFactor;
  const totalCarbonEmissions = electricityCarbonEmissions + fuelCarbonEmissions;

  return {
    name: p.name,
    fabricWeight: totalFabricWeight, fabricSpeed: p.fabricSpeed, fabricLength: p.fabricLength,
    hotWaterTemp: p.hotWaterTemp, coldWaterTemp: p.coldWaterTemp,
    waterConsumption: totalWaterConsumption,
    totalElectricityConsumption,
    thermalEnergy: totalThermalEnergy,
    steamConsumption, fuelConsumption,
    electricityCarbonEmissions, fuelCarbonEmissions, carbonEmissions: totalCarbonEmissions,
    totalProcessTime,
    unitsData
  };
}



/* ============================================================
   計算結果 渲染 + 比較長條圖（純手繪 SVG，離線可用，不依賴任何外部函式庫）
   ============================================================ */
const CHART_COLORS = ["rgba(135, 95, 40, 0.82)", "rgba(40, 105, 140, 0.82)", "rgba(35, 115, 85, 0.82)", "rgba(155, 85, 45, 0.82)", "rgba(105, 70, 150, 0.82)", "rgba(55, 110, 125, 0.82)"];

function numFmt(val, digits){
  if(!isFinite(val)) return "–";
  return val.toLocaleString(undefined, { minimumFractionDigits:digits, maximumFractionDigits:digits });
}

function runCalculation(){
  const settings = getSettings();
  const results = processes.map(p => calcProcessEnergy(p, settings));
  renderResultsOutput(results);
}
document.getElementById("calcBtn").addEventListener("click", runCalculation);

function getUnitTypeName(type){
  switch(type){
    case "singleDrum": return T("singleDrum");
    case "doubleDrum": return T("doubleDrum");
    case "stackedWash": return T("stackedWash");
    case "finalColdDrum": return T("finalColdUnitLabel");
    default: return type;
  }
}

function renderUnitsSummaryTable(r){
  const rows = r.unitsData.map((d, idx) => {
    const isFirst = idx === 0;
    const recycleDisplay = isFirst ? "–" : ((d.providedRecycledWater / d.totalWater) * 100).toFixed(0) + "%";
    const tempDisplay = d.type === "stackedWash" ? d.sprayTemps.map(t=>t+"°C").join(" / ") : (d.targetTemp != null ? d.targetTemp + "°C" : "–");
    return `<tr>
      <td data-label="${T('unitCol')}">${idx+1}. ${getUnitTypeName(d.type)}</td>
      <td data-label="${T('tempCol')}">${tempDisplay}</td>
      <td data-label="${T('waterRatioCol')}">${numFmt(d.totalWater / r.fabricWeight, 2)}</td>
      <td data-label="${T('recycleRatioCol')}">${recycleDisplay}</td>
      <td data-label="${T('freshWaterCol')}">${numFmt(d.freshWater / r.fabricWeight, 2)}</td>
    </tr>`;
  }).join("");
  return `<table class="units-table">
    <thead><tr><th>${T('unitCol')}</th><th>${T('tempCol')}</th><th>${T('waterRatioCol')}</th><th>${T('recycleRatioCol')}</th><th>${T('freshWaterCol')}</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderResultsOutput(results){
  const container = document.getElementById("resultsOutput");
  if(results.length === 0){
    container.innerHTML = `<div class="card"><p class="sub" style="margin:0;">${T("noProcessesMsg")}</p></div>`;
    return;
  }

  const compareHtml = results.length >= 2 ? `
    <div class="compare-grid">
      <div class="card">
        <h2>${T("waterCompareTitle")}</h2>
        <div id="waterBarWrap"></div>
      </div>
      <div class="card">
        <h2>${T("energyCompareTitle")}</h2>
        <div id="energyBarWrap"></div>
      </div>
    </div>
  ` : "";

  container.innerHTML = compareHtml + `<div class="results-grid">${results.map((r,i)=>`
    <div class="card result-card" style="border-top:4px solid ${CHART_COLORS[i % CHART_COLORS.length]};">
      <h2>${escapeHtmlE(r.name)}</h2>
      <div class="process-summary">
        <p>${T("fabricSpeedLabel")}: ${r.fabricSpeed} m/min ｜ ${T("fabricWeightLabel")}: ${(r.fabricWeight*1000/r.fabricLength).toFixed(0)} g/m ｜ ${T("fabricLengthLabel")}: ${r.fabricLength} m</p>
        <p>${T("hotWaterTempLabel")}: ${r.hotWaterTemp}°C ｜ ${T("coldWaterTempLabel")}: ${r.coldWaterTemp}°C</p>
        ${renderUnitsSummaryTable(r)}
      </div>
      <table class="result-data-table">
        <thead>
          <tr><th></th><th>${T("totalConsumptionCol")}</th><th>${T("perKgCol")}</th></tr>
        </thead>
        <tbody>
          <tr><td>${T("waterResultLabel")}</td><td><span class="rdv">${numFmt(r.waterConsumption,1)}</span><span class="rdu"> L</span></td><td><span class="rdv">${numFmt(r.waterConsumption/r.fabricWeight,2)}</span><span class="rdu"> L/kg</span></td></tr>
          <tr><td>${T("thermalResultLabel")}</td><td><span class="rdv">${numFmt(r.thermalEnergy,2)}</span><span class="rdu"> kWh</span></td><td><span class="rdv">${numFmt(r.thermalEnergy/r.fabricWeight,3)}</span><span class="rdu"> kWh/kg</span></td></tr>
          <tr><td>${T("electricityResultLabel")}</td><td><span class="rdv">${numFmt(r.totalElectricityConsumption,2)}</span><span class="rdu"> kWh</span></td><td><span class="rdv">${numFmt(r.totalElectricityConsumption/r.fabricWeight,3)}</span><span class="rdu"> kWh/kg</span></td></tr>
          <tr><td>${T("steamResultLabel")}</td><td><span class="rdv">${numFmt(r.steamConsumption,1)}</span><span class="rdu"> kg</span></td><td><span class="rdv">${numFmt(r.steamConsumption/r.fabricWeight,3)}</span><span class="rdu"> kg/kg</span></td></tr>
          <tr><td>${T("fuelResultLabel")}</td><td><span class="rdv">${numFmt(r.fuelConsumption,2)}</span><span class="rdu"> kg</span></td><td><span class="rdv">${numFmt(r.fuelConsumption/r.fabricWeight,3)}</span><span class="rdu"> kg/kg</span></td></tr>
          <tr><td>${T("electricityCarbonLabel")}</td><td><span class="rdv">${numFmt(r.electricityCarbonEmissions,2)}</span><span class="rdu"> kg</span></td><td><span class="rdv">${numFmt(r.electricityCarbonEmissions/r.fabricWeight,3)}</span><span class="rdu"> kg/kg</span></td></tr>
          <tr><td>${T("fuelCarbonLabel")}</td><td><span class="rdv">${numFmt(r.fuelCarbonEmissions,2)}</span><span class="rdu"> kg</span></td><td><span class="rdv">${numFmt(r.fuelCarbonEmissions/r.fabricWeight,3)}</span><span class="rdu"> kg/kg</span></td></tr>
          <tr><td>${T("carbonResultLabel")}</td><td><span class="rdv">${numFmt(r.carbonEmissions,2)}</span><span class="rdu"> kg</span></td><td><span class="rdv">${numFmt(r.carbonEmissions/r.fabricWeight,3)}</span><span class="rdu"> kg/kg</span></td></tr>
          <tr><td>${T("timeResultLabel")}</td><td colspan="2"><span class="rdv">${numFmt(r.totalProcessTime,1)}</span><span class="rdu"> ${state.lang==="en"?"min":"分鐘"}</span></td></tr>
        </tbody>
      </table>
    </div>
  `).join("")}</div>`;

  if(results.length >= 2){
    document.getElementById("waterBarWrap").innerHTML = renderGroupedBarSVG(
      [{ label: state.lang==="en" ? "Water (L/kg)" : "用水量 (L/kg)", values: results.map(r=>r.waterConsumption/r.fabricWeight) }],
      results.map(r=>r.name)
    );
    document.getElementById("energyBarWrap").innerHTML = renderGroupedBarSVG(
      [
        { label: state.lang==="en" ? "Thermal (kWh/kg)" : "熱能 (kWh/kg)", values: results.map(r=>r.thermalEnergy/r.fabricWeight) },
        { label: state.lang==="en" ? "Electricity (kWh/kg)" : "電力 (kWh/kg)", values: results.map(r=>r.totalElectricityConsumption/r.fabricWeight) },
        { label: state.lang==="en" ? "CO₂ (kg/kg)" : "CO₂ (kg/kg)", values: results.map(r=>r.carbonEmissions/r.fabricWeight) }
      ],
      results.map(r=>r.name)
    );
  }
}

// 分組長條圖：每個「類別」底下並排各流程的長條，方便互相比較
function renderGroupedBarSVG(categories, processNames){
  const svgW = 340;
  const svgH = 225;
  const padL = 44;
  const padR = 16;
  const padT = 26;
  const padB = 44; // Increased bottom padding for 2-line category labels
  const legendH = 22;

  const plotW = svgW - padL - padR; // 280
  const plotH = svgH - padT - padB - legendH; // 133

  const allVals = categories.flatMap(c => c.values);
  let maxVal = Math.max(...allVals, 0.001) * 1.22;
  if(!isFinite(maxVal) || maxVal === 0) maxVal = 1.0;

  const yOf = (v) => padT + plotH - (v / maxVal) * plotH;

  const numCats = categories.length;
  const numProcs = Math.max(1, processNames.length);

  let barW, barGap, groupW;
  if(numCats === 1){
    barW = Math.min(36, Math.max(20, Math.floor(110 / numProcs)));
    barGap = 8;
    groupW = numProcs * barW + (numProcs - 1) * barGap;
  } else {
    const catW = plotW / numCats;
    barW = Math.min(22, Math.max(10, Math.floor((catW - 16) / numProcs)));
    barGap = 4;
    groupW = numProcs * barW + (numProcs - 1) * barGap;
  }

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" style="display:block;width:100%;height:auto;font-family:inherit;">`;

  // Grid lines & Y axis ticks
  for(let i = 0; i <= 4; i++){
    const v = maxVal * i / 4;
    const y = yOf(v);
    svg += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${(padL+plotW).toFixed(1)}" y2="${y.toFixed(1)}" stroke="#E3E1DC" stroke-width="1" stroke-dasharray="3,3"/>`;
    const vStr = v < 10 ? numFmt(v, 1) : numFmt(v, 0);
    svg += `<text x="${padL-6}" y="${(y+3.5).toFixed(1)}" font-size="9.5" font-weight="500" font-family="var(--font-num)" fill="#6B6862" text-anchor="end">${vStr}</text>`;
  }

  // Base X Axis Line
  svg += `<line x1="${padL}" y1="${(padT+plotH).toFixed(1)}" x2="${(padL+plotW).toFixed(1)}" y2="${(padT+plotH).toFixed(1)}" stroke="#C9C6BF" stroke-width="1"/>`;

  // Bars & Category Labels
  categories.forEach((cat, ci) => {
    let groupCenterX;
    if(numCats === 1){
      groupCenterX = padL + plotW / 2;
    } else {
      const catW = plotW / numCats;
      groupCenterX = padL + ci * catW + catW / 2;
    }
    const groupStartX = groupCenterX - groupW / 2;

    cat.values.forEach((v, pi) => {
      const color = CHART_COLORS[pi % CHART_COLORS.length];
      const x = groupStartX + pi * (barW + barGap);
      const y = yOf(v);
      const h = Math.max(1.0, padT + plotH - y);

      // Semi-transparent bar with rounded top
      svg += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" fill="${color}" rx="3" ry="3"/>`;

      // Value label on top of bar
      const vText = v < 10 ? numFmt(v, 2) : numFmt(v, 1);
      svg += `<text x="${(x + barW / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" font-size="9" font-weight="700" font-family="var(--font-num)" fill="${color}" text-anchor="middle">${vText}</text>`;
    });

    // Category Label - split into title & unit to prevent X-axis text overlap
    const rawLabel = cat.label || "";
    const match = rawLabel.trim().match(/^(.*?)\s*(\([^)]+\))$/);
    const startY = padT + plotH + 15;
    if (match) {
      const title = match[1];
      const unit = match[2];
      svg += `<text x="${groupCenterX.toFixed(1)}" y="${startY.toFixed(1)}" font-size="9.5" font-weight="700" fill="#1C1B19" text-anchor="middle">${escapeHtmlE(title)}</text>`;
      svg += `<text x="${groupCenterX.toFixed(1)}" y="${(startY + 12).toFixed(1)}" font-size="8.5" font-weight="500" fill="#6B6862" text-anchor="middle">${escapeHtmlE(unit)}</text>`;
    } else {
      svg += `<text x="${groupCenterX.toFixed(1)}" y="${(startY + 4).toFixed(1)}" font-size="10" font-weight="700" fill="#1C1B19" text-anchor="middle">${escapeHtmlE(rawLabel)}</text>`;
    }
  });

  // Legend at Bottom
  const legendY = padT + plotH + padB + 2;
  let legendX = padL;
  processNames.forEach((name, pi) => {
    const color = CHART_COLORS[pi % CHART_COLORS.length];
    svg += `<circle cx="${(legendX + 5).toFixed(1)}" cy="${(legendY + 4).toFixed(1)}" r="4" fill="${color}"/>`;
    svg += `<text x="${(legendX + 13).toFixed(1)}" y="${(legendY + 7).toFixed(1)}" font-size="10" font-weight="600" fill="#6B6862">${escapeHtmlE(name)}</text>`;
    legendX += 13 + name.length * 7.5 + 14;
  });

  svg += `</svg>`;
  return svg;
}




  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(err => {
        console.error("Service Worker 註冊失敗:", err);
      });
    });
  }

