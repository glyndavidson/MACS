
(() => {
  "use strict";

  /* ===========================
     ASSIST DISPLAY — BRIDGE MODE
     Receives:
       - macs:config { pipeline_id }
       - macs:turns  { turns: [...] }
       - macs:mood   { mood }
     =========================== */

  const MAX_TURNS_FALLBACK = 2;

  let injectedPipelineId = "";
  let turns = []; // newest first

  const esc = (s) => (s ?? "").toString().replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");

  const fmtTime = (iso) => {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
    } catch { return ""; }
  };

  const renderChat = () => {
    const el = document.getElementById("messages");
    if (!el) return;

    el.innerHTML = `
      <div class="assist-chat">
        ${turns.slice().reverse().map(t => {
          const userText = t.heard || "";
          const sysText = t.error || t.reply || "";
          const ts = t.ts ? fmtTime(t.ts) : "";

          return `
            <div class="assist-turn">
              <div class="bubble user">
                ${ts ? `<div class="bubble-meta">${esc(ts)}</div>` : ""}
                ${esc(userText)}
              </div>
              <div class="bubble system">
                ${ts ? `<div class="bubble-meta">${esc(ts)}</div>` : ""}
                ${esc(sysText)}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  };

  // Parent origin (works even if this iframe has origin "null" due to sandboxing)
  const PARENT_ORIGIN = (() => {
    try { return new URL(document.referrer).origin; } catch { return "*"; }
  })();

  const requestConfigFromParent = () => {
    try { window.parent.postMessage({ type: "macs:request_config" }, PARENT_ORIGIN); } catch {}
  };

  window.addEventListener("message", (e) => {
    if (e.source !== window.parent) return;
    if (PARENT_ORIGIN !== "*" && e.origin !== PARENT_ORIGIN) return;
    if (!e.data || typeof e.data !== "object") return;

    if (e.data.type === "macs:config") {
      injectedPipelineId = (e.data.pipeline_id || "").toString().trim();
      return;
    }

    if (e.data.type === "macs:turns") {
      const incoming = Array.isArray(e.data.turns) ? e.data.turns : [];
      // Keep newest-first, cap to something sane (card already caps, but belt & braces)
      turns = incoming.slice(0, 30);
      renderChat();
      return;
    }
  });

  // Initial UI
  turns = [{
    runId: "boot",
    heard: "",
    reply: "",
    error: "Ready (bridge mode)",
    ts: new Date().toISOString()
  }];
  renderChat();

  requestConfigFromParent();
})();

document.getElementById('debug').innerText = 'origin=' + location.origin + ' ref=' + document.referrer;