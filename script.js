/**
 * LiFiOS — Complete JavaScript (ES6)
 * Li-Fi System Simulation & Dashboard
 * Uses Session Storage for persistence
 */

"use strict";

/* ════════════════════════════════════════════════
   STATE
════════════════════════════════════════════════ */
const State = {
  transmitting: false,
  intervalId: null,
  autoId: null,
  messageCounter: 0,
  stats: {
    sent: 0,
    received: 0,
    success: 0,
    failed: 0,
  },
  metrics: {
    dataRate: 0,
    signalStrength: 0,
    ber: 0,
    transferTime: 0,
    psr: 0,
  },
  speedHistory: [],
  signalHistory: [],
  labels: [],
  charts: {},
  theme: "dark",
};

/* ════════════════════════════════════════════════
   SESSION STORAGE
════════════════════════════════════════════════ */
const SS_KEY = "lifi_messages";
const SS_STATS_KEY = "lifi_stats";

function ssGetMessages() {
  try {
    return JSON.parse(sessionStorage.getItem(SS_KEY) || "[]");
  } catch {
    return [];
  }
}

function ssAddMessage(msg) {
  const msgs = ssGetMessages();
  msgs.push(msg);
  sessionStorage.setItem(SS_KEY, JSON.stringify(msgs));
}

function ssClearMessages() {
  sessionStorage.removeItem(SS_KEY);
}

function ssGetStats() {
  try {
    const s = JSON.parse(sessionStorage.getItem(SS_STATS_KEY) || "null");
    return s;
  } catch {
    return null;
  }
}

function ssSaveStats() {
  sessionStorage.setItem(SS_STATS_KEY, JSON.stringify(State.stats));
}

function loadSession() {
  const msgs = ssGetMessages();
  if (msgs.length) {
    msgs.forEach((m) => renderLogEntry(m, false));
    updateReceiverMetrics(msgs[msgs.length - 1]);
  }
  const stats = ssGetStats();
  if (stats) {
    State.stats = stats;
    updateStatCards();
  }
}

/* ════════════════════════════════════════════════
   THEME
════════════════════════════════════════════════ */
function initTheme() {
  const saved = localStorage.getItem("lifi_theme") || "dark";
  setTheme(saved);
}

function setTheme(t) {
  State.theme = t;
  document.documentElement.setAttribute("data-theme", t);
  document.getElementById("toggleIcon").textContent = t === "dark" ? "☀" : "🌙";
  localStorage.setItem("lifi_theme", t);
  // Redraw charts to match theme
  setTimeout(() => {
    if (State.charts.speed) updateChartColors();
  }, 100);
}

document.getElementById("themeToggle").addEventListener("click", () => {
  setTheme(State.theme === "dark" ? "light" : "dark");
});

function updateChartColors() {
  const isDark = State.theme === "dark";
  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)";
  const fontColor = isDark ? "#4e6d87" : "#6b8aa8";
  const opts = { scales: { x: { ticks: { color: fontColor }, grid: { color: gridColor } }, y: { ticks: { color: fontColor }, grid: { color: gridColor } } } };
  [State.charts.speed, State.charts.signal, State.charts.packet].forEach((c) => {
    if (!c) return;
    c.options.scales.x.ticks.color = fontColor;
    c.options.scales.x.grid.color = gridColor;
    c.options.scales.y.ticks.color = fontColor;
    c.options.scales.y.grid.color = gridColor;
    c.update();
  });
}

/* ════════════════════════════════════════════════
   NAVBAR
════════════════════════════════════════════════ */
function initNavbar() {
  const navbar = document.getElementById("navbar");
  const hb = document.getElementById("hamburger");
  const navLinks = document.querySelector(".nav-links");

  window.addEventListener("scroll", () => {
    navbar.classList.toggle("scrolled", window.scrollY > 20);
    updateActiveLink();
  });

  hb.addEventListener("click", () => {
    navLinks.classList.toggle("mobile-open");
  });

  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("mobile-open");
    });
  });
}

function updateActiveLink() {
  const sections = ["home", "architecture", "dashboard", "performance", "charts"];
  let current = "home";
  sections.forEach((id) => {
    const el = document.getElementById(id);
    if (el && window.scrollY >= el.offsetTop - 100) current = id;
  });
  document.querySelectorAll(".nav-link").forEach((l) => {
    l.classList.toggle("active", l.getAttribute("href") === `#${current}`);
  });
}

/* ════════════════════════════════════════════════
   PARTICLES
════════════════════════════════════════════════ */
function initParticles() {
  const field = document.getElementById("particleField");
  if (!field) return;
  for (let i = 0; i < 40; i++) {
    const p = document.createElement("div");
    const x = Math.random() * 100;
    const y = Math.random() * 100;
    const dur = 4 + Math.random() * 6;
    const size = 1 + Math.random() * 2;
    p.style.cssText = `
      position:absolute; left:${x}%; top:${y}%;
      width:${size}px; height:${size}px;
      background: var(--accent); border-radius:50%; opacity:.3;
      animation: particleFloat ${dur}s ease-in-out ${Math.random() * 4}s infinite alternate;
    `;
    field.appendChild(p);
  }

  const style = document.createElement("style");
  style.textContent = `
    @keyframes particleFloat {
      from { transform: translateY(0) translateX(0); opacity:.15; }
      to { transform: translateY(-30px) translateX(${Math.random() > .5 ? "" : "-"}15px); opacity:.5; }
    }
  `;
  document.head.appendChild(style);
}

/* ════════════════════════════════════════════════
   SCROLL REVEAL
════════════════════════════════════════════════ */
function initReveal() {
  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((e, i) => {
        if (e.isIntersecting) {
          setTimeout(() => e.target.classList.add("revealed"), i * 80);
          obs.unobserve(e.target);
        }
      });
    },
    { threshold: 0.1 }
  );
  document.querySelectorAll("[data-reveal], .comp-card, .chart-card, .info-card").forEach((el) =>
    obs.observe(el)
  );
}

/* ════════════════════════════════════════════════
   FORM VALIDATION
════════════════════════════════════════════════ */
document.getElementById("messageInput").addEventListener("input", function () {
  const len = this.value.length;
  const counter = document.getElementById("charCount");
  counter.textContent = `${len} / 500`;
  counter.className = "char-count" + (len > 450 ? " danger" : len > 350 ? " warn" : "");
  this.classList.remove("error");
  document.getElementById("inputError").textContent = "";
});

function validateMessage() {
  const input = document.getElementById("messageInput");
  const err = document.getElementById("inputError");
  const val = input.value.trim();

  if (!val) {
    input.classList.add("error");
    err.textContent = "⚠ Message cannot be empty";
    showToast("Please enter a message to transmit", "error");
    return false;
  }
  if (val.length > 500) {
    input.classList.add("error");
    err.textContent = "⚠ Exceeds 500 character limit";
    showToast("Message exceeds 500 character limit", "error");
    return false;
  }
  return true;
}

/* ════════════════════════════════════════════════
   TRANSMISSION SIMULATION
════════════════════════════════════════════════ */
function sendMessage() {
  if (!validateMessage()) return;
  const input = document.getElementById("messageInput");
  const msg = input.value.trim();

  simulateTransmission(msg, () => {
    input.value = "";
    document.getElementById("charCount").textContent = "0 / 500";
  });
}

function simulateTransmission(msg, onComplete) {
  const rate = parseInt(document.getElementById("rateSelect").value);
  const mod = document.getElementById("modSelect").value;
  const bytes = new TextEncoder().encode(msg).length;
  const xferMs = Math.max(200, Math.round((bytes / (rate * 125000)) * 1000 + 100));

  setTxStatus("TRANSMITTING");
  setRxStatus("RECEIVING");
  document.getElementById("decodeAnim").classList.add("active");

  // LED flicker
  startLEDFlicker();

  // Photon packets
  launchPhotons();

  // Tower LED
  document.getElementById("towerLed").classList.add("active");
  document.body.classList.add("transmitting");

  // Channel stats
  const sig = randomInRange(75, 99);
  const ber = (Math.random() * 1e-6).toExponential(2);
  const dr = rate >= 1000 ? `${rate / 1000} Gbps` : `${rate} Mbps`;
  document.getElementById("cvBps").textContent = dr;
  document.getElementById("cvSig").textContent = `${sig}%`;
  document.getElementById("cvBer").textContent = ber;

  // After delay, deliver
  setTimeout(() => {
    stopLEDFlicker();
    document.getElementById("towerLed").classList.remove("active");
    document.body.classList.remove("transmitting");

    const success = Math.random() > 0.04; // 96% success
    const now = new Date();

    State.stats.sent++;
    State.messageCounter++;

    if (success) {
      State.stats.received++;
      State.stats.success++;

      const entry = {
        id: `PKT-${String(State.messageCounter).padStart(4, "0")}`,
        msg,
        time: now.toLocaleTimeString(),
        bytes,
        mod,
        rate: dr,
        sig,
      };

      ssAddMessage(entry);
      renderLogEntry(entry, true);
      updateReceiverMetrics(entry);
      setRxStatus("RECEIVED");
      document.getElementById("decodeAnim").classList.remove("active");

      // Update KPIs
      const rateNum = rate;
      const psr = Math.round((State.stats.success / State.stats.sent) * 100);
      updateKPIs({ dataRate: rateNum, signalStrength: sig, ber, transferTime: xferMs, psr });
      updateChartData(rateNum, sig, State.stats.success, State.stats.failed);
      showToast(`✓ Transmitted ${bytes} bytes via ${mod} modulation`, "success");
    } else {
      State.stats.failed++;
      setRxStatus("ERROR");
      document.getElementById("decodeAnim").classList.remove("active");
      showToast("✕ Packet lost — optical interference detected", "error");
    }

    State.stats.sent = State.stats.sent;
    ssSaveStats();
    updateStatCards();

    setTimeout(() => {
      setTxStatus(State.transmitting ? "ACTIVE" : "IDLE");
      setRxStatus(State.transmitting ? "LISTENING" : "IDLE");
    }, 1500);

    if (onComplete) onComplete();
  }, xferMs);
}

/* ════════════════════════════════════════════════
   LED / VISUAL EFFECTS
════════════════════════════════════════════════ */
let ledFlickerTimer = null;

function startLEDFlicker() {
  const leds = document.querySelectorAll(".led-unit");
  ledFlickerTimer = setInterval(() => {
    leds.forEach((led) => {
      led.classList.toggle("on", Math.random() > 0.4);
    });
  }, 80);
}

function stopLEDFlicker() {
  if (ledFlickerTimer) {
    clearInterval(ledFlickerTimer);
    ledFlickerTimer = null;
  }
  document.querySelectorAll(".led-unit").forEach((l) => l.classList.remove("on"));
}

function launchPhotons() {
  const packets = document.querySelectorAll(".photon-packet");
  packets.forEach((p, i) => {
    setTimeout(() => {
      p.classList.remove("flying");
      void p.offsetWidth; // force reflow
      p.classList.add("flying");
      setTimeout(() => p.classList.remove("flying"), 1400);
    }, i * 320);
  });

  // PD receiving animation
  const pd = document.querySelector(".pd-icon");
  setTimeout(() => {
    pd.classList.add("receiving");
    setTimeout(() => pd.classList.remove("receiving"), 600);
  }, 1100);
}

/* ════════════════════════════════════════════════
   LOG RENDERING
════════════════════════════════════════════════ */
function renderLogEntry(entry, animated) {
  const log = document.getElementById("receivedLog");

  // Remove empty placeholder
  const empty = log.querySelector(".log-empty");
  if (empty) empty.remove();

  const div = document.createElement("div");
  div.className = "log-entry";
  div.innerHTML = `
    <div class="le-header">
      <span class="le-id">${entry.id}</span>
      <span class="le-time">${entry.time}</span>
    </div>
    <div class="le-msg">${escapeHtml(entry.msg)}</div>
    <div style="margin-top:4px; font-family:var(--font-mono); font-size:.6rem; color:var(--text-3)">
      ${entry.bytes}B · ${entry.mod} · ${entry.rate} · SIG:${entry.sig}%
    </div>
  `;

  if (animated) {
    log.insertBefore(div, log.firstChild);
  } else {
    log.appendChild(div);
  }
}

function updateReceiverMetrics(entry) {
  document.getElementById("lastRecTime").textContent = entry.time;
  document.getElementById("bytesRec").textContent = `${entry.bytes} B`;
  document.getElementById("integrityStatus").textContent = "GOOD";
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ════════════════════════════════════════════════
   STATUS
════════════════════════════════════════════════ */
function setTxStatus(s) {
  const el = document.getElementById("txStatus");
  el.textContent = s;
  el.className = "panel-status" + (s === "IDLE" ? "" : s === "TRANSMITTING" ? " transmitting" : " active");
}

function setRxStatus(s) {
  const el = document.getElementById("rxStatus");
  el.textContent = s;
  el.className = "panel-status" + (s === "IDLE" ? "" : s === "ERROR" ? " transmitting" : " active");
}

/* ════════════════════════════════════════════════
   KPIs
════════════════════════════════════════════════ */
function updateKPIs({ dataRate, signalStrength, ber, transferTime, psr }) {
  State.metrics = { dataRate, signalStrength, ber, transferTime, psr };

  // Data Rate ring (max 1000 Mbps)
  const drPct = Math.min(dataRate / 1000, 1);
  setRing("ringDataRate", drPct);
  document.getElementById("kpiDRVal").textContent = dataRate >= 1000 ? `${dataRate / 1000}G` : `${dataRate}M`;

  // Signal ring
  const sigPct = signalStrength / 100;
  setRing("ringSig", sigPct);
  document.getElementById("kpiSigVal").textContent = `${signalStrength}%`;

  // BER
  document.getElementById("kpiBERVal").textContent = ber;

  // Transfer Time
  document.getElementById("kpiTimeVal").textContent = `${transferTime}ms`;

  // PSR ring
  setRing("ringPSR", psr / 100);
  document.getElementById("kpiPSRVal").textContent = `${psr}%`;

  // Channel panel
  document.getElementById("speedBadge").textContent = `${dataRate} Mbps`;
  document.getElementById("sigBadge").textContent = `${signalStrength}%`;
}

function setRing(id, pct) {
  const circ = 213.6;
  const offset = circ * (1 - pct);
  const el = document.getElementById(id);
  if (el) el.style.strokeDashoffset = offset;
}

/* ════════════════════════════════════════════════
   STATS CARDS
════════════════════════════════════════════════ */
function updateStatCards() {
  const { sent, received, success, failed } = State.stats;
  const total = Math.max(sent, 1);

  animateCount("totalSent", sent);
  animateCount("totalRec", received);
  animateCount("totalSuccess", success);
  animateCount("totalFailed", failed);

  document.getElementById("sentFill").style.width = `${(sent / Math.max(sent, 100)) * 100}%`;
  document.getElementById("recFill").style.width = `${(received / total) * 100}%`;
  document.getElementById("successFill").style.width = `${(success / total) * 100}%`;
  document.getElementById("failedFill").style.width = `${(failed / total) * 100}%`;

  document.getElementById("pktBadge").textContent = `${sent} packets`;
}

function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = parseInt(el.textContent) || 0;
  const dur = 600;
  const startTime = performance.now();
  function step(now) {
    const t = Math.min((now - startTime) / dur, 1);
    el.textContent = Math.round(start + (target - start) * easeOut(t));
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function easeOut(t) {
  return 1 - Math.pow(1 - t, 3);
}

/* ════════════════════════════════════════════════
   CHARTS
════════════════════════════════════════════════ */
function initCharts() {
  const isDark = State.theme === "dark";
  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)";
  const fontColor = isDark ? "#4e6d87" : "#6b8aa8";

  const baseOpts = (color) => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    plugins: { legend: { display: false } },
    scales: {
      x: {
        ticks: { color: fontColor, font: { family: "JetBrains Mono", size: 10 }, maxTicksLimit: 8 },
        grid: { color: gridColor },
        border: { display: false },
      },
      y: {
        ticks: { color: fontColor, font: { family: "JetBrains Mono", size: 10 } },
        grid: { color: gridColor },
        border: { display: false },
      },
    },
  });

  // Speed Chart
  const sCtx = document.getElementById("speedChart").getContext("2d");
  const sGrad = sCtx.createLinearGradient(0, 0, 0, 200);
  sGrad.addColorStop(0, "rgba(0,200,255,0.3)");
  sGrad.addColorStop(1, "rgba(0,200,255,0)");

  State.charts.speed = new Chart(sCtx, {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        data: [],
        borderColor: "#00c8ff",
        backgroundColor: sGrad,
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: "#00c8ff",
        fill: true,
        tension: 0.4,
      }],
    },
    options: { ...baseOpts("#00c8ff"), scales: { ...baseOpts().scales, y: { ...baseOpts().scales?.y, min: 0, suggestedMax: 1100, ticks: { color: fontColor, font: { family: "JetBrains Mono", size: 10 } }, grid: { color: gridColor }, border: { display: false } } } },
  });

  // Signal Chart
  const sgCtx = document.getElementById("signalChart").getContext("2d");
  const sgGrad = sgCtx.createLinearGradient(0, 0, 0, 200);
  sgGrad.addColorStop(0, "rgba(0,255,163,0.3)");
  sgGrad.addColorStop(1, "rgba(0,255,163,0)");

  State.charts.signal = new Chart(sgCtx, {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        data: [],
        borderColor: "#00ffa3",
        backgroundColor: sgGrad,
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: "#00ffa3",
        fill: true,
        tension: 0.4,
      }],
    },
    options: { ...baseOpts("#00ffa3"), scales: { ...baseOpts().scales, y: { min: 0, max: 100, ticks: { color: fontColor, font: { family: "JetBrains Mono", size: 10 } }, grid: { color: gridColor }, border: { display: false } } } },
  });

  // Packet Chart
  const pCtx = document.getElementById("packetChart").getContext("2d");
  State.charts.packet = new Chart(pCtx, {
    type: "bar",
    data: {
      labels: [],
      datasets: [
        {
          label: "Success",
          data: [],
          backgroundColor: "rgba(0,255,163,0.6)",
          borderColor: "#00ffa3",
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: "Failed",
          data: [],
          backgroundColor: "rgba(255,75,75,0.6)",
          borderColor: "#ff4b4b",
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    },
    options: {
      ...baseOpts(),
      plugins: {
        legend: {
          display: true,
          labels: { color: fontColor, font: { family: "JetBrains Mono", size: 10 }, boxWidth: 12 },
        },
      },
    },
  });
}

function updateChartData(dataRate, signal, success, failed) {
  const now = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const MAX = 20;

  // Speed
  State.charts.speed.data.labels.push(now);
  State.charts.speed.data.datasets[0].data.push(dataRate);
  if (State.charts.speed.data.labels.length > MAX) {
    State.charts.speed.data.labels.shift();
    State.charts.speed.data.datasets[0].data.shift();
  }
  State.charts.speed.update();

  // Signal
  State.charts.signal.data.labels.push(now);
  State.charts.signal.data.datasets[0].data.push(signal);
  if (State.charts.signal.data.labels.length > MAX) {
    State.charts.signal.data.labels.shift();
    State.charts.signal.data.datasets[0].data.shift();
  }
  State.charts.signal.update();

  // Packets
  State.charts.packet.data.labels.push(now);
  State.charts.packet.data.datasets[0].data.push(success);
  State.charts.packet.data.datasets[1].data.push(failed);
  if (State.charts.packet.data.labels.length > MAX) {
    State.charts.packet.data.labels.shift();
    State.charts.packet.data.datasets[0].data.shift();
    State.charts.packet.data.datasets[1].data.shift();
  }
  State.charts.packet.update();
}

/* ════════════════════════════════════════════════
   CONTROL BUTTONS
════════════════════════════════════════════════ */
function startTransmission() {
  if (State.transmitting) return;
  State.transmitting = true;
  document.getElementById("startBtn").disabled = true;
  document.getElementById("stopBtn").disabled = false;

  setTxStatus("ACTIVE");
  setRxStatus("LISTENING");
  showToast("▶ Transmission session started", "info");

  // Auto-send demo messages every 4s
  const demoMsgs = [
    "Hello from Li-Fi Node A — optical channel open",
    "Sensor data: TEMP=27.3°C HUM=62% PRES=1013hPa",
    "Beacon: Li-Fi AP-001 active — SSID:LIFI_MESH_01",
    "Data burst: 0xA3 0xFF 0x12 0x88 0xC4 — CRC OK",
    "Status: All systems nominal — BER < 1e-9",
  ];
  let idx = 0;

  State.autoId = setInterval(() => {
    if (!State.transmitting) return;
    const msg = demoMsgs[idx % demoMsgs.length];
    idx++;
    document.getElementById("messageInput").value = msg;
    document.getElementById("charCount").textContent = `${msg.length} / 500`;
    simulateTransmission(msg, () => {
      document.getElementById("messageInput").value = "";
      document.getElementById("charCount").textContent = "0 / 500";
    });
  }, 3500);
}

function stopTransmission() {
  State.transmitting = false;
  if (State.autoId) clearInterval(State.autoId);
  document.getElementById("startBtn").disabled = false;
  document.getElementById("stopBtn").disabled = true;
  setTxStatus("IDLE");
  setRxStatus("IDLE");
  showToast("⏹ Transmission session stopped", "info");
}

function clearData() {
  ssClearMessages();
  sessionStorage.removeItem(SS_STATS_KEY);
  State.stats = { sent: 0, received: 0, success: 0, failed: 0 };
  State.messageCounter = 0;

  // Clear log
  const log = document.getElementById("receivedLog");
  log.innerHTML = `
    <div class="log-empty">
      <span class="log-empty-icon">📡</span>
      <span>Awaiting optical transmission...</span>
    </div>`;

  // Reset metrics
  document.getElementById("lastRecTime").textContent = "—";
  document.getElementById("bytesRec").textContent = "0 B";
  document.getElementById("cvBps").textContent = "— Mbps";
  document.getElementById("cvSig").textContent = "—%";
  document.getElementById("cvBer").textContent = "—";

  // Reset KPIs
  ["ringDataRate", "ringSig", "ringPSR"].forEach((id) => setRing(id, 0));
  document.getElementById("kpiDRVal").textContent = "0";
  document.getElementById("kpiSigVal").textContent = "0%";
  document.getElementById("kpiBERVal").textContent = "—";
  document.getElementById("kpiTimeVal").textContent = "0ms";
  document.getElementById("kpiPSRVal").textContent = "0%";

  updateStatCards();

  // Clear charts
  [State.charts.speed, State.charts.signal, State.charts.packet].forEach((c) => {
    if (!c) return;
    c.data.labels = [];
    c.data.datasets.forEach((d) => (d.data = []));
    c.update();
  });

  document.getElementById("speedBadge").textContent = "— Mbps";
  document.getElementById("sigBadge").textContent = "—%";
  document.getElementById("pktBadge").textContent = "0 packets";

  showToast("⟳ All data cleared successfully", "info");
}

/* ════════════════════════════════════════════════
   EXPORT REPORT
════════════════════════════════════════════════ */
function exportReport() {
  const msgs = ssGetMessages();
  const now = new Date().toLocaleString();
  const { sent, received, success, failed } = State.stats;
  const psr = sent > 0 ? ((success / sent) * 100).toFixed(1) : 0;

  let content = `
╔══════════════════════════════════════════════════╗
║           LiFiOS — Transmission Report           ║
║     Li-Fi Optical Data Transfer System           ║
╚══════════════════════════════════════════════════╝

Generated: ${now}
Session ID: LF-${Date.now().toString(36).toUpperCase()}

──── PERFORMANCE SUMMARY ────────────────────────────
  Total Packets Sent     : ${sent}
  Total Packets Received : ${received}
  Successful Transfers   : ${success}
  Failed Transfers       : ${failed}
  Packet Success Rate    : ${psr}%
  Data Rate (last)       : ${State.metrics.dataRate} Mbps
  Signal Strength (last) : ${State.metrics.signalStrength}%
  Bit Error Rate (last)  : ${State.metrics.ber}
  Transfer Time (last)   : ${State.metrics.transferTime} ms

──── TRANSMITTED MESSAGES ───────────────────────────
`;

  msgs.forEach((m, i) => {
    content += `
[${i + 1}] ${m.id} @ ${m.time}
    Modulation : ${m.mod}
    Data Rate  : ${m.rate}
    Signal     : ${m.sig}%
    Bytes      : ${m.bytes}
    Message    : ${m.msg}
`;
  });

  content += `
──── SYSTEM INFO ────────────────────────────────────
  Platform    : Li-Fi Embedded System Simulator
  Technology  : Visible Light Communication (VLC)
  Standard    : IEEE 802.11bb (Li-Fi)
  MCU         : ESP32 @ 240MHz
  Modulation  : OOK / OFDM / PPM / DPPM
  Build       : HTML5 + CSS3 + Vanilla JS ES6

════════════════════════════════════════════════════
                  LiFiOS v1.0 — 2025
════════════════════════════════════════════════════
`;

  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `LiFiOS_Report_${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);

  showToast("↓ Report exported successfully", "success");
}

/* ════════════════════════════════════════════════
   TOAST
════════════════════════════════════════════════ */
let toastTimer = null;

function showToast(msg, type = "info") {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
}

/* ════════════════════════════════════════════════
   ARCHITECTURE COMPONENT INTERACTION
════════════════════════════════════════════════ */
function initArchInteraction() {
  const info = {
    "mcu-tx": "Microcontroller TX: Encodes digital data into optical signals using PWM. Manages framing, CRC generation, and protocol stack.",
    driver: "Driver Circuit: PWM modulator converts MCU signals to LED current pulses. Supports OOK, OFDM, and PPM modulation.",
    led: "LED Transmitter: High-power LED array converts electrical PWM signals to visible light photons for free-space transmission.",
    pd: "Photodiode Receiver: Converts incident photons to electrical current. PIN or APD type for maximum sensitivity and bandwidth.",
    amp: "Amplifier Stage: Trans-impedance amplifier (TIA) boosts photodiode signal. Followed by band-pass filter to remove noise.",
    "mcu-rx": "MCU + Display: Decodes received optical signal, performs CRC check, error correction, and outputs data to OLED/LCD display.",
  };

  document.querySelectorAll(".arch-comp").forEach((comp) => {
    comp.addEventListener("click", () => {
      const key = comp.getAttribute("data-comp");
      if (info[key]) showToast(`ℹ ${info[key]}`, "info");
    });
    comp.title = "Click for details";
  });
}

/* ════════════════════════════════════════════════
   UTILITIES
════════════════════════════════════════════════ */
function randomInRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/* ════════════════════════════════════════════════
   INIT
════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initNavbar();
  initParticles();
  initReveal();
  initCharts();
  initArchInteraction();
  loadSession();

  // Initial mock data for charts
  setTimeout(() => {
    for (let i = 0; i < 6; i++) {
      const t = new Date(Date.now() - (6 - i) * 4000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      State.charts.speed.data.labels.push(t);
      State.charts.speed.data.datasets[0].data.push(0);
      State.charts.signal.data.labels.push(t);
      State.charts.signal.data.datasets[0].data.push(0);
      State.charts.packet.data.labels.push(t);
      State.charts.packet.data.datasets[0].data.push(0);
      State.charts.packet.data.datasets[1].data.push(0);
    }
    State.charts.speed.update();
    State.charts.signal.update();
    State.charts.packet.update();
  }, 500);

  showToast("⚡ LiFiOS initialized — system ready", "success");
});
