const API_BASE = "http://127.0.0.1:8000";
const sessionId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());

const chat = document.getElementById("chat");
const msgInput = document.getElementById("msgInput");
const sendBtn = document.getElementById("sendBtn");
const suggestionsDiv = document.getElementById("suggestions");
const statusDiv = document.getElementById("status");
const contextSel = document.getElementById("context");
const ttsToggle = document.getElementById("ttsToggle");
const bigToggle = document.getElementById("bigToggle");

bigToggle.addEventListener("change", () => {
  document.documentElement.classList.toggle("big", bigToggle.checked);
});

function addMsg(text, who) {
  const div = document.createElement("div");
  div.className = `msg ${who}`;
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function setStatus(s) {
  statusDiv.textContent = s || "";
}

function speak(text) {
  if (!ttsToggle.checked) return;
  if (!("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

async function fetchSuggestions(lastText) {
  const payload = {
    session_id: sessionId,
    last_text: lastText,
    context: contextSel.value,
    mode: "default"
  };

  const res = await fetch(`${API_BASE}/suggest`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`suggest failed: ${res.status} ${t}`);
  }

  return await res.json();
}

async function logChoice(s) {
  const payload = {
    session_id: sessionId,
    suggestion_id: s.id,
    context: contextSel.value,
    intent: s.intent,
    text: s.text
  };

  await fetch(`${API_BASE}/log_choice`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(payload)
  });
}

function renderSuggestions(items) {
  suggestionsDiv.innerHTML = "";
  items.forEach(s => {
    const btn = document.createElement("button");
    btn.textContent = s.text;
    btn.onclick = async () => {
      addMsg(s.text, "them");
      suggestionsDiv.innerHTML = "";
      speak(s.text);
      try { await logChoice(s); } catch(e) { /* ignore */ }
    };
    suggestionsDiv.appendChild(btn);
  });
}

async function send() {
  const text = msgInput.value.trim();
  if (!text) return;
  msgInput.value = "";

  addMsg(text, "me");
  setStatus("Generating reply options…");
  suggestionsDiv.innerHTML = "";

  try {
    const data = await fetchSuggestions(text);
    renderSuggestions(data.suggestions);
    setStatus("");
  } catch (e) {
    setStatus(`Error: ${e.message}`);
  }
}

sendBtn.addEventListener("click", send);
msgInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") send();
});

// Quick startup check
(async () => {
  try {
    const r = await fetch(`${API_BASE}/health`);
    if (!r.ok) throw new Error("health failed");
    setStatus("Backend connected.");
    setTimeout(() => setStatus(""), 1200);
  } catch (e) {
    setStatus("Cannot reach backend. Is it running on 127.0.0.1:8000 ?");
  }
})();
