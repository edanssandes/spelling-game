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
  hudWordCount: document.getElementById("hudWordCount"),
  playAudioBtn: document.getElementById("playAudioBtn"),
  wordSlots: document.getElementById("wordSlots"),
  submitBtn: document.getElementById("submitBtn"),
  clearBtn: document.getElementById("clearBtn"),
  feedback: document.getElementById("feedback"),
  wordCard: document.getElementById("wordCard"),
  backToMenuBtn: document.getElementById("backToMenuBtn"),
  fxCanvas: document.getElementById("fxCanvas")
};

const state = {
  playerName: "",
  difficulty: "medium",
  selectedTheme: "animals",
  themes: {},
  roundNumber: 1,
  wordsPerRound: 4,
  roundBaseWords: [],
  queue: [],
  solvedInRound: new Set(),
  currentWord: "",
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
}

function updateHud() {
  DOM.hudPlayer.textContent = state.playerName;
  DOM.hudTheme.textContent = state.selectedTheme;
  DOM.hudRound.textContent = String(state.roundNumber);
  DOM.hudWordCount.textContent = String(state.wordsPerRound);
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
  state.solvedInRound = new Set();
  updateHud();
  await loadNextWord();
}

async function loadNextWord() {
  showFeedback("");

  if (state.queue.length === 0) {
    if (state.solvedInRound.size >= state.roundBaseWords.length) {
      await celebrateRoundClear();
      state.roundNumber += 1;
      nextWordsPerRound();
      await startRound();
      return;
    }
  }

  state.currentWord = state.queue.shift();
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
    showFeedback("Boa! Você acertou!", "ok");
    state.solvedInRound.add(target);
    revealCorrectWord(target);
    setLocked(true);
    await wait(650);
    await loadNextWord();
    return;
  }

  setLocked(true);
  markWrongLetters(target);
  showFeedback("Ops! Tente de novo depois do terremoto!", "error");
  state.queue.push(target);

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
  state.speechVoice = chooseEnglishVoice();
}

init();
