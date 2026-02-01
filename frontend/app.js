const API_BASE = "http://127.0.0.1:8000";
const sessionId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());

// Predefined contexts
const CONTEXTS = [
  { emoji: '🏥', label: 'Medical', value: 'medical' },
  { emoji: '🍽️', label: 'Restaurant', value: 'restaurant' },
  { emoji: '🛒', label: 'Shopping', value: 'shopping' },
  { emoji: '💼', label: 'Work', value: 'work' },
  { emoji: '👨‍👩‍👧‍👦', label: 'Family', value: 'family' },
  { emoji: '💬', label: 'Others', value: 'others' }
];

// Generic phrases
const GENERIC_PHRASES = [
  "Yes", "No", "Maybe", "I don't know",
  "Can you repeat that?", "I need help", "Thank you", "Excuse me",
  "I understand", "Please wait", "I'm sorry", "One moment please",
  "I agree", "I disagree", "Could you speak slower?", "I'm ready"
];

// State
let selectedContext = null;
let isRecording = false;
let transcript = '';
let mediaRecorder = null;
let audioChunks = [];
let lastTranscriptTime = Date.now();
let currentSpeaker = 'user';
let pauseThreshold = 2000; // 2 seconds of silence triggers fade-out

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
const refreshBtn = document.getElementById('refreshBtn');
const statusBar = document.getElementById('statusBar');
const recordingToggle = document.getElementById('recordingToggle');

// Initialize contexts
function initContexts() {
  CONTEXTS.forEach(ctx => {
    const card = document.createElement('div');
    card.className = 'context-card';
    card.innerHTML = `
      <div class="context-emoji">${ctx.emoji}</div>
      <div class="context-label">${ctx.label}</div>
    `;
    card.onclick = () => selectContext(ctx, card);
    contextGrid.appendChild(card);
  });
}

function selectContext(ctx, element) {
  document.querySelectorAll('.context-card').forEach(c => c.classList.remove('selected'));
  element.classList.add('selected');
  selectedContext = ctx;
  customContext.value = '';
  startBtn.disabled = false;
}

customContext.addEventListener('input', (e) => {
  const additionalContext = e.target.value.trim();
  if (additionalContext && selectedContext) {
    // Keep the selected context and add additional context
    selectedContext.additionalContext = additionalContext;
    startBtn.disabled = false;
  } else if (additionalContext && !selectedContext) {
    // If no context selected, use the additional context as the main context
    selectedContext = { emoji: '🗣️', label: additionalContext, value: 'custom' };
    startBtn.disabled = false;
  } else if (!additionalContext && !document.querySelector('.context-card.selected')) {
    startBtn.disabled = true;
  }
});

startBtn.addEventListener('click', () => {
  showScreen('record');
  recordEmoji.textContent = selectedContext.emoji;
  const displayLabel = selectedContext.additionalContext 
    ? `${selectedContext.label} - ${selectedContext.additionalContext}`
    : selectedContext.label;
  recordContext.textContent = displayLabel;
  speechContextLabel.textContent = displayLabel;
});

// Recording functionality
recordBtn.addEventListener('click', () => {
  // Go to speech screen immediately
  showScreen('speech');
  initGenericButtons();
  
  // Start recording automatically
  if (!isRecording) {
    setTimeout(() => {
      toggleSpeechRecording();
    }, 100);
  }
});

function addTranscriptSentence(text, speaker = 'user') {
  const now = Date.now();
  
  // Create new sentence element
  const sentenceDiv = document.createElement('div');
  sentenceDiv.className = `transcript-sentence ${speaker}`;
  sentenceDiv.textContent = text;
  
  // Prepend to display (appears at bottom due to column-reverse)
  transcriptDisplay.insertBefore(sentenceDiv, transcriptDisplay.firstChild);
  
  // Auto-remove after fade-out animation completes (5 seconds total)
  setTimeout(() => {
    sentenceDiv.remove();
  }, 5000);
  
  // Update state
  lastTranscriptTime = now;
  currentSpeaker = speaker;
  transcript += text + ' ';
}

function fadeOutPreviousSentences() {
  // This function is now less critical since auto-fade handles it
  // But we can use it to immediately clear on long pauses
  const sentences = transcriptDisplay.querySelectorAll('.transcript-sentence');
  sentences.forEach(sentence => {
    sentence.remove();
  });
}

// --- Live (interim) transcript line helpers ---
let liveLineEl = null;

function ensureLiveLine() {
  if (!liveLineEl) {
    liveLineEl = document.createElement('div');
    liveLineEl.className = 'transcript-sentence user interim';
    // Put it at the bottom (remember transcriptDisplay is column-reverse)
    transcriptDisplay.insertBefore(liveLineEl, transcriptDisplay.firstChild);
  }
  return liveLineEl;
}

function setLiveTranscript(text) {
  const el = ensureLiveLine();
  el.textContent = text.trim();
  // If empty, hide it (so placeholder can show when nothing else exists)
  el.style.display = el.textContent ? 'block' : 'none';
}

function clearLiveTranscript() {
  if (liveLineEl) {
    liveLineEl.remove();
    liveLineEl = null;
  }
}

// Recording toggle on speech screen
recordingToggle.addEventListener('click', toggleSpeechRecording);

// Web Speech Recognition setup
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = 'en-US'; // Change to 'en-GB' for British English
  recognition.continuous = true; // Keep listening
  recognition.interimResults = true; // Show partial results

  let finalTranscript = '';
  let interimTranscript = '';

recognition.onresult = (event) => {
  let interim = '';
  let finalText = '';

  for (let i = event.resultIndex; i < event.results.length; i++) {
    const text = event.results[i][0].transcript;
    if (event.results[i].isFinal) finalText += text;
    else interim += text;
  }

  // live update while speaking
  setLiveTranscript(interim);

  const cleanedFinal = finalText.trim();
  if (!cleanedFinal) return;

  // ✅ Promote the existing interim line to final instead of pushing again
  if (liveLineEl) {
    liveLineEl.textContent = cleanedFinal;
    liveLineEl.classList.remove('interim');  // removes italics styling
    // Optionally keep 'user' class; up to you
    // liveLineEl.classList.add('user');

    // Important: "finalize" it so the next interim creates a new live line
    liveLineEl = null;
  } else {
    // fallback: if for some reason no live line exists, add normally
    addTranscriptSentence(cleanedFinal, 'user');
  }

  // send to backend once (not duplicated)
  sendTranscriptToBackend(cleanedFinal);
};



  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    if (event.error === 'no-speech') {
      // No speech detected, just continue
      return;
    }
    showStatus(`Recognition error: ${event.error}`, 'error');
  };

  recognition.onend = () => {
    // If recording is still active, restart recognition
    if (isRecording) {
      try {
        recognition.start();
      } catch (e) {
        console.error('Could not restart recognition:', e);
      }
    }
  };
}

async function toggleSpeechRecording() {
  if (!isRecording) {
    try {
      if (!recognition) {
        showStatus('Speech recognition not supported in this browser', 'error');
        return;
      }

      recognition.start();
      isRecording = true;
      recordingToggle.classList.add('recording');
      recordingToggle.classList.remove('paused');
      recordingToggle.title = 'Pause Recording';
      showStatus('Recording conversation...', '');
    } catch (error) {
      showStatus('Microphone access denied', 'error');
      console.error('Speech recognition error:', error);
    }
  } else {
    if (recognition) {
      recognition.stop();
    }
    clearLiveTranscript();
    isRecording = false;
    recordingToggle.classList.remove('recording');
    recordingToggle.classList.add('paused');
    recordingToggle.title = 'Start Recording';
    showStatus('Recording paused', '');
  }
}

async function sendTranscriptToBackend(text) {
  try {
    // Update the transcript state
    transcript += text + ' ';
  
    // Optionally auto-refresh contextual suggestions when new speech is detected
    // Uncomment the line below if you want automatic refresh
    // await autoRefreshSuggestions();
    
  } catch (error) {
    console.error('Failed to process transcript:', error);
  }
}

async function autoRefreshSuggestions() {
  try {
    const suggestions = await fetchSuggestions();
    renderContextualButtons(suggestions);
  } catch (error) {
    console.error('Failed to auto-refresh suggestions:', error);
  }
}

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tabName + 'Tab').classList.add('active');
  });
});

// Generic buttons
function initGenericButtons() {
  genericButtons.innerHTML = '';
  GENERIC_PHRASES.forEach(phrase => {
    const btn = document.createElement('button');
    btn.className = 'speech-btn';
    btn.textContent = phrase;
    btn.onclick = () => speakPhrase(phrase);
    genericButtons.appendChild(btn);
  });
}

// Contextual buttons refresh
refreshBtn.addEventListener('click', async () => {
  refreshBtn.disabled = true;
  refreshBtn.innerHTML = '<span class="loading-spinner"></span><span>Loading...</span>';
  
  try {
    const suggestions = await fetchSuggestions();
    renderContextualButtons(suggestions);
    showStatus('Suggestions refreshed', 'success');
  } catch (error) {
    showStatus('Failed to fetch suggestions', 'error');
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.innerHTML = '<span>🔄</span><span>Refresh</span>';
  }
});

async function fetchSuggestions() {
  const payload = {
    session_id: sessionId,
    last_text: transcript,
    context: selectedContext.value,
    mode: "contextual"
  };

  const res = await fetch(`${API_BASE}/suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

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
      speakPhrase(s.text);
      logChoice(s);
    };
    contextualButtons.appendChild(btn);
  });
}

async function logChoice(suggestion) {
  try {
    await fetch(`${API_BASE}/log_choice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        suggestion_id: suggestion.id,
        context: selectedContext.value,
        intent: suggestion.intent,
        text: suggestion.text
      })
    });
  } catch (error) {
    console.error('Log choice failed:', error);
  }
}

function speakPhrase(text) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
    addTranscriptSentence(text, 'assistant');
  }
}

// Navigation
document.getElementById('backFromRecord').addEventListener('click', () => {
  showScreen('home');
});

document.getElementById('backFromSpeech').addEventListener('click', () => {
  if (isRecording) {
    toggleSpeechRecording();
  }
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
  setTimeout(() => {
    statusBar.style.display = 'none';
  }, 3000);
}

// Health check
(async () => {
  try {
    const r = await fetch(`${API_BASE}/health`);
    if (r.ok) {
      showStatus('Backend connected', 'success');
    }
  } catch (e) {
    showStatus('Backend not connected - some features may not work', 'error');
  }
})();

// Initialize
initContexts();
