const API_BASE = "http://127.0.0.1:8000";
const sessionId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());

// Predefined contexts
const CONTEXTS = [
  { emoji: '🏥', label: 'Medical', value: 'medical' },
  { emoji: '🍽️', label: 'Restaurant', value: 'restaurant' },
  { emoji: '🛒', label: 'Shopping', value: 'shopping' },
  { emoji: '💼', label: 'Work', value: 'work' },
  { emoji: '👨‍👩‍👧‍👦', label: 'Family', value: 'family' },
  { emoji: '🎓', label: 'School', value: 'school' }
];

const GENERIC_PHRASES = [
  "Yes", "No", "Maybe", "I don't know",
  "Can you repeat that?", "I need help", "Thank you", "Excuse me",
  "I understand", "Please wait", "I'm sorry", "One moment please",
  "I agree", "I disagree", "Could you speak slower?", "I'm ready"
];

let selectedContext = null;
let isRecording = false;
let transcript = '';
let mediaRecorder = null;
let audioChunks = [];
let silenceTimer = null;
let wasResetPressed = false; // <-- track if reset was pressed

// Elements
const homeScreen = document.getElementById('homeScreen');
const recordScreen = document.getElementById('recordScreen');
const speechScreen = document.getElementById('speechScreen');

const contextGrid = document.getElementById('contextGrid');
const customContext = document.getElementById('customContext');
const startBtn = document.getElementById('startBtn');

const recordBtn = document.getElementById('recordBtn');
const recordStatus = document.getElementById('recordStatus');
const recordEmoji = document.getElementById('recordEmoji');
const recordContext = document.getElementById('recordContext');

const speechContextLabel = document.getElementById('speechContextLabel');
const transcriptDisplay = document.getElementById('transcriptDisplay');

const genericButtons = document.getElementById('genericButtons');
const contextualButtons = document.getElementById('contextualButtons');

const statusBar = document.getElementById('statusBar');
const recordingToggleBottom = document.getElementById('recordingToggleBottom');
const recordResetBtn = document.getElementById('recordResetBtn');
const stopResetBtn = document.getElementById('stopResetBtn');

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

// Init contexts
function initContexts() {
  contextGrid.innerHTML = '';
  CONTEXTS.forEach(ctx => {
    const card = document.createElement('div');
    card.className = 'context-card';
    card.innerHTML = `<div class="context-emoji">${ctx.emoji}</div><div class="context-label">${ctx.label}</div>`;
    card.onclick = () => selectContext(ctx, card);
    contextGrid.appendChild(card);
  });
}

function selectContext(ctx, el) {
  document.querySelectorAll('.context-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedContext = ctx;
  customContext.value = '';
  startBtn.disabled = false;
}

customContext.addEventListener('input', (e) => {
  if (e.target.value.trim()) {
    document.querySelectorAll('.context-card').forEach(c => c.classList.remove('selected'));
    selectedContext = { emoji: '🗣️', label: e.target.value.trim(), value: 'custom' };
    startBtn.disabled = false;
  } else if (!document.querySelector('.context-card.selected')) {
    startBtn.disabled = true;
  }
});

startBtn.addEventListener('click', () => {
  showScreen('record');
  recordEmoji.textContent = selectedContext.emoji;
  recordContext.textContent = selectedContext.label;
  speechContextLabel.textContent = selectedContext.label;
});

// recording button on record screen -> go to speech screen and auto-start
recordBtn.addEventListener('click', () => {
  showScreen('speech');
  wasResetPressed = false; // <-- reset the flag
  initGenericButtons(); // <-- show generic buttons immediately
  setTimeout(() => toggleSpeechRecording(), 120);
});

// Stop & Reset helpers
function stopAllRecognition() {
  try { if (recognition && isRecording) recognition.stop(); } catch {}
  try {
    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
    if (mediaRecorder && mediaRecorder.stream && mediaRecorder.stream.getTracks) mediaRecorder.stream.getTracks().forEach(t => t.stop());
  } catch {}
  isRecording = false;
  if (recordingToggleBottom) recordingToggleBottom.classList.remove('recording');
  clearTimeout(silenceTimer);
}

function clearTranscriptUI() {
  transcript = '';
  transcriptDisplay.textContent = '';
  recordStatus.textContent = '';
}

function fullReset() {
  wasResetPressed = true; // <-- mark that reset was pressed
  stopAllRecognition();
  clearTranscriptUI();
  recognition = null;
}

recordResetBtn?.addEventListener('click', () => {
  fullReset();
  showStatus('Stopped and cleared');
});

stopResetBtn?.addEventListener('click', () => {
  fullReset();
  showStatus('Input stopped and cleared');
});

// 3s silence auto-submit (but only if reset was NOT pressed)
function resetSilenceTimer() {
  clearTimeout(silenceTimer);
  silenceTimer = setTimeout(() => {
    // Only auto-submit if reset wasn't pressed
    if (!wasResetPressed && transcript && transcript.trim().length > 0) {
      showStatus('Auto-submitting input...', 'loading');
      autoSubmitTranscript();
    }
  }, 3000);
}

async function autoSubmitTranscript() {
  try {
    const suggestions = await fetchSuggestions(transcript);
    renderContextualButtons(suggestions);
    // Auto-switch to contextual tab
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('.tab[data-tab="contextual"]').classList.add('active');
    document.getElementById('contextualTab').classList.add('active');
    showStatus('Suggestions generated', 'success');
  } catch (e) {
    showStatus('Failed to generate suggestions', 'error');
  }
}

// Transcription & recording
async function transcribeAudio(blob) {
  showStatus('Transcribing...', '');
  showStatus('Transcription simulated', 'success');
}

recordingToggleBottom?.addEventListener('click', toggleSpeechRecording);

async function toggleSpeechRecording() {
  if (!SpeechRecognition) {
    showStatus('SpeechRecognition not supported', 'error');
    return;
  }

  if (!recognition) {
    recognition = new (SpeechRecognition)();
    recognition.lang = 'en-GB';
    recognition.continuous = true;
    recognition.interimResults = true;
    let finalTranscript = '';

    recognition.onstart = () => {
      isRecording = true;
      wasResetPressed = false; // <-- clear flag when recording starts
      if (recordingToggleBottom) recordingToggleBottom.classList.add('recording');
      showStatus('Recording...');
      resetSilenceTimer();
    };

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const part = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += part + ' ';
        else interim += part;
      }
      transcript = (finalTranscript + interim).trim();
      transcriptDisplay.textContent = transcript;
      resetSilenceTimer();
    };

    recognition.onerror = (e) => {
      showStatus('Speech recognition error', 'error');
    };

    recognition.onend = () => {
      isRecording = false;
      if (recordingToggleBottom) recordingToggleBottom.classList.remove('recording');
      showStatus('Recording stopped');
      resetSilenceTimer();
    };
  }

  if (!isRecording) {
    try { recognition.start(); } catch (e) { console.error(e); showStatus('Could not start recording', 'error'); }
  } else {
    recognition.stop();
  }
}

// Tabs
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tabName + 'Tab').classList.add('active');

    // Manage generic buttons visibility
    if (tabName === 'generic') {
      initGenericButtons();
    } else if (tabName === 'contextual') {
      genericButtons.innerHTML = '';
    }
  });
});

// Generic buttons
function initGenericButtons() {
  genericButtons.innerHTML = '';
  GENERIC_PHRASES.forEach(phrase => {
    const btn = document.createElement('button');
    btn.className = 'speech-btn';
    btn.textContent = phrase;
    btn.onclick = () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(phrase));
      }
      transcript += (phrase + ' ');
      transcriptDisplay.textContent = transcript;
      resetSilenceTimer();
    };
    genericButtons.appendChild(btn);
  });
}

// Contextual suggestions
async function fetchSuggestions() {
  const payload = { session_id: sessionId, last_text: transcript, context: selectedContext?.value || 'generic', mode: 'contextual' };
  const res = await fetch(`${API_BASE}/suggest`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Suggest failed');
  const data = await res.json();
  return data.suggestions || [];
}

function renderContextualButtons(suggestions) {
  contextualButtons.innerHTML = '';
  suggestions.forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'speech-btn';
    btn.textContent = s.text;
    btn.onclick = () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(s.text));
      }
      transcript += s.text + ' ';
      transcriptDisplay.textContent = transcript;
      fetch(`${API_BASE}/log_choice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id, suggestion_id: s.id, context: selectedContext?.value || 'generic', intent: s.intent, text: s.text })
      }).catch(() => {});
      resetSilenceTimer();
    };
    contextualButtons.appendChild(btn);
  });
}

// Navigation
document.getElementById('backFromRecord').addEventListener('click', () => {
  showScreen('home');
});
document.getElementById('backFromSpeech').addEventListener('click', () => {
  fullReset();
  showScreen('record');
});

function showScreen(screen) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screen + 'Screen').classList.add('active');
}

function showStatus(message, type) {
  statusBar.textContent = message;
  statusBar.className = 'status-bar';
  if (type) statusBar.classList.add(type);
  statusBar.style.display = 'block';
  setTimeout(() => { statusBar.style.display = 'none'; }, 2400);
}

// Health check
(async () => {
  try {
    const r = await fetch(`${API_BASE}/health`);
    if (r.ok) showStatus('Backend connected', 'success');
  } catch (e) {
    showStatus('Backend not connected - some features may not work', 'error');
  }
})();

// Init
initContexts();