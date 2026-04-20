const DOM = {
  setupPanel: document.getElementById("setupPanel"),
  gamePanel: document.getElementById("gamePanel"),
  playerName: document.getElementById("playerName"),
  difficulty: document.getElementById("difficulty"),
  themeSelect: document.getElementById("themeSelect"),
  startGameBtn: document.getElementById("startGameBtn"),
  hudPlayer: document.getElementById("hudPlayer"),
  hudTheme: document.getElementById("hudTheme"),
  hudRound: document.getElementById("hudRound"),
  roundDots: document.getElementById("roundDots"),
  statsBtn: document.getElementById("statsBtn"),
  playAudioBtn: document.getElementById("playAudioBtn"),
  wordSlots: document.getElementById("wordSlots"),
  submitBtn: document.getElementById("submitBtn"),
  clearBtn: document.getElementById("clearBtn"),
  feedback: document.getElementById("feedback"),
  statsModal: document.getElementById("statsModal"),
  statsList: document.getElementById("statsList"),
  closeStatsBtn: document.getElementById("closeStatsBtn"),
  wordCard: document.getElementById("wordCard"),
  backToMenuBtn: document.getElementById("backToMenuBtn"),
  fxCanvas: document.getElementById("fxCanvas"),
  appShell: document.querySelector(".app-shell")
};

const state = {
  playerName: "",
  difficulty: "medium",
  selectedTheme: "animals",
  themes: {},
  roundNumber: 1,
  wordsPerRound: 4,
  roundBaseWords: [],
  roundWordStatuses: [],
  queue: [],
  queueIndexMap: [],
  currentQueueIndex: -1,
  currentWord: "",
  wordStats: {},
  mask: [],
  isLocked: false,
  speechVoice: null,
  utteranceRate: 0.88
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeWord(raw) {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\.mp3$/i, "")
    .replace(/[^a-z]/g, "");
}

function shuffle(arr) {
  const clone = [...arr];
  for (let i = clone.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

function setPanel(showGame) {
  DOM.setupPanel.classList.toggle("active", !showGame);
  DOM.gamePanel.classList.toggle("active", showGame);
  updateCompactMode();
}

function isLikelyMobile() {
  return window.matchMedia("(max-width: 760px)").matches;
}

function updateCompactMode() {
  const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  const keyboardLikelyOpen = window.visualViewport
    ? window.innerHeight - window.visualViewport.height > 130
    : false;
  const tightByHeight = viewportHeight < 660;
  const shouldCompact = isLikelyMobile() && (tightByHeight || keyboardLikelyOpen);
  document.body.classList.toggle("tight-space", shouldCompact);
}

function handleViewportResize() {
  updateCompactMode();
  updateSlotSize();
}

function updateSlotSize(wordLength = 0) {
  if (!DOM.wordSlots) {
    return;
  }

  const slots = Math.max(1, wordLength || DOM.wordSlots.children.length || 1);
  const containerWidth = DOM.wordCard ? DOM.wordCard.clientWidth : window.innerWidth;
  const maxSlotsInRow = isLikelyMobile() ? Math.min(slots, 8) : Math.min(slots, 10);
  const gap = Math.max(6, Math.min(10, Math.floor(containerWidth * 0.018)));
  const horizontalPadding = isLikelyMobile() ? 20 : 28;
  const usableWidth = Math.max(240, containerWidth - horizontalPadding);
  const computed = Math.floor((usableWidth - (maxSlotsInRow - 1) * gap) / maxSlotsInRow);
  const size = Math.max(34, Math.min(58, computed));

  DOM.wordSlots.style.setProperty("--slot-size", `${size}px`);
  DOM.wordSlots.style.setProperty("--slot-gap", `${gap}px`);
}

async function requestPortraitLock() {
  if (!isLikelyMobile() || !window.screen?.orientation?.lock) {
    return;
  }

  try {
    await window.screen.orientation.lock("portrait");
  } catch (_) {
    // Some browsers only allow orientation lock in fullscreen/PWA.
  }
}

function updateThemeSelect() {
  const current = state.selectedTheme;
  DOM.themeSelect.innerHTML = "";
  Object.keys(state.themes).forEach((themeName) => {
    const opt = document.createElement("option");
    opt.value = themeName;
    opt.textContent = themeName;
    DOM.themeSelect.appendChild(opt);
  });

  if (state.themes[current]) {
    DOM.themeSelect.value = current;
  } else {
    const first = Object.keys(state.themes)[0];
    state.selectedTheme = first;
    DOM.themeSelect.value = first;
  }
}

function initThemes() {
  const loaded = window.THEMES || {};
  const normalizedThemes = {};

  Object.entries(loaded).forEach(([themeName, words]) => {
    if (!Array.isArray(words)) {
      return;
    }

    const cleaned = words
      .map((w) => normalizeWord(String(w)))
      .filter((w) => w.length >= 2);

    if (cleaned.length) {
      normalizedThemes[themeName] = [...new Set(cleaned)];
    }
  });

  if (!Object.keys(normalizedThemes).length) {
    const err = document.getElementById("setupError");
    if (err) { err.textContent = "Nenhum tema encontrado. Verifique se os arquivos themes/*.js est\u00e3o presentes."; err.hidden = false; }
    DOM.startGameBtn.disabled = true;
    return;
  }

  state.themes = normalizedThemes;
  state.selectedTheme = Object.keys(normalizedThemes)[0];
  updateThemeSelect();
}

function chooseWordsForRound(themeWords, count) {
  if (themeWords.length === 0) {
    return [];
  }
  if (themeWords.length >= count) {
    return shuffle(themeWords).slice(0, count);
  }

  const selected = [];
  let idx = 0;
  const bag = shuffle(themeWords);
  while (selected.length < count) {
    selected.push(bag[idx % bag.length]);
    idx += 1;
  }
  return selected;
}

function getRevealCount(word, difficulty) {
  const len = word.length;
  if (difficulty === "hard") {
    return 0;
  }

  if (difficulty === "easy") {
    const blanks = Math.min(2, Math.max(1, len));
    return Math.max(0, len - blanks);
  }

  const targetBlanks = Math.max(3, Math.min(len, len - 2));
  let reveal = len - targetBlanks;
  reveal = Math.min(2, Math.max(0, reveal));
  if (len <= 3) {
    reveal = Math.max(0, len - 2);
  }
  return reveal;
}

function buildMask(word, difficulty) {
  const len = word.length;
  const revealCount = getRevealCount(word, difficulty);
  const indexes = Array.from({ length: len }, (_, i) => i);
  const revealSet = new Set(shuffle(indexes).slice(0, revealCount));
  return indexes.map((idx) => revealSet.has(idx));
}

function renderWordInputs(word, mask) {
  DOM.wordSlots.innerHTML = "";
  updateSlotSize(word.length);

  for (let i = 0; i < word.length; i += 1) {
    if (mask[i]) {
      const slot = document.createElement("div");
      slot.className = "slot";
      slot.dataset.index = String(i);
      slot.textContent = word[i].toUpperCase();
      DOM.wordSlots.appendChild(slot);
    } else {
      const input = document.createElement("input");
      input.className = "letter-input";
      input.type = "text";
      input.maxLength = 1;
      input.inputMode = "text";
      input.autocomplete = "off";
      input.spellcheck = false;
      input.dataset.index = String(i);
      input.setAttribute("aria-label", `Letra ${i + 1}`);
      input.addEventListener("input", onLetterInput);
      input.addEventListener("keydown", onLetterKeyDown);
      DOM.wordSlots.appendChild(input);
    }
  }

  const firstBlank = DOM.wordSlots.querySelector(".letter-input");
  if (firstBlank) {
    firstBlank.focus();
  }
}

function onLetterInput(e) {
  const target = e.target;
  target.value = target.value.replace(/[^a-zA-Z]/g, "").slice(0, 1).toUpperCase();
  target.classList.remove("wrong", "correct");
  updateSubmitVisibility();

  if (target.value) {
    const all = [...DOM.wordSlots.querySelectorAll(".letter-input")];
    const currentIndex = all.indexOf(target);
    const next = all[currentIndex + 1];
    if (next) {
      next.focus();
    }
  }
}

function onLetterKeyDown(e) {
  const target = e.target;
  if (e.key !== "Backspace" || target.value) {
    return;
  }

  const all = [...DOM.wordSlots.querySelectorAll(".letter-input")];
  const currentIndex = all.indexOf(target);
  const prev = all[currentIndex - 1];
  if (prev) {
    prev.focus();
  }
}

function getTypedWord() {
  const chars = [];
  const children = [...DOM.wordSlots.children];
  for (const node of children) {
    if (node.classList.contains("slot")) {
      chars.push(node.textContent.toLowerCase());
    } else {
      chars.push((node.value || "").toLowerCase());
    }
  }
  return chars.join("");
}

function isWordComplete() {
  const inputs = [...DOM.wordSlots.querySelectorAll(".letter-input")];
  if (!inputs.length) {
    return false;
  }
  return inputs.every((el) => Boolean(el.value.trim()));
}

function updateSubmitVisibility() {
  const canSubmit = !state.isLocked && isWordComplete();
  DOM.submitBtn.hidden = !canSubmit;
}

function ensureWordStats(word) {
  if (!state.wordStats[word]) {
    state.wordStats[word] = {
      attempts: 0,
      correct: 0,
      wrongSpellings: new Set()
    };
  }
  return state.wordStats[word];
}

function recordWordAttempt(word, typed, isCorrect) {
  const stat = ensureWordStats(word);
  stat.attempts += 1;
  if (isCorrect) {
    stat.correct += 1;
    return;
  }

  const wrong = (typed || "").trim().toLowerCase();
  if (wrong && wrong !== word) {
    stat.wrongSpellings.add(wrong);
  }
}

function renderStatsList() {
  if (!DOM.statsList) {
    return;
  }

  const rows = Object.entries(state.wordStats)
    .map(([word, data]) => {
      const rate = data.attempts > 0 ? (data.correct / data.attempts) * 100 : 0;
      return { word, data, rate };
    })
    .sort((a, b) => {
      if (b.rate !== a.rate) {
        return b.rate - a.rate;
      }
      if (b.data.attempts !== a.data.attempts) {
        return b.data.attempts - a.data.attempts;
      }
      return a.word.localeCompare(b.word);
    });

  DOM.statsList.innerHTML = "";
  if (!rows.length) {
    const empty = document.createElement("div");
    empty.className = "stats-empty";
    empty.textContent = "Ainda não há palavras jogadas.";
    DOM.statsList.appendChild(empty);
    return;
  }

  rows.forEach(({ word, data, rate }) => {
    const row = document.createElement("article");
    row.className = "stats-row";

    const top = document.createElement("div");
    top.className = "stats-row-top";

    const wordEl = document.createElement("strong");
    wordEl.className = "stats-word";
    wordEl.textContent = word;

    const wrongCount = data.attempts - data.correct;
    const summaryEl = document.createElement("span");
    summaryEl.className = "stats-summary";
    summaryEl.textContent = `${Math.round(rate)}% • ${data.correct}/${data.attempts} • erros: ${wrongCount}`;

    top.appendChild(wordEl);
    top.appendChild(summaryEl);
    row.appendChild(top);

    if (data.wrongSpellings.size) {
      const wrong = document.createElement("div");
      wrong.className = "stats-wrong";
      wrong.textContent = `Grafias erradas: ${[...data.wrongSpellings].map((w) => w.toUpperCase()).join(", ")}`;
      row.appendChild(wrong);
    }

    DOM.statsList.appendChild(row);
  });
}

function openStatsModal() {
  renderStatsList();
  DOM.statsModal.hidden = false;
}

function closeStatsModal() {
  DOM.statsModal.hidden = true;
}

function showFeedback(text, kind = "") {
  DOM.feedback.textContent = text;
  DOM.feedback.className = `feedback ${kind}`.trim();
}

async function playWordAudio(word) {
  await new Promise((resolve) => {
    const audio = new Audio(`audios/${word}.mp3`);
    audio.addEventListener("canplaythrough", () => {
      audio.play().then(resolve).catch(() => { speakWord(word); resolve(); });
    }, { once: true });
    audio.addEventListener("error", () => { speakWord(word); resolve(); }, { once: true });
    audio.load();
  });
}

function chooseEnglishVoice() {
  const voices = speechSynthesis.getVoices();
  if (!voices.length) {
    return null;
  }
  const preferred = voices.find((v) => /^en(-|_)/i.test(v.lang) && /female|zira|samantha|google us english/i.test(v.name));
  return preferred || voices.find((v) => /^en(-|_)/i.test(v.lang)) || voices[0];
}

function speakWord(word) {
  if (!("speechSynthesis" in window)) {
    return;
  }
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = "en-US";
  utterance.rate = state.utteranceRate;
  utterance.pitch = 1;
  if (!state.speechVoice) {
    state.speechVoice = chooseEnglishVoice();
  }
  if (state.speechVoice) {
    utterance.voice = state.speechVoice;
  }
  speechSynthesis.speak(utterance);
}

function setLocked(locked) {
  state.isLocked = locked;
  DOM.submitBtn.disabled = locked;
  DOM.clearBtn.disabled = locked;
  DOM.playAudioBtn.disabled = locked;
  DOM.wordSlots.querySelectorAll(".letter-input").forEach((el) => {
    el.disabled = locked;
  });
  updateSubmitVisibility();
}

function markWrongLetters(targetWord) {
  const children = [...DOM.wordSlots.children];
  children.forEach((node, idx) => {
    const expected = targetWord[idx].toUpperCase();
    if (node.classList.contains("letter-input")) {
      const value = (node.value || "").toUpperCase();
      node.classList.toggle("wrong", value !== expected);
      node.classList.toggle("correct", value === expected);
    }
  });
}

function revealCorrectWord(word) {
  DOM.wordSlots.innerHTML = "";
  for (const ch of word) {
    const slot = document.createElement("div");
    slot.className = "slot all-correct";
    slot.textContent = ch.toUpperCase();
    DOM.wordSlots.appendChild(slot);
  }
  updateSubmitVisibility();
}

function renderRoundDots() {
  if (!DOM.roundDots) {
    return;
  }

  DOM.roundDots.innerHTML = "";
  state.roundWordStatuses.forEach((status, idx) => {
    const dot = document.createElement("span");
    dot.className = "round-dot";
    if (status === "done") {
      dot.classList.add("done");
    } else if (status === "failed") {
      dot.classList.add("failed");
    }
    dot.setAttribute("role", "img");
    dot.setAttribute("aria-label", `Palavra ${idx + 1}: ${status}`);
    DOM.roundDots.appendChild(dot);
  });
}

function allRoundWordsSolved() {
  return state.roundWordStatuses.length > 0 && state.roundWordStatuses.every((status) => status === "done");
}

function updateHud() {
  DOM.hudPlayer.textContent = state.playerName;
  DOM.hudTheme.textContent = state.selectedTheme;
  DOM.hudRound.textContent = String(state.roundNumber);
  renderRoundDots();
}

function nextWordsPerRound() {
  if (state.wordsPerRound < 10) {
    state.wordsPerRound += 1;
  } else {
    state.wordsPerRound = 10;
  }
}

async function startRound() {
  const words = state.themes[state.selectedTheme] || [];
  state.roundBaseWords = chooseWordsForRound(words, state.wordsPerRound);
  state.queue = [...state.roundBaseWords];
  state.queueIndexMap = state.roundBaseWords.map((_, idx) => idx);
  state.roundWordStatuses = state.roundBaseWords.map(() => "pending");
  state.currentQueueIndex = -1;
  updateHud();
  await loadNextWord();
}

async function loadNextWord() {
  showFeedback("");

  if (state.queue.length === 0) {
    if (allRoundWordsSolved()) {
      await celebrateRoundClear();
      state.roundNumber += 1;
      nextWordsPerRound();
      await startRound();
      return;
    }
  }

  state.currentQueueIndex = state.queueIndexMap.shift();
  state.currentWord = state.queue.shift();
  ensureWordStats(state.currentWord);
  state.mask = buildMask(state.currentWord, state.difficulty);
  renderWordInputs(state.currentWord, state.mask);
  setLocked(false);
  await playWordAudio(state.currentWord);
}

async function celebrateRoundClear() {
  showFeedback("Excelente! Rodada completa!", "ok");
  await playFireworks(1900);
  showFeedback("Pronto para a próxima rodada!", "ok");
  await wait(350);
}

async function handleSubmit() {
  if (state.isLocked || !state.currentWord) {
    return;
  }

  const typed = getTypedWord();
  const target = state.currentWord;

  const blanks = [...DOM.wordSlots.querySelectorAll(".letter-input")].filter((el) => !el.value.trim());
  if (typed.length !== target.length || blanks.length) {
    showFeedback("Preencha todas as letras.", "error");
    if (blanks.length) {
      blanks[0].focus();
    }
    return;
  }

  if (typed.toLowerCase() === target.toLowerCase()) {
    recordWordAttempt(target, typed, true);
    showFeedback("Boa! Você acertou!", "ok");
    if (state.currentQueueIndex >= 0) {
      state.roundWordStatuses[state.currentQueueIndex] = "done";
      renderRoundDots();
    }
    revealCorrectWord(target);
    setLocked(true);
    await wait(650);
    await loadNextWord();
    return;
  }

  setLocked(true);
  recordWordAttempt(target, typed, false);
  markWrongLetters(target);
  showFeedback("Ops! Tente de novo depois do terremoto!", "error");
  if (state.currentQueueIndex >= 0 && state.roundWordStatuses[state.currentQueueIndex] !== "done") {
    state.roundWordStatuses[state.currentQueueIndex] = "failed";
    renderRoundDots();
  }
  state.queue.push(target);
  state.queueIndexMap.push(state.currentQueueIndex);

  DOM.wordCard.classList.add("earthquake");
  await wait(700);
  DOM.wordCard.classList.remove("earthquake");

  revealCorrectWord(target);
  showFeedback(`Resposta correta: ${target.toUpperCase()}`, "ok");
  await wait(1200);
  await loadNextWord();
}

function clearInputs() {
  DOM.wordSlots.querySelectorAll(".letter-input").forEach((el) => {
    el.value = "";
    el.classList.remove("wrong", "correct");
  });
  const first = DOM.wordSlots.querySelector(".letter-input");
  if (first) {
    first.focus();
  }
  updateSubmitVisibility();
  showFeedback("");
}

function startGame() {
  const name = DOM.playerName.value.trim();
  if (!name) {
    DOM.playerName.focus();
    alert("Digite o nome do jogador.");
    return;
  }

  const theme = DOM.themeSelect.value;
  const themeWords = state.themes[theme] || [];
  if (!themeWords.length) {
    alert("Esse tema não possui palavras válidas.");
    return;
  }

  state.playerName = name;
  state.selectedTheme = theme;
  state.difficulty = DOM.difficulty.value;
  state.roundNumber = 1;
  state.wordsPerRound = 4;

  requestPortraitLock();
  setPanel(true);
  startRound();
}

function attachEvents() {
  DOM.themeSelect.addEventListener("change", (e) => {
    state.selectedTheme = e.target.value;
  });

  DOM.startGameBtn.addEventListener("click", startGame);

  DOM.playAudioBtn.addEventListener("click", () => {
    if (!state.currentWord || state.isLocked) {
      return;
    }
    playWordAudio(state.currentWord);
  });

  DOM.submitBtn.addEventListener("click", handleSubmit);
  DOM.clearBtn.addEventListener("click", clearInputs);

  DOM.statsBtn.addEventListener("click", openStatsModal);
  DOM.closeStatsBtn.addEventListener("click", closeStatsModal);
  DOM.statsModal.addEventListener("click", (e) => {
    if (e.target === DOM.statsModal) {
      closeStatsModal();
    }
  });

  DOM.backToMenuBtn.addEventListener("click", () => {
    setLocked(false);
    setPanel(false);
    showFeedback("");
  });

  DOM.wordSlots.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !DOM.statsModal.hidden) {
      closeStatsModal();
    }
  });

  if ("speechSynthesis" in window) {
    speechSynthesis.onvoiceschanged = () => {
      state.speechVoice = chooseEnglishVoice();
    };
  }
}

function resizeCanvas() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  DOM.fxCanvas.width = Math.floor(window.innerWidth * dpr);
  DOM.fxCanvas.height = Math.floor(window.innerHeight * dpr);
  const ctx = DOM.fxCanvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  handleViewportResize();
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function createParticle(width, height) {
  const side = Math.random() < 0.5 ? 0 : width;
  return {
    x: side,
    y: randomBetween(0, height * 0.4),
    vx: side === 0 ? randomBetween(2, 5) : randomBetween(-5, -2),
    vy: randomBetween(-4, 1),
    ay: 0.1,
    size: randomBetween(4, 8),
    life: randomBetween(40, 85),
    color: ["#ff4f78", "#ffd56b", "#67cf76", "#38b6ff", "#ff8b3d"][Math.floor(Math.random() * 5)]
  };
}

async function playFireworks(durationMs = 1800) {
  const ctx = DOM.fxCanvas.getContext("2d");
  const width = window.innerWidth;
  const height = window.innerHeight;
  const particles = [];
  const start = performance.now();

  return new Promise((resolve) => {
    function frame(now) {
      const elapsed = now - start;
      ctx.clearRect(0, 0, width, height);

      if (elapsed < durationMs) {
        for (let i = 0; i < 8; i += 1) {
          particles.push(createParticle(width, height));
        }
      }

      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.life -= 1;
        p.vy += p.ay;
        p.x += p.vx;
        p.y += p.vy;

        ctx.globalAlpha = Math.max(0, p.life / 85);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        if (p.life <= 0) {
          particles.splice(i, 1);
        }
      }

      ctx.globalAlpha = 1;

      if (elapsed < durationMs || particles.length > 0) {
        requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, width, height);
        resolve();
      }
    }

    requestAnimationFrame(frame);
  });
}

function init() {
  initThemes();
  attachEvents();
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", handleViewportResize);
  }
  state.speechVoice = chooseEnglishVoice();
  handleViewportResize();
}

init();
