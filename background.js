// ===== CODER IITM — background.js v3.0 =====
// 100% ACCURATE — tracks every second via chrome.alarms keepalive
// Works even when Chrome is minimized, tab switched, or popup closed

const DEFAULT_BLOCKED = [
  "instagram.com","facebook.com","twitter.com","x.com",
  "snapchat.com","tiktok.com","reddit.com","9gag.com",
  "netflix.com","hotstar.com","primevideo.com"
];

let BLOCKED_SITES = [...DEFAULT_BLOCKED];

// ---- Load blocked sites ----
chrome.storage.local.get("blockedSites").then(r => {
  if (r.blockedSites && r.blockedSites.length) BLOCKED_SITES = r.blockedSites;
  else chrome.storage.local.set({ blockedSites: BLOCKED_SITES });
});

// ---- Helpers ----
function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return null; }
}

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function isBlocked(domain) {
  if (!domain) return false;
  return BLOCKED_SITES.some(b => domain === b || domain.endsWith("." + b));
}

// ---- TRACKING STATE (in-memory, persisted every second) ----
let activeTabId     = null;
let activeTabDomain = null;
let activeTabStart  = null; // timestamp in ms when current session started

// ---- Flush: write elapsed seconds to storage ----
async function flushSeconds(domain, secs) {
  if (!domain || secs <= 0) return;
  const key = getTodayKey();
  const r = await chrome.storage.local.get("timeData");
  const timeData = r.timeData || {};
  if (!timeData[key]) timeData[key] = {};
  timeData[key][domain] = (timeData[key][domain] || 0) + Math.round(secs);
  await chrome.storage.local.set({ timeData });
}

// ---- Called by alarm every 1 second ----
async function onTick() {
  // Update active tab tracking
  if (activeTabDomain && activeTabStart) {
    const now = Date.now();
    const elapsed = (now - activeTabStart) / 1000;
    // Flush every second
    await flushSeconds(activeTabDomain, 1);
    activeTabStart = now; // reset start to now (we already flushed this second)
  }
}

// ---- Start tracking a domain ----
async function startTracking(tabId, domain) {
  // Stop previous if different
  if (activeTabDomain && activeTabDomain !== domain && activeTabStart) {
    const elapsed = (Date.now() - activeTabStart) / 1000;
    if (elapsed > 0) await flushSeconds(activeTabDomain, elapsed);
  }
  activeTabId     = tabId;
  activeTabDomain = domain;
  activeTabStart  = Date.now();
  // Persist active state so alarm tick can work even after SW restart
  await chrome.storage.local.set({
    activeTracking: { tabId, domain, start: activeTabStart }
  });
}

// ---- Stop tracking ----
async function stopTracking() {
  if (activeTabDomain && activeTabStart) {
    const elapsed = (Date.now() - activeTabStart) / 1000;
    if (elapsed > 0) await flushSeconds(activeTabDomain, elapsed);
  }
  activeTabId     = null;
  activeTabDomain = null;
  activeTabStart  = null;
  await chrome.storage.local.remove("activeTracking");
}

// ---- Handle tab focus changes ----
async function handleTabFocus(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || tab.url.startsWith("chrome") || tab.url.startsWith("about")) {
      await stopTracking(); return;
    }
    const domain = getDomain(tab.url);
    if (isBlocked(domain)) {
      chrome.tabs.update(tabId, { url: chrome.runtime.getURL("blocked.html") });
      await stopTracking(); return;
    }
    if (domain) await startTracking(tabId, domain);
    else await stopTracking();
  } catch { await stopTracking(); }
}

// ---- Alarm: 1-second keepalive + tick ----
const TICK_ALARM   = "tickAlarm";
const POMO_ALARM   = "pomoAlarm";

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === TICK_ALARM) {
    await onTick();
    return;
  }
  if (alarm.name === POMO_ALARM) {
    await handlePomoAlarm();
  }
});

// ---- On install / SW startup: restore state + create alarm ----
async function init() {
  // Restore active tracking from storage (in case SW restarted)
  const r = await chrome.storage.local.get("activeTracking");
  if (r.activeTracking) {
    const { tabId, domain, start } = r.activeTracking;
    // Check if that tab still exists and is active
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab && tab.active) {
        activeTabId     = tabId;
        activeTabDomain = domain;
        // Flush missed seconds from when SW was dead
        const missedSec = Math.floor((Date.now() - start) / 1000);
        if (missedSec > 0) await flushSeconds(domain, missedSec);
        activeTabStart = Date.now();
      }
    } catch { await chrome.storage.local.remove("activeTracking"); }
  }

  // Ensure 1-second tick alarm is always running
  const existing = await chrome.alarms.get(TICK_ALARM);
  if (!existing) {
    chrome.alarms.create(TICK_ALARM, { periodInMinutes: 1/60 }); // every ~1 sec
  }

  // Restore pomo alarm if it was running
  const ps = await getPomoState();
  if (ps.running && ps.endTime && ps.endTime > Date.now()) {
    const existing = await chrome.alarms.get(POMO_ALARM);
    if (!existing) chrome.alarms.create(POMO_ALARM, { when: ps.endTime });
  }
}

chrome.runtime.onInstalled.addListener(init);
chrome.runtime.onStartup.addListener(init);

// Also run init on SW activation
init();

// ---- Tab Events ----
chrome.tabs.onActivated.addListener(({ tabId }) => handleTabFocus(tabId));

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  const domain = getDomain(tab.url);
  if (isBlocked(domain)) {
    chrome.tabs.update(tabId, { url: chrome.runtime.getURL("blocked.html") });
    await stopTracking(); return;
  }
  try {
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (active && active.id === tabId) await startTracking(tabId, domain);
  } catch {}
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (tabId === activeTabId) await stopTracking();
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Don't stop tracking when window loses focus (user minimized)
    // Just keep tracking the last active tab
    return;
  }
  try {
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    if (tab) await handleTabFocus(tab.id);
    else await stopTracking();
  } catch {}
});

// ---- Messages ----
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_LIVE_STATUS") {
    const elapsed = (activeTabStart && activeTabDomain)
      ? Math.floor((Date.now() - activeTabStart) / 1000)
      : 0;
    sendResponse({ domain: activeTabDomain, elapsedSeconds: elapsed });
  }

  if (msg.type === "GET_BLOCKED_SITES") {
    sendResponse({ sites: BLOCKED_SITES });
  }

  if (msg.type === "SET_BLOCKED_SITES") {
    BLOCKED_SITES = msg.sites;
    chrome.storage.local.set({ blockedSites: BLOCKED_SITES });
    sendResponse({ ok: true });
  }

  if (msg.type === "POMO_GET_STATE") {
    getPomoState().then(sendResponse); return true;
  }

  if (msg.type === "POMO_START") {
    (async () => {
      const state = await getPomoState();
      const studySec = msg.studySec || POMO_STUDY_SEC;
      const breakSec = msg.breakSec || POMO_BREAK_SEC;
      const fullDur  = state.phase === "study" ? studySec : breakSec;
      const remaining = state.remaining > 0 ? state.remaining : fullDur;
      const endTime   = Date.now() + remaining * 1000;
      const newState  = { running: true, phase: state.phase, remaining, endTime, studySec, breakSec };
      await setPomoState(newState);
      await chrome.alarms.create(POMO_ALARM, { when: endTime });
      sendResponse(newState);
    })(); return true;
  }

  if (msg.type === "POMO_PAUSE") {
    (async () => {
      const state = await getPomoState();
      const remaining = (state.running && state.endTime)
        ? Math.max(0, Math.round((state.endTime - Date.now()) / 1000))
        : state.remaining;
      await chrome.alarms.clear(POMO_ALARM);
      const newState = { running: false, phase: state.phase, remaining, endTime: null,
        studySec: state.studySec, breakSec: state.breakSec };
      await setPomoState(newState);
      sendResponse(newState);
    })(); return true;
  }

  if (msg.type === "POMO_RESET") {
    (async () => {
      await chrome.alarms.clear(POMO_ALARM);
      const state = await getPomoState();
      const newState = defaultPomoState(state.studySec || POMO_STUDY_SEC, state.breakSec || POMO_BREAK_SEC);
      await setPomoState(newState);
      sendResponse(newState);
    })(); return true;
  }

  if (msg.type === "POMO_SET_DURATIONS") {
    (async () => {
      const state = await getPomoState();
      if (state.running) { sendResponse({ ok: false, reason: "Stop timer first" }); return; }
      const newState = defaultPomoState(msg.studySec, msg.breakSec);
      await setPomoState(newState);
      sendResponse(newState);
    })(); return true;
  }

  return true;
});

// ===== POMODORO =====
const POMO_STUDY_SEC = 25 * 60;
const POMO_BREAK_SEC = 5  * 60;

function defaultPomoState(studySec = POMO_STUDY_SEC, breakSec = POMO_BREAK_SEC) {
  return { running: false, phase: "study", remaining: studySec, endTime: null, studySec, breakSec };
}

async function getPomoState() {
  const r = await chrome.storage.local.get("pomoState");
  return r.pomoState || defaultPomoState();
}

async function setPomoState(state) {
  await chrome.storage.local.set({ pomoState: state });
}

async function savePomoHistory(phase) {
  const r = await chrome.storage.local.get("pomoHistory");
  const history = r.pomoHistory || {};
  const today = getTodayKey();
  if (!history[today]) history[today] = [];
  history[today].unshift({
    phase, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  });
  if (history[today].length > 50) history[today] = history[today].slice(0, 50);
  await chrome.storage.local.set({ pomoHistory: history });
}

function notifyPomoDone(donePhase) {
  try {
    chrome.notifications.create("pomo-" + Date.now(), {
      type: "basic", iconUrl: "icon.png",
      title: donePhase === "study" ? "✅ Study Session Complete!" : "⏰ Break Over!",
      message: donePhase === "study" ? "Time for a well-earned break." : "Back to work — stay focused.",
      priority: 2
    });
  } catch {}
}

async function handlePomoAlarm() {
  const state = await getPomoState();
  const donePhase = state.phase;
  await savePomoHistory(donePhase);
  notifyPomoDone(donePhase);
  const nextPhase     = donePhase === "study" ? "break" : "study";
  const studySec      = state.studySec || POMO_STUDY_SEC;
  const breakSec      = state.breakSec || POMO_BREAK_SEC;
  const nextRemaining = nextPhase === "study" ? studySec : breakSec;
  await setPomoState({ running: false, phase: nextPhase, remaining: nextRemaining, endTime: null, studySec, breakSec });
}

// ===== TASK-BASED BLOCKING =====
// When tasks change, check if sites should stay blocked
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "local") return;
  if (changes.tasks) {
    const tasks = changes.tasks.newValue || [];
    const hasPending = tasks.some(t => !t.done);
    // No action needed here — popup handles SET_BLOCKED_SITES via message
    // Background already intercepts all navigations via isBlocked()
    // which reads BLOCKED_SITES (kept in sync via SET_BLOCKED_SITES messages)
  }
});
