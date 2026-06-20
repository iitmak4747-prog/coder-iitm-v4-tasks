// ===== CODER IITM — popup.js v3.0 =====
// Classic Premium | 100% Accurate Live Tracking | Day-wise Line Graph

// ---- Tab Navigation ----
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(s => s.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
  });
});

// =============================================
// HELPERS
// =============================================

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getDateKey(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function fmtSec(s) {
  s = Math.max(0, Math.round(s));
  if (s < 60) return s + "s";
  if (s < 3600) {
    const m = Math.floor(s/60), r = s%60;
    return r > 0 ? `${m}m ${r}s` : `${m}m`;
  }
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), r = s%60;
  return r > 0 ? `${h}h ${m}m ${r}s` : `${h}h ${m}m`;
}

function fmtShort(s) {
  s = Math.max(0, Math.round(s));
  if (s === 0) return "0s";
  if (s < 60) return s + "s";
  if (s < 3600) return Math.floor(s/60) + "m";
  return Math.floor(s/3600) + "h" + (Math.floor((s%3600)/60) > 0 ? Math.floor((s%3600)/60)+"m" : "");
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// =============================================
// TRACK TAB
// =============================================

let liveInterval = null;
let selectedDate = getTodayKey();
let lastLive = null;

// ---- Build date picker (last 7 days) ----
function buildDatePicker() {
  const picker = document.getElementById("datePicker");
  picker.innerHTML = "";
  for (let i = 0; i < 7; i++) {
    const key = getDateKey(i);
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = i === 0 ? "Today" : i === 1 ? "Yesterday" : key;
    picker.appendChild(opt);
  }
  picker.addEventListener("change", () => {
    selectedDate = picker.value;
    renderTrack(lastLive);
  });
}

// ---- Today's Breakdown Bar Chart ----
function drawChart(studySec, wasteSec, totalSec) {
  const canvas = document.getElementById("chart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const cBg2   = cssVar("--bg2")    || "#16161a";
  const cBg3   = cssVar("--bg3")    || "#1e1e24";
  const cBord  = cssVar("--border2")|| "#2e2e3a";
  const cMuted = cssVar("--text3")  || "#5e5a52";
  const cGold  = cssVar("--gold")   || "#c9a84c";
  const cGreen = cssVar("--green")  || "#4caf82";
  const cRed   = cssVar("--red")    || "#c0564a";

  ctx.fillStyle = cBg2;
  ctx.fillRect(0, 0, W, H);

  const leftM = 42, rightM = 14, topM = 20, bottomM = 22;
  const plotW = W - leftM - rightM;
  const plotH = H - topM - bottomM;

  const bars = [
    { label: "Study",  val: studySec,  color: cGreen },
    { label: "Waste",  val: wasteSec,  color: cRed   },
    { label: "Total",  val: totalSec,  color: cGold  },
  ];

  const maxVal = Math.max(totalSec, 1) * 1.2;

  // Gridlines
  ctx.strokeStyle = cBord;
  ctx.lineWidth = 1;
  [0, 0.5, 1].forEach(f => {
    const gy = topM + plotH * (1 - f);
    ctx.setLineDash([3,4]);
    ctx.beginPath();
    ctx.moveTo(leftM, gy);
    ctx.lineTo(W - rightM, gy);
    ctx.stroke();
    // Y-axis label
    if (f > 0) {
      ctx.setLineDash([]);
      ctx.fillStyle = cMuted;
      ctx.font = `9px 'JetBrains Mono', monospace`;
      ctx.textAlign = "right";
      ctx.fillText(fmtShort(maxVal * f), leftM - 4, gy + 3);
    }
  });
  ctx.setLineDash([]);

  // Bars
  const barW = Math.floor(plotW / bars.length * 0.45);
  const gap   = plotW / bars.length;

  bars.forEach((bar, i) => {
    const x = leftM + gap * i + (gap - barW) / 2;
    const barH = bar.val > 0 ? Math.max(2, (bar.val / maxVal) * plotH) : 0;
    const y = topM + plotH - barH;

    // Bar fill with gradient
    const grad = ctx.createLinearGradient(0, y, 0, y + barH);
    grad.addColorStop(0, bar.color);
    grad.addColorStop(1, bar.color + "44");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, barW, barH, [3,3,0,0]) : ctx.rect(x, y, barW, barH);
    ctx.fill();

    // Value label above bar
    ctx.fillStyle = bar.color;
    ctx.font = `bold 9px 'JetBrains Mono', monospace`;
    ctx.textAlign = "center";
    ctx.fillText(fmtShort(bar.val), x + barW / 2, Math.max(topM - 2, y - 4));

    // X label
    ctx.fillStyle = cMuted;
    ctx.font = `9px 'JetBrains Mono', monospace`;
    ctx.textAlign = "center";
    ctx.fillText(bar.label, x + barW / 2, H - 6);
  });
}

// ---- 7-Day Line Graph ----
async function drawDayGraph(liveData) {
  const canvas = document.getElementById("dayGraph");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const cBg2   = cssVar("--bg2")    || "#16161a";
  const cBord  = cssVar("--border2")|| "#2e2e3a";
  const cMuted = cssVar("--text3")  || "#5e5a52";
  const cGold  = cssVar("--gold")   || "#c9a84c";
  const cGreen = cssVar("--green")  || "#4caf82";

  ctx.fillStyle = cBg2;
  ctx.fillRect(0, 0, W, H);

  const r = await chrome.storage.local.get(["timeData", "siteCategories"]);
  const timeData = r.timeData || {};
  const cats = r.siteCategories || {};

  // Build 7 days of data (oldest → newest)
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const key = getDateKey(i);
    const dayData = { ...(timeData[key] || {}) };

    // Merge live for today
    if (i === 0 && liveData && liveData.domain) {
      dayData[liveData.domain] = (dayData[liveData.domain] || 0) + (liveData.elapsedSeconds || 0);
    }

    let total = 0, study = 0;
    Object.entries(dayData).forEach(([dom, secs]) => {
      total += secs;
      if ((cats[dom] || "waste") === "study") study += secs;
    });
    days.push({ key, total, study, label: i === 0 ? "Today" : key.slice(5) });
  }

  const leftM = 38, rightM = 12, topM = 12, bottomM = 18;
  const plotW = W - leftM - rightM;
  const plotH = H - topM - bottomM;
  const maxVal = Math.max(...days.map(d => d.total), 1) * 1.2;

  const xAt = i => leftM + (plotW / (days.length - 1)) * i;
  const yAt = v => topM + plotH - (v / maxVal) * plotH;

  // Grid
  ctx.strokeStyle = cBord;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 4]);
  [0, 0.5, 1].forEach(f => {
    const gy = topM + plotH * (1 - f);
    ctx.beginPath(); ctx.moveTo(leftM, gy); ctx.lineTo(W - rightM, gy); ctx.stroke();
  });
  ctx.setLineDash([]);

  // Draw total line (gold)
  function drawLine(dataKey, color, fill) {
    ctx.beginPath();
    days.forEach((d, i) => {
      const x = xAt(i), y = yAt(d[dataKey]);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.stroke();

    if (fill) {
      ctx.lineTo(xAt(days.length - 1), yAt(0));
      ctx.lineTo(xAt(0), yAt(0));
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, topM, 0, topM + plotH);
      grad.addColorStop(0, color + "30");
      grad.addColorStop(1, color + "00");
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Dots
    days.forEach((d, i) => {
      const x = xAt(i), y = yAt(d[dataKey]);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });
  }

  drawLine("total", cGold, true);
  drawLine("study", cGreen, false);

  // X labels
  ctx.fillStyle = cMuted;
  ctx.font = `8px 'JetBrains Mono', monospace`;
  ctx.textAlign = "center";
  days.forEach((d, i) => {
    ctx.fillText(d.label.slice(-5), xAt(i), H - 4);
  });

  // Y axis label (top)
  ctx.fillStyle = cMuted;
  ctx.font = `8px 'JetBrains Mono', monospace`;
  ctx.textAlign = "left";
  ctx.fillText(fmtShort(maxVal), 2, topM + 8);
}

// ---- Site List ----
function renderSiteList(dayData, categories, liveData) {
  const list = document.getElementById("siteList");
  list.innerHTML = "";

  let display = { ...dayData };
  if (liveData && liveData.domain && selectedDate === getTodayKey()) {
    const d = liveData.domain;
    display[d] = (display[d] || 0) + (liveData.elapsedSeconds || 0);
  }

  const sorted = Object.entries(display).sort((a, b) => b[1] - a[1]);
  if (!sorted.length) {
    list.innerHTML = '<div class="empty-state">No data yet. Start browsing!</div>';
    return;
  }

  sorted.forEach(([domain, secs]) => {
    const cat = categories[domain] || "waste";
    const isStudy = cat === "study";

    const row = document.createElement("div");
    row.className = `site-row ${isStudy ? "is-study" : "is-waste"}`;

    const isLive = liveData && liveData.domain === domain && selectedDate === getTodayKey();
    const liveDot = isLive ? `<span class="live-dot" style="width:5px;height:5px;margin-right:3px;flex-shrink:0"></span>` : "";

    row.innerHTML = `
      ${liveDot}
      <span class="site-name" title="${domain}">${domain}</span>
      <span class="site-time">${fmtSec(secs)}</span>
      <button class="toggle-btn ${isStudy ? "study" : "waste"}"
        data-domain="${domain}" data-current="${cat}">
        ${isStudy ? "📗 Study" : "📕 Waste"}
      </button>`;

    row.querySelector(".toggle-btn").addEventListener("click", async (e) => {
      const d = e.currentTarget.dataset.domain;
      const cur = e.currentTarget.dataset.current;
      const next = cur === "study" ? "waste" : "study";
      const r = await chrome.storage.local.get("siteCategories");
      const cats = r.siteCategories || {};
      cats[d] = next;
      await chrome.storage.local.set({ siteCategories: cats });
      renderTrack(lastLive);
    });

    list.appendChild(row);
  });
}

// ---- Main Render ----
async function renderTrack(liveData) {
  const r = await chrome.storage.local.get(["timeData", "siteCategories"]);
  const timeData = r.timeData || {};
  const cats = r.siteCategories || {};
  const dayData = timeData[selectedDate] || {};

  let display = { ...dayData };
  if (liveData && liveData.domain && selectedDate === getTodayKey()) {
    const d = liveData.domain;
    display[d] = (display[d] || 0) + (liveData.elapsedSeconds || 0);
  }

  let studySec = 0, wasteSec = 0;
  Object.entries(display).forEach(([domain, secs]) => {
    if ((cats[domain] || "waste") === "study") studySec += secs;
    else wasteSec += secs;
  });
  const totalSec = studySec + wasteSec;

  document.getElementById("totalUsage").textContent = "⏱ " + fmtSec(totalSec);

  drawChart(studySec, wasteSec, totalSec);
  await drawDayGraph(liveData);
  renderSiteList(dayData, cats, liveData);
}

// ---- Live Updater (every 1 second) ----
function startLive() {
  if (liveInterval) return;
  liveInterval = setInterval(async () => {
    try {
      const resp = await chrome.runtime.sendMessage({ type: "GET_LIVE_STATUS" });
      lastLive = resp;
      document.getElementById("liveDomain").textContent = resp.domain || "—";
      document.getElementById("liveTime").textContent   = fmtSec(resp.elapsedSeconds);
      renderTrack(resp);
    } catch {}
  }, 1000);
}

buildDatePicker();
renderTrack(null);
startLive();

// =============================================
// BLOCK TAB
// =============================================

async function loadBlockList() {
  const list = document.getElementById("blockList");
  list.innerHTML = "";
  let resp;
  try { resp = await chrome.runtime.sendMessage({ type: "GET_BLOCKED_SITES" }); }
  catch { return; }
  const sites = resp.sites || [];
  if (!sites.length) {
    list.innerHTML = '<li style="padding:10px;color:var(--text3);font-size:11px;font-family:monospace">No sites blocked.</li>';
    return;
  }
  sites.forEach(site => {
    const li = document.createElement("li");
    li.className = "block-item";
    li.innerHTML = `<span>${site}</span><button class="rm-btn" data-site="${site}">Remove</button>`;
    li.querySelector(".rm-btn").addEventListener("click", async () => {
      const newSites = sites.filter(s => s !== site);
      await chrome.runtime.sendMessage({ type: "SET_BLOCKED_SITES", sites: newSites });
      loadBlockList();
    });
    list.appendChild(li);
  });
}

document.getElementById("addBlockBtn").addEventListener("click", async () => {
  const inp = document.getElementById("blockInput");
  const val = inp.value.trim().toLowerCase().replace(/^www\./, "").replace(/\/.*$/, "");
  if (!val || !val.includes(".")) return;
  const resp = await chrome.runtime.sendMessage({ type: "GET_BLOCKED_SITES" });
  const sites = resp.sites || [];
  if (!sites.includes(val)) {
    sites.push(val);
    await chrome.runtime.sendMessage({ type: "SET_BLOCKED_SITES", sites });
  }
  inp.value = "";
  loadBlockList();
});

document.getElementById("blockInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("addBlockBtn").click();
});

loadBlockList();

// =============================================
// SPEED TAB
// =============================================

const slider   = document.getElementById("speedSlider");
const speedVal = document.getElementById("speedVal");

function updateSpeedDisplay(val) {
  const n = parseFloat(val);
  speedVal.textContent = Number.isInteger(n) ? n.toFixed(1) : n.toFixed(2).replace(/0+$/, "");
}

slider.addEventListener("input", () => updateSpeedDisplay(slider.value));

document.querySelectorAll(".preset-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const spd = parseFloat(btn.dataset.speed);
    slider.value = spd;
    updateSpeedDisplay(spd);
    document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

document.getElementById("applySpeed").addEventListener("click", async () => {
  const spd = parseFloat(slider.value);
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (rate) => { document.querySelectorAll("video, audio").forEach(el => el.playbackRate = rate); },
      args: [spd]
    });
  } catch(e) { console.warn("Speed inject failed:", e.message); }
});

// =============================================
// POMO TAB
// =============================================

const RING_CIRCUM = 339.3;
let pomoUI = { running: false, phase: "study", remaining: 25*60, endTime: null, studySec: 25*60, breakSec: 5*60 };
let pomoTickInterval = null;

function playAlarm(type) {
  try {
    const ctx2 = new (window.AudioContext || window.webkitAudioContext)();
    const freqs = type === "study" ? [880, 660, 440] : [440, 660, 880];
    freqs.forEach((f, i) => {
      const osc = ctx2.createOscillator(), gain = ctx2.createGain();
      osc.connect(gain); gain.connect(ctx2.destination);
      osc.type = "sine"; osc.frequency.value = f;
      const t = ctx2.currentTime + i * 0.25;
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.start(t); osc.stop(t + 0.4);
    });
  } catch {}
}

async function loadPomoHistory() {
  const histEl = document.getElementById("pomoHistory");
  const r = await chrome.storage.local.get("pomoHistory");
  const history = r.pomoHistory || {};
  const items = history[getTodayKey()] || [];
  if (!items.length) {
    histEl.innerHTML = '<div class="empty-state">No sessions yet today.</div>';
    return;
  }
  histEl.innerHTML = items.map(item => `
    <div class="pomo-hist-item">
      <span class="ph-type ${item.phase}">${item.phase === "study" ? "📗 Study" : "☕ Break"}</span>
      <span>completed</span>
      <span class="ph-time">${item.time}</span>
    </div>`).join("");
}

function updatePomoUI() {
  const min = String(Math.floor(pomoUI.remaining / 60)).padStart(2, "0");
  const sec = String(pomoUI.remaining % 60).padStart(2, "0");
  document.getElementById("pomoTime").textContent  = `${min}:${sec}`;
  document.getElementById("pomoLabel").textContent = pomoUI.phase === "study" ? "STUDY" : "BREAK";

  const total  = pomoUI.phase === "study" ? (pomoUI.studySec || 25*60) : (pomoUI.breakSec || 5*60);
  const offset = RING_CIRCUM * (pomoUI.remaining / total);
  const ring   = document.getElementById("ringProgress");
  ring.style.strokeDashoffset = RING_CIRCUM - offset;
  ring.style.stroke = pomoUI.phase === "study"
    ? (cssVar("--gold")  || "#c9a84c")
    : (cssVar("--green") || "#4caf82");

  const total2 = pomoUI.phase === "study" ? (pomoUI.studySec || 25*60) : (pomoUI.breakSec || 5*60);
  document.getElementById("pomoStart").textContent = pomoUI.running
    ? "⏸ Pause"
    : (pomoUI.remaining < total2 ? "▶ Resume" : "▶ Start");

  // Sync inputs
  if (!pomoUI.running) {
    document.getElementById("studyMinInput").value = Math.round((pomoUI.studySec || 25*60) / 60);
    document.getElementById("breakMinInput").value = Math.round((pomoUI.breakSec || 5*60) / 60);
  }
}

function startTick() {
  stopTick();
  pomoTickInterval = setInterval(() => {
    if (!pomoUI.running || !pomoUI.endTime) return;
    pomoUI.remaining = Math.max(0, Math.round((pomoUI.endTime - Date.now()) / 1000));
    updatePomoUI();
  }, 1000);
}
function stopTick() {
  if (pomoTickInterval) { clearInterval(pomoTickInterval); pomoTickInterval = null; }
}

function applyPomoState(state) {
  const prevPhase  = pomoUI.phase;
  const wasRunning = pomoUI.running;
  pomoUI = { ...state };
  if (pomoUI.running && pomoUI.endTime) {
    pomoUI.remaining = Math.max(0, Math.round((pomoUI.endTime - Date.now()) / 1000));
    startTick();
  } else {
    stopTick();
  }
  updatePomoUI();
  if (wasRunning && !pomoUI.running) {
    document.getElementById("pomoStatus").textContent =
      prevPhase === "study" ? "✅ Study complete! Take a break." : "⏰ Break over! Back to work.";
    playAlarm(prevPhase);
    loadPomoHistory();
  }
}

async function syncPomoState() {
  try {
    const state = await chrome.runtime.sendMessage({ type: "POMO_GET_STATE" });
    applyPomoState(state);
  } catch {}
}

document.getElementById("pomoStart").addEventListener("click", async () => {
  if (pomoUI.running) {
    const state = await chrome.runtime.sendMessage({ type: "POMO_PAUSE" });
    applyPomoState(state);
    document.getElementById("pomoStatus").textContent = "Paused.";
  } else {
    const state = await chrome.runtime.sendMessage({ type: "POMO_START" });
    applyPomoState(state);
    document.getElementById("pomoStatus").textContent = "";
  }
});

document.getElementById("pomoReset").addEventListener("click", async () => {
  const state = await chrome.runtime.sendMessage({ type: "POMO_RESET" });
  applyPomoState(state);
  document.getElementById("pomoStatus").textContent = "";
});

// Pomodoro duration editor
document.getElementById("applyDurBtn").addEventListener("click", async () => {
  if (pomoUI.running) {
    document.getElementById("pomoStatus").textContent = "⚠ Stop timer before changing duration.";
    return;
  }
  const studyMin = parseInt(document.getElementById("studyMinInput").value) || 25;
  const breakMin = parseInt(document.getElementById("breakMinInput").value) || 5;
  const studySec = Math.max(1, studyMin) * 60;
  const breakSec = Math.max(1, breakMin) * 60;
  const state = await chrome.runtime.sendMessage({ type: "POMO_SET_DURATIONS", studySec, breakSec });
  applyPomoState(state);
  document.getElementById("pomoStatus").textContent = `✓ Set: ${studyMin}m study / ${breakMin}m break`;
  setTimeout(() => { document.getElementById("pomoStatus").textContent = ""; }, 2500);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.pomoState)   applyPomoState(changes.pomoState.newValue);
  if (changes.pomoHistory) loadPomoHistory();
});

syncPomoState();
loadPomoHistory();

// =============================================
// NOTES TAB
// =============================================

const notesArea  = document.getElementById("notesArea");
const savedBadge = document.getElementById("notesSaved");
let saveTimeout  = null;

chrome.storage.local.get("quickNotes").then(r => {
  notesArea.value = r.quickNotes || "";
  savedBadge.style.opacity = "0.6";
});

notesArea.addEventListener("input", () => {
  savedBadge.style.opacity = "0";
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    await chrome.storage.local.set({ quickNotes: notesArea.value });
    savedBadge.style.opacity = "0.8";
  }, 400);
});

// =============================================
// TASKS TAB — Block sites until tasks are done
// =============================================

async function loadTasks() {
  const r = await chrome.storage.local.get("tasks");
  return r.tasks || [];
}

async function saveTasks(tasks) {
  await chrome.storage.local.set({ tasks });
}

// Check if any tasks remain → block or unblock accordingly
async function syncTaskBlocking() {
  const tasks = await loadTasks();
  const hasPending = tasks.some(t => !t.done);

  // Get blocked sites list from background
  const r = await chrome.storage.local.get(["blockedSites", "taskBlockedSites"]);
  const blockedSites = r.blockedSites || [];
  const taskBlockedSites = r.taskBlockedSites || [];

  if (hasPending) {
    // If not already task-blocking, save current list and enable blocking
    if (taskBlockedSites.length === 0) {
      await chrome.storage.local.set({ taskBlockedSites: blockedSites });
    }
    // Ensure blocked sites list is active (restore from taskBlockedSites if empty)
    const activeSites = blockedSites.length > 0 ? blockedSites : taskBlockedSites;
    if (activeSites.length > 0) {
      chrome.runtime.sendMessage({ type: "SET_BLOCKED_SITES", sites: activeSites });
    }
  } else {
    // No pending tasks → sites stay as user configured, just update UI
  }

  updateTasksBlockUI(hasPending, tasks);
}

function updateTasksBlockUI(hasPending, tasks) {
  const statusEl = document.getElementById("tasksBlockStatus");
  const hintEl   = document.getElementById("taskHint");
  const emptyEl  = document.getElementById("taskEmpty");
  const listEl   = document.getElementById("taskList");

  if (!statusEl) return;

  const allDone = tasks.length > 0 && !hasPending;
  const noTasks = tasks.length === 0;

  if (noTasks) {
    statusEl.textContent = "🟢 No Tasks — Sites Free";
    statusEl.className = "tasks-block-status tasks-free";
    hintEl.style.display = "none";
    emptyEl.style.display = "block";
    listEl.style.display = "none";
  } else if (allDone) {
    statusEl.textContent = "🟢 All Done — Sites Unblocked!";
    statusEl.className = "tasks-block-status tasks-free";
    hintEl.textContent = "Great work! All tasks complete.";
    hintEl.style.display = "block";
    emptyEl.style.display = "none";
    listEl.style.display = "block";
  } else {
    statusEl.textContent = "🔴 Sites Blocked";
    statusEl.className = "tasks-block-status tasks-blocked";
    const pending = tasks.filter(t => !t.done).length;
    hintEl.textContent = `${pending} task${pending > 1 ? "s" : ""} remaining — complete them to unblock sites.`;
    hintEl.style.display = "block";
    emptyEl.style.display = "none";
    listEl.style.display = "block";
  }
}

async function renderTaskList() {
  const tasks = await loadTasks();
  const listEl = document.getElementById("taskList");
  if (!listEl) return;

  listEl.innerHTML = tasks.map((t, i) => `
    <li class="task-item ${t.done ? "task-done" : ""}">
      <button class="task-check-btn" data-idx="${i}" title="${t.done ? "Mark undone" : "Mark done"}">
        ${t.done ? "✅" : "⬜"}
      </button>
      <span class="task-text">${escapeHtml(t.text)}</span>
      <button class="task-del-btn" data-idx="${i}" title="Delete">✕</button>
    </li>
  `).join("");

  // Attach events
  listEl.querySelectorAll(".task-check-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const idx = parseInt(btn.dataset.idx);
      const tasks = await loadTasks();
      tasks[idx].done = !tasks[idx].done;
      await saveTasks(tasks);
      await renderTaskList();
      await syncTaskBlocking();
    });
  });

  listEl.querySelectorAll(".task-del-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const idx = parseInt(btn.dataset.idx);
      const tasks = await loadTasks();
      tasks.splice(idx, 1);
      await saveTasks(tasks);
      await renderTaskList();
      await syncTaskBlocking();
    });
  });

  await syncTaskBlocking();
}

function escapeHtml(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// Add task button
document.getElementById("addTaskBtn").addEventListener("click", async () => {
  const inp = document.getElementById("taskInput");
  const text = inp.value.trim();
  if (!text) return;
  const tasks = await loadTasks();
  tasks.push({ text, done: false, id: Date.now() });
  await saveTasks(tasks);
  inp.value = "";
  await renderTaskList();
  await syncTaskBlocking();
});

document.getElementById("taskInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("addTaskBtn").click();
});

// Initial render
renderTaskList();
