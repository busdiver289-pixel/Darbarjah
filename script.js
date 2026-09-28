let words = [
  { balochi: "سلام", roman: "salaam", urdu: "سلام", english: "hello / peace", category: "basics", dialect: "Common", example: "سلام، دوست!", exampleEnglish: "Hello, friend!" },
  { balochi: "مہر بانی", roman: "mehrbaani", urdu: "مہربانی", english: "thank you", category: "basics", dialect: "Common", example: "مہر بانی، شما!", exampleEnglish: "Thank you!" },
  { balochi: "دوست", roman: "dost", urdu: "دوست", english: "friend", category: "people", dialect: "Common", example: "منّی دوست.", exampleEnglish: "My friend." },
  { balochi: "مات", roman: "maat", urdu: "ماں", english: "mother", category: "people", dialect: "Western", example: "مات گھر اِنت.", exampleEnglish: "Mother is at home." },
  { balochi: "پت", roman: "pat", urdu: "پانی", english: "water", category: "nature", dialect: "Common", example: "پت دَے.", exampleEnglish: "Give water." },
  { balochi: "مہر", roman: "mehr", urdu: "سورج", english: "sun", category: "nature", dialect: "Common", example: "مہر روشن اِنت.", exampleEnglish: "The sun is bright." },
  { balochi: "دست", roman: "dast", urdu: "ہاتھ", english: "hand", category: "people", dialect: "Southern", example: "دست بلند کن.", exampleEnglish: "Raise your hand." },
  { balochi: "گوں", roman: "goon", urdu: "گھر", english: "home", category: "home", dialect: "Common", example: "منّی گوں.", exampleEnglish: "My home." },
  { balochi: "نان", roman: "naan", urdu: "روٹی", english: "bread", category: "home", dialect: "Common", example: "نان گرم اِنت.", exampleEnglish: "The bread is warm." },
  { balochi: "دل", roman: "dil", urdu: "دل", english: "heart", category: "basics", dialect: "Common", example: "دل شاد اِنت.", exampleEnglish: "The heart is happy." },
  { balochi: "وش", roman: "wush", urdu: "اچھا", english: "good", category: "basics", dialect: "Western", example: "روز وش.", exampleEnglish: "Good day." },
  { balochi: "بلوچ", roman: "Baloch", urdu: "بلوچ", english: "Baloch person", category: "people", dialect: "Common", example: "من بلوچ اَں.", exampleEnglish: "I am Baloch." },
  { balochi: "روچ", roman: "roch", urdu: "دن", english: "day", category: "basics", dialect: "Common", example: "روچ وش.", exampleEnglish: "Good day." },
  { balochi: "شب", roman: "shab", urdu: "رات", english: "night", category: "basics", dialect: "Common", example: "شب بخیر.", exampleEnglish: "Good night." },
  { balochi: "بچ", roman: "bach", urdu: "بچہ", english: "child", category: "people", dialect: "Southern", example: "بچ خوش اِنت.", exampleEnglish: "The child is happy." },
  { balochi: "کوه", roman: "koh", urdu: "پہاڑ", english: "mountain", category: "nature", dialect: "Common", example: "کوه بلند اِنت.", exampleEnglish: "The mountain is high." },
  { balochi: "باد", roman: "baad", urdu: "ہوا", english: "wind", category: "nature", dialect: "Common", example: "باد سرد اِنت.", exampleEnglish: "The wind is cold." },
  { balochi: "کتاب", roman: "kitaab", urdu: "کتاب", english: "book", category: "home", dialect: "Common", example: "کتاب بخوان.", exampleEnglish: "Read the book." },
  { balochi: "بازار", roman: "bazaar", urdu: "بازار", english: "market", category: "home", dialect: "Common", example: "من بازار روَں.", exampleEnglish: "I am going to the market." },
  { balochi: "یک", roman: "yak", urdu: "ایک", english: "one", category: "basics", dialect: "Common", example: "یک کتاب.", exampleEnglish: "One book." }
];
const customWords = JSON.parse(localStorage.getItem("darbarjah-custom-entries") || "[]").map((entry) => ({
  ...entry,
  id: entry.id || createEntryId(),
  userAdded: true
}));

const grid = document.querySelector("#wordGrid");
const searchInput = document.querySelector("#searchInput");
const count = document.querySelector("#visibleCount");
const emptyState = document.querySelector("#emptyState");
let activeCategory = "all";
const savedFavorites = localStorage.getItem("darbarjah-favorites") || localStorage.getItem("gwat-favorites") || "[]";
let favorites = JSON.parse(savedFavorites);
let flashIndex = 0;
let flashRevealed = false;
let quizIndex = 0;
let quizOrder = [];
let quizScore = 0;
let quizAnswered = false;
let quizAdvanceTimer;
let activeDialogWord;
let activeRecorder;
let activeRecordingStream;
let recordingChunks = [];
let voiceSessionIndex = 0;
let voiceSessionRecorder;
let voiceSessionStream;
let activeRecognition;
let editingEntryId = "";
let recordedVoiceKeys = new Set();
let phraseRecorder;
let phraseRecordingStream;

function createEntryId() {
  return globalThis.crypto?.randomUUID?.() || `entry-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function persistCustomWords() {
  localStorage.setItem("darbarjah-custom-entries", JSON.stringify(customWords));
}
persistCustomWords();

function openVoiceDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("darbarjah-voice-notes", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("recordings");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function voiceKey(word, kind = "word") {
  return kind === "phrase" ? `phrase|${word.roman}|${word.balochi}` : `${word.roman}|${word.balochi}`;
}

function normalizePronunciation(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function pronunciationSimilarity(spoken, expected) {
  const source = normalizePronunciation(spoken);
  const target = normalizePronunciation(expected);
  if (!source || !target) return 0;
  const previousRow = Array.from({ length: target.length + 1 }, (_, index) => index);
  for (let sourceIndex = 1; sourceIndex <= source.length; sourceIndex += 1) {
    const currentRow = [sourceIndex];
    for (let targetIndex = 1; targetIndex <= target.length; targetIndex += 1) {
      const substitutionCost = source[sourceIndex - 1] === target[targetIndex - 1] ? 0 : 1;
      currentRow[targetIndex] = Math.min(
        currentRow[targetIndex - 1] + 1,
        previousRow[targetIndex] + 1,
        previousRow[targetIndex - 1] + substitutionCost
      );
    }
    previousRow.splice(0, previousRow.length, ...currentRow);
  }
  return 1 - previousRow[target.length] / Math.max(source.length, target.length);
}

function startPronunciationPractice() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const result = document.querySelector("#pronunciationResult");
  const button = document.querySelector("#checkPronunciation");
  if (!Recognition) {
    result.textContent = "Speech recognition is not available in this browser. Try Chrome or Edge.";
    return;
  }
  if (activeRecorder?.state === "recording") {
    result.textContent = "Stop your voice recording before starting pronunciation practice.";
    return;
  }

  const word = activeDialogWord;
  const candidates = String(word.roman || "").split(/[\/,]/).map((candidate) => candidate.trim()).filter(Boolean);
  const recognition = new Recognition();
  activeRecognition = recognition;
  let receivedSpeech = false;
  recognition.lang = "en-US";
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 5;
  button.disabled = true;
  result.textContent = "Listening… say the word clearly.";
  recognition.onresult = (event) => {
    receivedSpeech = true;
    const alternatives = [...event.results[0]].map((alternative) => alternative.transcript.trim());
    let bestTranscript = alternatives[0] || "";
    let bestScore = 0;
    alternatives.forEach((transcript) => candidates.forEach((candidate) => {
      const score = pronunciationSimilarity(transcript, candidate);
      if (score > bestScore) { bestScore = score; bestTranscript = transcript; }
    }));
    const feedback = bestScore >= 0.86
      ? "Strong spelling match. This is not a phonetic accuracy score."
      : bestScore >= 0.62
        ? "Partial match. Try saying it again slowly."
        : "No close spelling match. Try again or check the microphone.";
    result.textContent = `Heard “${bestTranscript}”. ${feedback}`;
  };
  recognition.onerror = (event) => {
    const messages = {
      "not-allowed": "Microphone permission was denied. Allow microphone access and try again.",
      "no-speech": "No speech was detected. Try again and speak after pressing the button.",
      network: "Speech recognition needs a network connection in this browser."
    };
    result.textContent = messages[event.error] || "Speech recognition could not complete. Please try again.";
  };
  recognition.onend = () => {
    button.disabled = false;
    if (activeRecognition === recognition) activeRecognition = null;
    if (!receivedSpeech && result.textContent.startsWith("Listening")) result.textContent = "No speech was recognized. Try again.";
  };
  try {
    recognition.start();
  } catch (error) {
    activeRecognition = null;
    button.disabled = false;
    result.textContent = "Could not start listening. Check microphone permission and try again.";
  }
}

async function getVoiceNote(word, kind = "word") {
  const database = await openVoiceDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("recordings", "readonly");
    const request = transaction.objectStore("recordings").get(voiceKey(word, kind));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => { database.close(); reject(transaction.error); };
  });
}

async function saveVoiceNote(word, blob, kind = "word") {
  const database = await openVoiceDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction("recordings", "readwrite");
    transaction.objectStore("recordings").put(blob, voiceKey(word, kind));
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
  });
  recordedVoiceKeys.add(voiceKey(word, kind));
  renderCategoryFilters();
  renderWords();
}

async function removeVoiceNote(word, kind = "word") {
  const database = await openVoiceDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction("recordings", "readwrite");
    transaction.objectStore("recordings").delete(voiceKey(word, kind));
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
  });
  recordedVoiceKeys.delete(voiceKey(word, kind));
  renderCategoryFilters();
  renderWords();
}

async function refreshVoiceKeys() {
  const database = await openVoiceDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("recordings", "readonly");
    const request = transaction.objectStore("recordings").getAllKeys();
    request.onsuccess = () => { recordedVoiceKeys = new Set(request.result); };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => { database.close(); resolve(recordedVoiceKeys); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
  });
}

async function readAllVoiceNotes() {
  const database = await openVoiceDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("recordings", "readonly");
    const store = transaction.objectStore("recordings");
    const keysRequest = store.getAllKeys();
    const valuesRequest = store.getAll();
    let keys, values;
    keysRequest.onsuccess = () => { keys = keysRequest.result; };
    valuesRequest.onsuccess = () => { values = valuesRequest.result; };
    transaction.oncomplete = () => {
      database.close();
      resolve(keys.map((key, index) => ({ key, blob: values[index] })));
    };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
  });
}

async function writeVoiceNotes(notes) {
  const database = await openVoiceDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("recordings", "readwrite");
    const store = transaction.objectStore("recordings");
    notes.forEach((note) => store.put(note.blob, note.key));
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(encoded, type) {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: type || "application/octet-stream" });
}

function downloadFile(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(value) { return `"${String(value ?? "").replace(/"/g, '""')}"`; }

async function exportBackup() {
  const status = document.querySelector("#backupStatus");
  status.textContent = "Preparing backup…";
  try {
    const voiceNotes = await readAllVoiceNotes();
    const backup = {
      format: "darbarjah-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      entries: customWords,
      recordings: await Promise.all(voiceNotes.map(async ({ key, blob }) => ({ key, type: blob.type, data: await blobToBase64(blob) })))
    };
    downloadFile("darbarjah-backup.json", JSON.stringify(backup), "application/json");
    status.textContent = `Backup ready: ${customWords.length} personal entries and ${voiceNotes.length} recordings.`;
  } catch (error) {
    status.textContent = "Could not create a backup. Check browser storage space.";
  }
}

async function importBackup(file) {
  const status = document.querySelector("#backupStatus");
  try {
    const backup = JSON.parse(await file.text());
    if (backup.format !== "darbarjah-backup" || !Array.isArray(backup.entries) || !Array.isArray(backup.recordings)) throw new Error("Invalid backup file");
    const mergedEntries = new Map(customWords.map((entry) => [entry.id, entry]));
    backup.entries.forEach((entry) => {
      if (!entry.english || !entry.roman || !entry.balochi || !entry.urdu) throw new Error("Backup contains an incomplete entry");
      const id = entry.id || createEntryId();
      mergedEntries.set(id, { ...entry, id, userAdded: true });
    });
    const recordings = backup.recordings.map((note) => {
      if (typeof note.key !== "string" || typeof note.data !== "string") throw new Error("Backup contains an invalid voice clip");
      return { key: note.key, blob: base64ToBlob(note.data, note.type) };
    });
    const importedEntries = [...mergedEntries.values()];
    await writeVoiceNotes(recordings);
    customWords.splice(0, customWords.length, ...importedEntries);
    persistCustomWords();
    words = words.filter((word) => !word.userAdded);
    words.push(...customWords);
    await refreshVoiceKeys();
    renderCategoryFilters();
    renderWords();
    renderDailyWord();
    startQuiz();
    status.textContent = `Imported ${backup.entries.length} entries and ${recordings.length} recordings. This device is up to date.`;
  } catch (error) {
    status.textContent = error.message || "Could not import this backup file.";
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { row.push(cell.trim()); cell = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell.trim()); cell = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else cell += character;
  }
  if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
  const headers = rows.shift().map((header) => header.toLowerCase());
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function renderCategoryFilters() {
  const categories = [...new Map(words.map((word) => [word.category, word.categoryLabel || word.category])).entries()];
  const missingVoiceCount = words.filter((word) => !recordedVoiceKeys.has(voiceKey(word))).length;
  document.querySelector("#categoryFilters").innerHTML = [
    `<button class="filter ${activeCategory === "all" ? "active" : ""}" data-category="all" type="button">All words</button>`,
    ...categories.map(([key, label]) => `<button class="filter ${activeCategory === key ? "active" : ""}" data-category="${escapeHtml(key)}" type="button">${escapeHtml(label)}</button>`),
    `<button class="filter ${activeCategory === "saved" ? "active" : ""}" data-category="saved" type="button">Saved <span id="savedCount">0</span></button>`,
    `<button class="filter ${activeCategory === "missing-voice" ? "active" : ""}" data-category="missing-voice" type="button">Needs voice <span>${missingVoiceCount}</span></button>`
  ].join("");
}

function driveAudioUrl(link) {
  const match = link.match(/\/d\/([^/]+)/);
  return match ? `https://drive.google.com/uc?export=download&id=${match[1]}` : "";
}

async function loadCsvWords() {
  try {
    const response = await fetch("balochi-words.csv?v=4", { cache: "no-store" });
    if (!response.ok) throw new Error("CSV unavailable");
    const rows = parseCsv(await response.text());
    if (!rows.length || !rows[0].english || !rows[0].balochi || !rows[0].urdu) throw new Error("CSV columns were not recognized");
    words = rows.map((row) => ({
      english: row.english,
      roman: row["balochi roman"],
      balochi: row.balochi,
      urdu: row.urdu,
      example: row["balochi sentence"],
      exampleEnglish: row["english sentences"],
      category: row.category.trim().toLowerCase().replace(/\s+/g, "-"),
      categoryLabel: row.category.trim(),
      dialect: row.category,
      audio: driveAudioUrl(row["audio link"])
    }));
    words.push(...customWords);
    renderCategoryFilters();
    document.querySelector("#wordSource").textContent = "words from your sheet";
  } catch (error) {
    words.push(...customWords);
    renderCategoryFilters();
    document.querySelector("#wordSource").textContent = "sample words (sheet did not load)";
    console.warn("Using built-in vocabulary because the CSV could not be loaded.", error);
  }
}

function saveFavorites() { localStorage.setItem("darbarjah-favorites", JSON.stringify(favorites)); }

function speak(text, button) {
  if (!("speechSynthesis" in window)) { button.setAttribute("aria-label", "Speech is not supported in this browser"); return; }
  window.speechSynthesis.cancel();
  document.querySelectorAll(".speak-button, .phrase-play, .outline-button").forEach((item) => item.classList.remove("playing"));
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "bal"; utterance.rate = 0.76; button.classList.add("playing");
  utterance.onend = () => button.classList.remove("playing"); window.speechSynthesis.speak(utterance);
}

async function playAudio(word, button) {
  try {
    const voiceNote = await getVoiceNote(word);
    if (voiceNote) {
      const audioUrl = URL.createObjectURL(voiceNote);
      const audio = new Audio(audioUrl);
      audio.onended = () => URL.revokeObjectURL(audioUrl);
      await audio.play();
      return;
    }
  } catch (error) {
    console.warn("Could not load your saved voice recording.", error);
  }
  if (word.audio) { const audio = new Audio(word.audio); audio.play().catch(() => speak(word.roman, button)); return; }
  speak(word.roman, button);
}

function renderWords() {
  const query = searchInput.value.trim().toLowerCase();
  const visibleWords = words.filter((word) => {
    const matchesCategory = activeCategory === "all"
      || word.category === activeCategory
      || (activeCategory === "saved" && favorites.includes(word.roman))
      || (activeCategory === "missing-voice" && !recordedVoiceKeys.has(voiceKey(word)));
    const matchesQuery = !query || Object.values(word).some((value) => String(value).toLowerCase().includes(query));
    return matchesCategory && matchesQuery;
  });
  count.textContent = visibleWords.length; document.querySelector("#savedCount").textContent = favorites.length; emptyState.hidden = visibleWords.length > 0;
  grid.innerHTML = visibleWords.map((word) => `
    <article class="word-card"><div class="card-top"><div><h3 class="word-balochi" lang="bal">${escapeHtml(word.balochi)}</h3><p class="word-roman">${escapeHtml(word.roman)}</p></div>
      <div class="card-actions"><button class="save-button ${favorites.includes(word.roman) ? "saved" : ""}" type="button" aria-label="Save ${escapeHtml(word.roman)}" data-save="${escapeHtml(word.roman)}">★</button><button class="speak-button" type="button" aria-label="Hear ${escapeHtml(word.roman)}" data-speak="${escapeHtml(word.roman)}">▶</button></div></div>
      <p class="word-urdu" lang="ur">${escapeHtml(word.urdu)}</p><p class="word-english">${escapeHtml(word.english)}</p><div class="word-meta"><span>${escapeHtml(word.categoryLabel || word.category)}</span><span>${escapeHtml(word.example)}</span></div><p class="example-english">${escapeHtml(word.exampleEnglish)}</p><p class="recording-status ${recordedVoiceKeys.has(voiceKey(word)) ? "recording-saved" : "recording-missing"}">${recordedVoiceKeys.has(voiceKey(word)) ? "Voice saved" : "Needs voice"}</p><button class="word-details-button" type="button" data-open-word="${words.indexOf(word)}">View details</button></article>`).join("");
  grid.querySelectorAll("[data-speak]").forEach((button) => button.addEventListener("click", () => playAudio(words.find((word) => word.roman === button.dataset.speak), button)));
  grid.querySelectorAll("[data-save]").forEach((button) => button.addEventListener("click", () => { favorites = favorites.includes(button.dataset.save) ? favorites.filter((item) => item !== button.dataset.save) : [...favorites, button.dataset.save]; saveFavorites(); renderWords(); }));
}

function openWordDetails(index) {
  const word = words[index];
  if (!word) return;
  activeDialogWord = word;
  document.querySelector("#dialogWord").textContent = word.balochi || "—";
  document.querySelector("#dialogRoman").textContent = word.roman || "—";
  document.querySelector("#dialogEnglish").textContent = word.english || "—";
  document.querySelector("#dialogUrdu").textContent = word.urdu || "—";
  document.querySelector("#dialogBalochiSentence").textContent = word.example || "No Balochi example provided.";
  document.querySelector("#dialogEnglishSentence").textContent = word.exampleEnglish || "No English example provided.";
  document.querySelector("#dialogCategory").textContent = `Category: ${word.categoryLabel || word.category || "Uncategorized"}`;
  document.querySelector("#personalEntryActions").hidden = !word.userAdded;
  document.querySelector("#pronunciationResult").textContent = "Say the Roman pronunciation when you are ready.";
  const audioButton = document.querySelector("#dialogAudio");
  audioButton.textContent = "▶ Hear word";
  audioButton.onclick = () => playAudio(word, audioButton);
  document.querySelector("#voiceStatus").textContent = "Record your pronunciation for this word.";
  document.querySelector("#phraseVoiceStatus").textContent = word.example ? "Checking sentence recording…" : "Add a Balochi example sentence first.";
  document.querySelector("#playPhraseVoice").disabled = !word.example;
  document.querySelector("#recordPhraseVoice").disabled = !word.example;
  document.querySelector("#deletePhraseVoice").hidden = true;
  document.querySelector("#deleteVoice").hidden = true;
  getVoiceNote(word).then((voiceNote) => {
    if (activeDialogWord !== word) return;
    if (voiceNote) {
      audioButton.textContent = "▶ Play my recording";
      document.querySelector("#voiceStatus").textContent = "Your recording is saved for this word.";
      document.querySelector("#deleteVoice").hidden = false;
    }
  }).catch(() => { document.querySelector("#voiceStatus").textContent = "Voice recording storage is unavailable in this browser."; });
  getVoiceNote(word, "phrase").then((voiceNote) => {
    if (activeDialogWord !== word) return;
    document.querySelector("#phraseVoiceStatus").textContent = voiceNote ? "Your sentence recording is saved." : word.example ? "No sentence recording yet." : "Add a Balochi example sentence first.";
    document.querySelector("#deletePhraseVoice").hidden = !voiceNote;
    document.querySelector("#playPhraseVoice").disabled = !voiceNote && !word.example;
    document.querySelector("#recordPhraseVoice").disabled = !word.example;
  }).catch(() => { document.querySelector("#phraseVoiceStatus").textContent = "Sentence recordings are unavailable in this browser."; });
  document.querySelector("#wordDialog").showModal();
}

function openEntryForEditing(word) {
  if (!word?.userAdded) return;
  activeDialogWord = word;
  document.querySelector("#wordDialog").close();
  const details = document.querySelector(".add-entry-box");
  details.open = true;
  const form = document.querySelector("#addEntryForm");
  form.elements.namedItem("entryId").value = word.id;
  for (const name of ["entryType", "english", "roman", "balochi", "urdu", "example", "exampleEnglish"]) {
    form.elements.namedItem(name).value = word[name] || (name === "entryType" ? "word" : "");
  }
  form.elements.namedItem("category").value = word.categoryLabel || "";
  form.querySelector("button[type='submit']").textContent = "Save changes";
  document.querySelector("#addEntryStatus").textContent = `Editing “${word.english}”.`;
  form.scrollIntoView({ behavior: "smooth", block: "center" });
  form.elements.namedItem("english").focus({ preventScroll: true });
}

function renderVoiceSession() {
  const complete = voiceSessionIndex >= words.length;
  const current = document.querySelector("#voiceSessionCurrent");
  const completePanel = document.querySelector("#voiceSessionComplete");
  const controls = ["#voiceSessionHear", "#voiceSessionRecord", "#voiceSessionStop", "#voiceSessionSkip", "#voiceSessionNext"];
  current.hidden = complete;
  completePanel.hidden = !complete;
  controls.forEach((selector) => { document.querySelector(selector).hidden = complete; });
  document.querySelector("#finishVoiceSession").hidden = !complete;
  if (complete) {
    document.querySelector("#voiceSessionProgress").textContent = `${words.length} of ${words.length} words`;
    document.querySelector("#voiceSessionMeter").value = 1;
    document.querySelector("#voiceSessionStatus").textContent = "Recording session complete.";
    return;
  }

  const word = words[voiceSessionIndex];
  document.querySelector("#voiceSessionProgress").textContent = `Word ${voiceSessionIndex + 1} of ${words.length}`;
  document.querySelector("#voiceSessionMeter").value = voiceSessionIndex / words.length;
  document.querySelector("#voiceSessionWord").textContent = word.balochi || "—";
  document.querySelector("#voiceSessionRoman").textContent = word.roman || "—";
  document.querySelector("#voiceSessionEnglish").textContent = word.english || "—";
  document.querySelector("#voiceSessionUrdu").textContent = word.urdu || "—";
  document.querySelector("#voiceSessionNext").textContent = voiceSessionIndex === words.length - 1 ? "Complete session" : "Next word";
  document.querySelector("#voiceSessionStatus").textContent = "Checking for an existing recording…";
  getVoiceNote(word).then((recording) => {
    if (voiceSessionIndex === words.indexOf(word)) {
      document.querySelector("#voiceSessionStatus").textContent = recording ? "A voice recording is already saved. Recording again will replace it." : "Listen to the reference, then record your pronunciation.";
    }
  }).catch(() => { document.querySelector("#voiceSessionStatus").textContent = "Recordings will be saved in this browser."; });
}

function playReference(word, button) {
  if (word.audio) {
    const audio = new Audio(word.audio);
    audio.play().catch(() => speak(word.roman, button));
    return;
  }
  speak(word.roman, button);
}

async function startPhraseRecording() {
  if (!activeDialogWord?.example) {
    document.querySelector("#phraseVoiceStatus").textContent = "Add a Balochi example sentence first.";
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    document.querySelector("#phraseVoiceStatus").textContent = "Voice recording is not supported in this browser.";
    return;
  }
  const recordingWord = activeDialogWord;
  try {
    phraseRecordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks = [];
    phraseRecorder = new MediaRecorder(phraseRecordingStream);
    phraseRecorder.addEventListener("dataavailable", (event) => { if (event.data.size) chunks.push(event.data); });
    phraseRecorder.addEventListener("stop", async () => {
      phraseRecordingStream.getTracks().forEach((track) => track.stop());
      phraseRecordingStream = null;
      document.querySelector("#recordPhraseVoice").disabled = false;
      document.querySelector("#stopPhraseVoice").disabled = true;
      if (!chunks.length) return;
      try {
        await saveVoiceNote(recordingWord, new Blob(chunks, { type: phraseRecorder.mimeType || "audio/webm" }), "phrase");
        document.querySelector("#phraseVoiceStatus").textContent = "Sentence recording saved.";
        document.querySelector("#deletePhraseVoice").hidden = false;
      } catch (error) {
        document.querySelector("#phraseVoiceStatus").textContent = "Could not save the sentence recording.";
      }
    }, { once: true });
    phraseRecorder.start();
    document.querySelector("#recordPhraseVoice").disabled = true;
    document.querySelector("#stopPhraseVoice").disabled = false;
    document.querySelector("#phraseVoiceStatus").textContent = "Recording sentence… stop to save.";
  } catch (error) {
    document.querySelector("#phraseVoiceStatus").textContent = "Microphone access was not granted.";
  }
}

async function playPhraseRecording() {
  const button = document.querySelector("#playPhraseVoice");
  try {
    const recording = await getVoiceNote(activeDialogWord, "phrase");
    if (!recording) { speak(activeDialogWord.example, button); return; }
    const url = URL.createObjectURL(recording);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    await audio.play();
  } catch (error) {
    document.querySelector("#phraseVoiceStatus").textContent = "Could not play the saved sentence recording.";
  }
}

async function startVoiceSessionRecording() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    document.querySelector("#voiceSessionStatus").textContent = "Voice recording is not supported in this browser.";
    return;
  }
  const word = words[voiceSessionIndex];
  try {
    voiceSessionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks = [];
    voiceSessionRecorder = new MediaRecorder(voiceSessionStream);
    voiceSessionRecorder.addEventListener("dataavailable", (event) => { if (event.data.size) chunks.push(event.data); });
    voiceSessionRecorder.addEventListener("stop", async () => {
      voiceSessionStream.getTracks().forEach((track) => track.stop());
      voiceSessionStream = null;
      document.querySelector("#voiceSessionRecord").disabled = false;
      document.querySelector("#voiceSessionStop").disabled = true;
      document.querySelector("#voiceSessionSkip").disabled = false;
      document.querySelector("#voiceSessionNext").disabled = false;
      if (!chunks.length) return;
      try {
        await saveVoiceNote(word, new Blob(chunks, { type: voiceSessionRecorder.mimeType || "audio/webm" }));
        document.querySelector("#voiceSessionStatus").textContent = "Saved for this word. Continue when ready.";
      } catch (error) {
        document.querySelector("#voiceSessionStatus").textContent = "Could not save this recording.";
      }
    }, { once: true });
    voiceSessionRecorder.start();
    document.querySelector("#voiceSessionRecord").disabled = true;
    document.querySelector("#voiceSessionStop").disabled = false;
    document.querySelector("#voiceSessionSkip").disabled = true;
    document.querySelector("#voiceSessionNext").disabled = true;
    document.querySelector("#voiceSessionStatus").textContent = "Recording… Say the word, then stop to save.";
  } catch (error) {
    document.querySelector("#voiceSessionStatus").textContent = "Microphone access was not granted. Allow it in your browser and try again.";
  }
}

function renderDailyWord() {
  const word = words[new Date().getDate() % words.length];
  document.querySelector("#dailyWord").innerHTML = `<h3>${escapeHtml(word.balochi)}</h3><p class="daily-roman">${escapeHtml(word.roman)} · ${escapeHtml(word.english)}</p><p>${escapeHtml(word.example)}</p><button class="outline-button" data-daily-speak type="button">▶ Hear it</button>`;
  document.querySelector("[data-daily-speak]").addEventListener("click", (event) => playAudio(word, event.currentTarget));
}

function renderFlashcard() { const word = words[flashIndex % words.length]; document.querySelector("#flashcardWord").textContent = flashRevealed ? word.english : word.balochi; document.querySelector("#flashcardHint").textContent = flashRevealed ? `${word.urdu} · ${word.roman}` : "Tap to reveal"; }

function shuffled(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function startQuiz() {
  quizOrder = shuffled(words.map((_, index) => index)).slice(0, Math.min(10, words.length));
  quizIndex = 0;
  quizScore = 0;
  quizAnswered = false;
  clearTimeout(quizAdvanceTimer);
  renderQuiz();
}

function renderQuiz() {
  const quizContent = document.querySelector("#quizContent");
  if (quizIndex >= quizOrder.length) {
    quizContent.innerHTML = `<p class="quiz-finish">Round complete</p><p class="quiz-result">You scored ${quizScore} out of ${quizOrder.length}.</p><button class="outline-button" type="button" data-quiz-restart>Play again</button>`;
    return;
  }
  const word = words[quizOrder[quizIndex]];
  const choices = shuffled([word, ...shuffled(words.filter((item) => item !== word)).slice(0, 3)]);
  quizContent.innerHTML = `<p class="quiz-progress">Question ${quizIndex + 1} of ${quizOrder.length} <span>Score ${quizScore}</span></p><p class="quiz-question">What does <strong>${escapeHtml(word.balochi)}</strong> mean?</p><div class="quiz-options">${choices.map((choice) => `<button type="button" data-answer="${choice === word}" ${quizAnswered ? "disabled" : ""}>${escapeHtml(choice.english)}</button>`).join("")}</div><p class="quiz-result" id="quizResult" role="status"></p><button class="outline-button quiz-next" type="button" data-next-question ${quizAnswered ? "" : "disabled"}>${quizIndex + 1 === quizOrder.length ? "See result" : "Next question"}</button>`;
}

searchInput.addEventListener("input", renderWords);
grid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-open-word]");
  if (button) openWordDetails(Number(button.dataset.openWord));
});
document.querySelector("#closeWordDialog").addEventListener("click", () => document.querySelector("#wordDialog").close());
document.querySelector("#addEntryForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const entryType = formData.get("entryType");
  const categoryLabel = String(formData.get("category") || (entryType === "phrase" ? "Phrases" : "My words")).trim();
  const entryId = String(formData.get("entryId") || "");
  const entry = {
    id: entryId || createEntryId(),
    userAdded: true,
    english: String(formData.get("english")).trim(),
    roman: String(formData.get("roman")).trim(),
    balochi: String(formData.get("balochi")).trim(),
    urdu: String(formData.get("urdu")).trim(),
    category: categoryLabel.toLowerCase().replace(/\s+/g, "-"),
    categoryLabel,
    dialect: "User added",
    example: String(formData.get("example") || "").trim(),
    exampleEnglish: String(formData.get("exampleEnglish") || "").trim(),
    entryType
  };
  if (entryId) {
    const customIndex = customWords.findIndex((word) => word.id === entryId);
    const dictionaryWord = words.find((word) => word.id === entryId);
    const existingEntry = customWords[customIndex];
    if (existingEntry && (existingEntry.roman !== entry.roman || existingEntry.balochi !== entry.balochi)) {
      await Promise.all([removeVoiceNote(existingEntry), removeVoiceNote(existingEntry, "phrase")]).catch(() => {});
    }
    if (customIndex !== -1) Object.assign(customWords[customIndex], entry);
    if (dictionaryWord) Object.assign(dictionaryWord, entry);
  } else {
    customWords.push(entry);
    words.push(entry);
  }
  persistCustomWords();
  renderCategoryFilters();
  activeCategory = "all";
  document.querySelectorAll(".filter").forEach((button) => button.classList.toggle("active", button.dataset.category === "all"));
  renderWords();
  document.querySelector("#addEntryStatus").textContent = entryId ? "Your entry was updated." : `${entryType === "phrase" ? "Phrase" : "Word"} added to the dictionary.`;
  event.currentTarget.reset();
  event.currentTarget.querySelector("button[type='submit']").textContent = "Add to dictionary";
});
document.querySelector("#addEntryForm").elements.namedItem("entryId").value = "";
document.querySelector("#editEntry").addEventListener("click", () => openEntryForEditing(activeDialogWord));
document.querySelector("#deleteEntry").addEventListener("click", async () => {
  const word = activeDialogWord;
  if (!word?.userAdded || !confirm(`Delete “${word.english}” from your entries?`)) return;
  const customIndex = customWords.findIndex((entry) => entry.id === word.id);
  if (customIndex !== -1) customWords.splice(customIndex, 1);
  words = words.filter((entry) => entry.id !== word.id);
  favorites = favorites.filter((favorite) => favorite !== word.roman);
  persistCustomWords();
  saveFavorites();
  await Promise.all([removeVoiceNote(word), removeVoiceNote(word, "phrase")]).catch(() => {});
  await refreshVoiceKeys().catch(() => {});
  renderCategoryFilters();
  renderWords();
  document.querySelector("#wordDialog").close();
});
document.querySelector("#exportEntriesCsv").addEventListener("click", () => {
  const headers = ["English", "Balochi Roman", "Balochi", "Urdu", "Balochi Sentence", "English Sentences", "Category", "Type"];
  const values = customWords.map((word) => [word.english, word.roman, word.balochi, word.urdu, word.example, word.exampleEnglish, word.categoryLabel || word.category, word.entryType || "word"]);
  downloadFile("darbarjah-my-entries.csv", [headers, ...values].map((row) => row.map(csvCell).join(",")).join("\r\n"), "text/csv;charset=utf-8");
  document.querySelector("#backupStatus").textContent = `Exported ${customWords.length} personal entries as CSV.`;
});
document.querySelector("#exportBackup").addEventListener("click", exportBackup);
document.querySelector("#importBackup").addEventListener("change", async (event) => {
  const [file] = event.currentTarget.files || [];
  if (file) await importBackup(file);
  event.currentTarget.value = "";
});
document.querySelector("#checkPronunciation").addEventListener("click", startPronunciationPractice);
document.querySelector("#wordDialog").addEventListener("click", (event) => {
  if (event.target === event.currentTarget) event.currentTarget.close();
});
document.querySelector("#wordDialog").addEventListener("close", () => {
  if (activeRecorder?.state === "recording") activeRecorder.stop();
  if (phraseRecorder?.state === "recording") phraseRecorder.stop();
  if (activeRecognition) {
    activeRecognition.onend = null;
    activeRecognition.abort();
    activeRecognition = null;
    document.querySelector("#checkPronunciation").disabled = false;
  }
});
document.querySelector("#recordVoice").addEventListener("click", async () => {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    document.querySelector("#voiceStatus").textContent = "Voice recording is not supported in this browser.";
    return;
  }
  try {
    activeRecordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordingChunks = [];
    activeRecorder = new MediaRecorder(activeRecordingStream);
    activeRecorder.addEventListener("dataavailable", (event) => { if (event.data.size) recordingChunks.push(event.data); });
    activeRecorder.addEventListener("stop", async () => {
      activeRecordingStream.getTracks().forEach((track) => track.stop());
      activeRecordingStream = null;
      document.querySelector("#recordVoice").disabled = false;
      document.querySelector("#stopVoice").disabled = true;
      if (!recordingChunks.length) return;
      try {
        const recording = new Blob(recordingChunks, { type: activeRecorder.mimeType || "audio/webm" });
        await saveVoiceNote(activeDialogWord, recording);
        document.querySelector("#voiceStatus").textContent = "Your voice is saved for this word.";
        document.querySelector("#dialogAudio").textContent = "▶ Play my recording";
        document.querySelector("#deleteVoice").hidden = false;
      } catch (error) {
        document.querySelector("#voiceStatus").textContent = "Could not save the recording in this browser.";
      }
    }, { once: true });
    activeRecorder.start();
    document.querySelector("#recordVoice").disabled = true;
    document.querySelector("#stopVoice").disabled = false;
    document.querySelector("#voiceStatus").textContent = "Recording… Say the word, then stop to save.";
  } catch (error) {
    document.querySelector("#voiceStatus").textContent = "Microphone access was not granted. Allow it in your browser and try again.";
  }
});
document.querySelector("#stopVoice").addEventListener("click", () => {
  if (activeRecorder?.state === "recording") activeRecorder.stop();
});
document.querySelector("#deleteVoice").addEventListener("click", async () => {
  try {
    await removeVoiceNote(activeDialogWord);
    document.querySelector("#voiceStatus").textContent = "Your recording was deleted.";
    document.querySelector("#deleteVoice").hidden = true;
    document.querySelector("#dialogAudio").textContent = "▶ Hear word";
  } catch (error) {
    document.querySelector("#voiceStatus").textContent = "Could not delete the saved recording.";
  }
});
document.querySelector("#playPhraseVoice").addEventListener("click", playPhraseRecording);
document.querySelector("#recordPhraseVoice").addEventListener("click", startPhraseRecording);
document.querySelector("#stopPhraseVoice").addEventListener("click", () => {
  if (phraseRecorder?.state === "recording") phraseRecorder.stop();
});
document.querySelector("#deletePhraseVoice").addEventListener("click", async () => {
  try {
    await removeVoiceNote(activeDialogWord, "phrase");
    document.querySelector("#phraseVoiceStatus").textContent = "Sentence recording deleted.";
    document.querySelector("#deletePhraseVoice").hidden = true;
  } catch (error) {
    document.querySelector("#phraseVoiceStatus").textContent = "Could not delete this recording.";
  }
});
document.querySelector("#startVoiceSession").addEventListener("click", () => {
  voiceSessionIndex = 0;
  renderVoiceSession();
  document.querySelector("#voiceSessionDialog").showModal();
});
document.querySelector("#closeVoiceSession").addEventListener("click", () => document.querySelector("#voiceSessionDialog").close());
document.querySelector("#voiceSessionDialog").addEventListener("click", (event) => {
  if (event.target === event.currentTarget) event.currentTarget.close();
});
document.querySelector("#voiceSessionDialog").addEventListener("close", () => {
  if (voiceSessionRecorder?.state === "recording") voiceSessionRecorder.stop();
});
document.querySelector("#voiceSessionHear").addEventListener("click", () => playReference(words[voiceSessionIndex], document.querySelector("#voiceSessionHear")));
document.querySelector("#voiceSessionRecord").addEventListener("click", startVoiceSessionRecording);
document.querySelector("#voiceSessionStop").addEventListener("click", () => {
  if (voiceSessionRecorder?.state === "recording") voiceSessionRecorder.stop();
});
document.querySelector("#voiceSessionNext").addEventListener("click", () => {
  if (voiceSessionRecorder?.state === "recording") return;
  voiceSessionIndex += 1;
  renderVoiceSession();
});
document.querySelector("#voiceSessionSkip").addEventListener("click", () => {
  if (voiceSessionRecorder?.state === "recording") return;
  voiceSessionIndex += 1;
  renderVoiceSession();
});
document.querySelector("#finishVoiceSession").addEventListener("click", () => document.querySelector("#voiceSessionDialog").close());
document.querySelector("#categoryFilters").addEventListener("click", (event) => {
  const button = event.target.closest(".filter");
  if (!button) return;
  activeCategory = button.dataset.category;
  document.querySelectorAll(".filter").forEach((item) => item.classList.toggle("active", item === button));
  renderWords();
});
document.querySelector("#quizContent").addEventListener("click", (event) => {
  const answerButton = event.target.closest("[data-answer]");
  if (answerButton && !quizAnswered) {
    quizAnswered = true;
    const isCorrect = answerButton.dataset.answer === "true";
    if (isCorrect) quizScore += 1;
    document.querySelectorAll("#quizContent [data-answer]").forEach((button) => {
      button.disabled = true;
      if (button.dataset.answer === "true") button.classList.add("correct");
      else if (button === answerButton) button.classList.add("incorrect");
    });
    document.querySelector("#quizResult").textContent = isCorrect ? "Correct! آفرین" : `Not quite. The answer is ${words[quizOrder[quizIndex]].english}.`;
    const nextButton = document.querySelector("[data-next-question]");
    nextButton.disabled = false;
    quizAdvanceTimer = setTimeout(() => {
      quizIndex += 1;
      quizAnswered = false;
      renderQuiz();
    }, 1400);
    return;
  }
  if (event.target.closest("[data-next-question]")) {
    clearTimeout(quizAdvanceTimer);
    quizIndex += 1;
    quizAnswered = false;
    renderQuiz();
    return;
  }
  if (event.target.closest("[data-quiz-restart]")) startQuiz();
});
document.querySelector("#phrasePlay").addEventListener("click", (event) => speak("Salaam, dost!", event.currentTarget));
document.querySelector("#themeToggle").addEventListener("click", () => document.body.classList.toggle("dark"));
document.querySelector("#flashcard").addEventListener("click", () => { flashRevealed = !flashRevealed; renderFlashcard(); });
document.querySelector("#flashcard").addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); flashRevealed = !flashRevealed; renderFlashcard(); } });
document.querySelector("#nextCard").addEventListener("click", () => { flashIndex += 1; flashRevealed = false; renderFlashcard(); });
document.querySelector("#suggestionForm").addEventListener("submit", (event) => { event.preventDefault(); const suggestions = JSON.parse(localStorage.getItem("darbarjah-suggestions") || localStorage.getItem("gwat-suggestions") || "[]"); suggestions.push(Object.fromEntries(new FormData(event.currentTarget))); localStorage.setItem("darbarjah-suggestions", JSON.stringify(suggestions)); event.currentTarget.reset(); document.querySelector("#suggestionStatus").textContent = "Thank you. Your suggestion is saved for review."; });
document.addEventListener("keydown", (event) => { if (event.key === "/" && document.activeElement !== searchInput) { event.preventDefault(); searchInput.focus(); } });

const welcomeDialog = document.querySelector("#welcomeDialog");
document.querySelector("#welcomeContinue").addEventListener("click", () => welcomeDialog.close());
if (!sessionStorage.getItem("darbarjah-welcome-shown")) {
  welcomeDialog.showModal();
  sessionStorage.setItem("darbarjah-welcome-shown", "true");
}

loadCsvWords().finally(async () => {
  await refreshVoiceKeys().catch(() => {});
  renderCategoryFilters();
  renderWords();
  renderDailyWord();
  renderFlashcard();
  startQuiz();
  document.querySelector("#startVoiceSession").disabled = false;
});
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js?v=17"));
