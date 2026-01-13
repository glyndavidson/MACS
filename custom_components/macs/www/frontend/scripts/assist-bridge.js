/**
 * Assist Bridge
 * -------------
 * Renders Assist conversation messages inside the iframe.
 */
import { importWithVersion } from "./importHandler.js";

const { createDebugger } = await importWithVersion("../../shared/debugger.js");
const { MessageListener } = await importWithVersion("../../shared/messageListener.js");

const debug = createDebugger(import.meta.url);
const messageListener = new MessageListener({
  recipient: "assist-bridge",
  getExpectedSource: () => window.parent,
  getExpectedOrigin: () => window.location.origin,
  onMessage: handleMessage,
});
messageListener.start();

const errorListener = new MessageListener({
  recipient: "assist-bridge",
  getExpectedSource: () => window,
  getExpectedOrigin: () => window.location.origin,
  onMessage: handleMessage,
});
errorListener.start();


/* ===========================
    ASSIST DISPLAY — BRIDGE MODE
    Receives:
      - macs:config { assist_pipeline_entity }
      - macs:turns  { turns: [...] }
      - macs:mood   { mood }
    =========================== */

const MAX_TURNS_FALLBACK = 2;
const MAX_MESSAGES_FALLBACK = MAX_TURNS_FALLBACK * 2;

let injectedPipelineId = "";
let messages = []; // newest first
let maxMessages = MAX_MESSAGES_FALLBACK;

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
      ${messages.slice().reverse().map(m => {
        const role = (m.role || "assistant").toString().toLowerCase();
        const text = (m.text || "").toString();
        if (!text) return "";
        const ts = m.ts ? fmtTime(m.ts) : "";
        const bubbleClass = role === "user" ? "user" : "system";

        return `
          <div class="assist-turn">
            <div class="bubble ${bubbleClass}">
              ${ts ? `<div class="bubble-meta">${esc(ts)}</div>` : ""}
              ${esc(text)}
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
};

const applyConfigPayload = (payload) => {
  const data = payload || {};
  injectedPipelineId = (data.assist_pipeline_entity || "").toString().trim();
  const maxTurns = Number(data.max_turns);
  if (Number.isFinite(maxTurns) && maxTurns > 0) {
    maxMessages = Math.max(1, Math.floor(maxTurns)) * 2;
  } else {
    maxMessages = MAX_MESSAGES_FALLBACK;
  }
  debug("Config", { assist_pipeline_entity: injectedPipelineId, max_messages: maxMessages });
};

const applyTurnsPayload = (turns) => {
  const incoming = Array.isArray(turns) ? turns : [];
  debug("Turns", { count: incoming.length });
  // Keep newest-first, cap to something sane (card already caps, but belt & braces)
  const nextMessages = [];
  incoming.forEach((t) => {
    const ts = (t?.ts || "").toString();
    const reply = (t?.error || t?.reply || "").toString();
    const heard = (t?.heard || "").toString();
    if (reply) nextMessages.push({ role: "assistant", text: reply, ts });
    if (heard) nextMessages.push({ role: "user", text: heard, ts });
  });
  messages = nextMessages.slice(0, maxMessages);
  renderChat();
};

function handleMessage(payload) {
  if (!payload || typeof payload !== "object") return;

  if (payload.type === "macs:init") {
    applyConfigPayload(payload.config);
    applyTurnsPayload(payload.turns);
    return;
  }

  if (payload.type === "macs:config") {
    applyConfigPayload(payload);
    return;
  }

  if (payload.type === "macs:turns") {
    applyTurnsPayload(payload.turns);
    return;
  }
}

// Initial UI
messages = [{
  role: "assistant",
  text: "Ready...",
  ts: new Date().toISOString()
}];
renderChat();
debug("Assistant Bridge Ready");
