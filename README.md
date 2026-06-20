# coder-iitm-v4-tasks
All-in-one Chrome extension for focused work — track time, block distractions, manage tasks, Pomodoro timer, video speed booster &amp; quick notes. Sites stay blocked until your tasks are done.
# 🧠 Coder IITM — Productivity Chrome Extension

A powerful all-in-one Chrome extension built for focused studying and deep work. Track your time, block distractions, manage tasks, and stay in flow — all from a single popup.

---

## ✨ Features

### 📊 Track
Automatically tracks how much time you spend on each website — with a daily bar chart and 7-day history. Know exactly where your time goes.

### 🚫 Block
Add any website to your blocklist and it gets instantly blocked. A clean "Blocked" page replaces the site so you're not tempted.

### ✅ Tasks *(new in v4)*
Add tasks directly in the extension. **Blocked sites stay blocked until every task is marked complete.** Once all tasks are done, sites are automatically unblocked. No cheating allowed.

### ⚡ Speed
Boost video/audio playback speed on any tab — with presets and a custom slider. Great for lectures and tutorials.

### 🍅 Pomodoro Timer
Built-in Pomodoro timer with custom study/break durations, a visual ring countdown, and session history — all stored locally.

### 📝 Notes
A quick scratch pad that auto-saves as you type. Always available, no friction.

---

## 🚀 Installation

> Chrome Web Store listing coming soon. For now, install manually:

1. Download or clone this repo
2. Open Chrome → go to `chrome://extensions/`
3. Enable **Developer Mode** (top right toggle)
4. Click **"Load unpacked"** → select the `extension-new` folder
5. Pin the extension to your toolbar and you're ready

---

## 🔒 How Task Blocking Works

1. Add tasks in the **Tasks** tab
2. Your blocked sites list activates — **no distracting sites open**
3. Complete tasks one by one (click ⬜ to mark ✅)
4. Once **all tasks are done**, sites are unblocked automatically
5. Delete a task if you no longer need it

This forces you to finish what you planned before browsing freely.

---

## 🛠 Tech Stack

- **Manifest V3** Chrome Extension
- Vanilla JS, HTML, CSS — zero dependencies
- `chrome.storage.local` for persistent data
- `chrome.declarativeNetRequest` for site blocking
- Background Service Worker for Pomodoro timer

---

## 📁 Project Structure

```
extension-new/
├── manifest.json       # Extension config (MV3)
├── popup.html          # Main UI
├── popup.js            # All tab logic (Track, Block, Tasks, Speed, Pomo, Notes)
├── popup.css           # Styling
├── background.js       # Service worker (blocking, Pomodoro, tracking)
├── blocked.html        # Page shown when a site is blocked
├── blocked.css
├── blocked.js
└── icon.png
```

---

## 🙌 Contributing

Pull requests are welcome! If you have ideas for new tabs or features, open an issue first to discuss.

---

## 📄 License

MIT License — free to use, modify, and share.
