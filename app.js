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
  hudCoins: document.getElementById("hudCoins"),
  roundDots: document.getElementById("roundDots"),
  mascotPrevBtn: document.getElementById("mascotPrevBtn"),
  mascotNextBtn: document.getElementById("mascotNextBtn"),
  mascotCarouselViewport: document.getElementById("mascotCarouselViewport"),
  mascotCarouselTrack: document.getElementById("mascotCarouselTrack"),
  mascotCarouselLabel: document.getElementById("mascotCarouselLabel"),
  openShopBtn: document.getElementById("openShopBtn"),
  shopModal: document.getElementById("shopModal"),
  closeShopBtn: document.getElementById("closeShopBtn"),
  setupCoins: document.getElementById("setupCoins"),
  shopCoins: document.getElementById("shopCoins"),
  shopAvatarPreview: document.getElementById("shopAvatarPreview"),
  shopItems: document.getElementById("shopItems"),
  mascotSidePop: document.getElementById("mascotSidePop"),
  mascotDanceOverlay: document.getElementById("mascotDanceOverlay"),
  mascotDanceStage: document.getElementById("mascotDanceStage"),
  statsBtn: document.getElementById("statsBtn"),
  toggleMusicBtn: document.getElementById("toggleMusicBtn"),
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
  bgmAudio: null,
  bgmStarted: false,
  mask: [],
  isLocked: false,
  speechVoice: null,
  utteranceRate: 0.88,
  audioClickTimes: [],
  isAudioEasterEggPlaying: false,
  audioEasterEggLevel: 0,
  isAudioPenaltyActive: false,
  isMusicEnabled: true,
  mascotId: "fox",
  coins: 150,
  ownedItems: new Set(),
  equippedItems: {
    hat: null,
    glasses: null,
    outfit: null
  }
};

const SOUND_PATHS = {
  start: "sounds/start.mp3",
  success: "sounds/success.mp3",
  error: "sounds/error.mp3",
  applause: "sounds/applause.mp3",
  bgm: "sounds/bgm_calm.mp3"
};

const SOUND_VOLUMES = {
  start: 0.35,
  success: 0.4,
  error: 0.32,
  applause: 0.42,
  bgm: 0.15
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const EASTER_EGG_WINDOW_MS = 5000;
const EASTER_EGG_TRIGGER_CLICKS = 10;
const EASTER_EGG_PENALTY_MS = 20000;
const DEFAULT_AUDIO_BUTTON_TEXT = "🔈 Ouça";
const SAD_AUDIO_BUTTON_TEXT = "☹️ Ouça";
const MASCOT_CATALOG = {
  fox: {
    label: "Rubi Raposa",
    base: "#f48b3d",
    accent: "#ffd9b0",
    ear: "#ca5f1c"
  },
  panda: {
    label: "Lumi Panda",
    base: "#ffffff",
    accent: "#1f2f45",
    ear: "#0f1726"
  },
  robot: {
    label: "Zig Robo",
    base: "#9be0ff",
    accent: "#2f6db4",
    ear: "#1f4f87"
  }
};
const SHOP_ITEMS = [
  { id: "hat-comet", name: "Bone Cometa", slot: "hat", price: 55, className: "wear-hat-comet" },
  { id: "hat-crown", name: "Coroa Estelar", slot: "hat", price: 95, className: "wear-hat-crown" },
  { id: "glasses-star", name: "Oculos Star", slot: "glasses", price: 60, className: "wear-glasses-star" },
  { id: "glasses-neon", name: "Oculos Neon", slot: "glasses", price: 80, className: "wear-glasses-neon" },
  { id: "outfit-cape", name: "Capa Heroi", slot: "outfit", price: 110, className: "wear-outfit-cape" },
  { id: "outfit-jacket", name: "Jaqueta Pixel", slot: "outfit", price: 130, className: "wear-outfit-jacket" }
];
const EASTER_EGG_PHRASES = [
  "Please, click more gently.",
  "Please stop clicking so quickly.",
  "You are clicking too much. Please slow down.",
  "I am getting upset. Please stop spamming this button.",
  "Enough. I am leaving. I cannot stay here with you."
];
const MASCOT_IDS = Object.keys(MASCOT_CATALOG);
const mascotCarouselDrag = {
  pointerId: null,
  startX: 0,
  deltaX: 0,
  isDragging: false
};
let mascotCarouselDisplayIndex = 1;
let mascotCarouselSnapTimer = null;
const MASCOT_CAROUSEL_TRANSITION_MS = 260;

function updateAudioButtonState() {
  if (state.isAudioPenaltyActive) {
    DOM.playAudioBtn.disabled = true;
    DOM.playAudioBtn.textContent = SAD_AUDIO_BUTTON_TEXT;
    DOM.playAudioBtn.setAttribute("aria-label", "Áudio temporariamente indisponível");
    return;
  }

  DOM.playAudioBtn.disabled = state.isLocked || state.isAudioEasterEggPlaying;
  DOM.playAudioBtn.textContent = DEFAULT_AUDIO_BUTTON_TEXT;
  DOM.playAudioBtn.setAttribute("aria-label", "Ouvir palavra");
}

function updateMusicButtonState() {
  if (!DOM.toggleMusicBtn) {
    return;
  }

  DOM.toggleMusicBtn.textContent = state.isMusicEnabled ? "♪ Música: On" : "♪ Música: Off";
  DOM.toggleMusicBtn.setAttribute(
    "aria-label",
    state.isMusicEnabled ? "Desabilitar música" : "Habilitar música"
  );
}

function isAudioMutedByPenalty() {
  return state.isAudioPenaltyActive;
}

function getEquippedClassNames() {
  return Object.values(state.equippedItems)
    .map((itemId) => SHOP_ITEMS.find((item) => item.id === itemId)?.className || "")
    .filter(Boolean)
    .join(" ");
}

function createMascotAvatar({ mascotId = state.mascotId, pose = "front", dancing = false } = {}) {
  const cfg = MASCOT_CATALOG[mascotId] || MASCOT_CATALOG.fox;
  const avatar = document.createElement("div");
  avatar.className = `mascot-avatar mascot-${mascotId} pose-${pose} ${dancing ? "dancing" : ""} ${getEquippedClassNames()}`.trim();
  avatar.style.setProperty("--mascot-base", cfg.base);
  avatar.style.setProperty("--mascot-accent", cfg.accent);
  avatar.style.setProperty("--mascot-ear", cfg.ear);

  avatar.innerHTML = `
    <div class="mascot-shadow"></div>
    <div class="mascot-body"></div>
    <div class="mascot-head">
      <div class="mascot-ear ear-left"></div>
      <div class="mascot-ear ear-right"></div>
      <div class="mascot-eye eye-left"></div>
      <div class="mascot-eye eye-right"></div>
      <div class="mascot-blush blush-left"></div>
      <div class="mascot-blush blush-right"></div>
      <div class="mascot-mouth"></div>
      <div class="mascot-visor"></div>
      <div class="mascot-antenna"></div>
    </div>
    <div class="mascot-outfit-layer"></div>
    <div class="mascot-hat"></div>
    <div class="mascot-glasses"></div>
  `;

  return avatar;
}

function updateCoinDisplays() {
  if (DOM.hudCoins) {
    DOM.hudCoins.textContent = String(state.coins);
  }
  if (DOM.setupCoins) {
    DOM.setupCoins.textContent = String(state.coins);
  }
  if (DOM.shopCoins) {
    DOM.shopCoins.textContent = String(state.coins);
  }
}

function renderAvatarPreview(targetEl) {
  if (!targetEl) {
    return;
  }
  targetEl.innerHTML = "";
  targetEl.appendChild(createMascotAvatar({ pose: "front" }));
}

function renderShopAvatarPreview() {
  renderAvatarPreview(DOM.shopAvatarPreview);
}

function updateMascotCarouselPosition({ animate = true } = {}) {
  if (!DOM.mascotCarouselTrack) {
    return;
  }

  DOM.mascotCarouselTrack.style.transition = animate
    ? `transform ${MASCOT_CAROUSEL_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
    : "none";
  DOM.mascotCarouselTrack.style.transform = `translateX(-${mascotCarouselDisplayIndex * 100}%)`;
}

function getMascotCarouselTrackIndex(mascotIndex) {
  if (MASCOT_IDS.length <= 1) {
    return 0;
  }

  return mascotIndex + 1;
}

function clearMascotCarouselSnapTimer() {
  if (mascotCarouselSnapTimer !== null) {
    window.clearTimeout(mascotCarouselSnapTimer);
    mascotCarouselSnapTimer = null;
  }
}

function queueMascotCarouselSnap(trackIndex) {
  clearMascotCarouselSnapTimer();
  mascotCarouselSnapTimer = window.setTimeout(() => {
    mascotCarouselDisplayIndex = trackIndex;
    updateMascotCarouselPosition({ animate: false });
    updateMascotCarouselActiveCard();
    mascotCarouselSnapTimer = null;
  }, MASCOT_CAROUSEL_TRANSITION_MS + 20);
}

function buildMascotCarouselSequence() {
  if (MASCOT_IDS.length <= 1) {
    return [...MASCOT_IDS];
  }

  return [MASCOT_IDS[MASCOT_IDS.length - 1], ...MASCOT_IDS, MASCOT_IDS[0]];
}

function updateMascotSelectionViews(direction = null) {
  updateMascotCarouselPosition();
  updateMascotCarouselActiveCard(direction);
  updateMascotCarouselLabel();
  renderShopAvatarPreview();
}

function selectMascotByIndex(nextIndex, { direction = 1 } = {}) {
  const total = MASCOT_IDS.length;
  if (!total) {
    return;
  }

  clearMascotCarouselSnapTimer();

  const currentIndex = MASCOT_IDS.indexOf(state.mascotId);
  const normalizedIndex = (nextIndex + total) % total;
  state.mascotId = MASCOT_IDS[normalizedIndex];

  let targetTrackIndex = getMascotCarouselTrackIndex(normalizedIndex);
  let snapTrackIndex = null;

  if (total > 1 && direction > 0 && currentIndex === total - 1 && normalizedIndex === 0) {
    targetTrackIndex = total + 1;
    snapTrackIndex = getMascotCarouselTrackIndex(normalizedIndex);
  } else if (total > 1 && direction < 0 && currentIndex === 0 && normalizedIndex === total - 1) {
    targetTrackIndex = 0;
    snapTrackIndex = getMascotCarouselTrackIndex(normalizedIndex);
  }

  mascotCarouselDisplayIndex = targetTrackIndex;
  updateMascotSelectionViews(direction);

  if (snapTrackIndex !== null) {
    queueMascotCarouselSnap(snapTrackIndex);
  }
}

function nudgeMascotCarousel(step) {
  const currentIndex = MASCOT_IDS.indexOf(state.mascotId);
  selectMascotByIndex(currentIndex + step, { direction: step >= 0 ? 1 : -1 });
}

function beginMascotCarouselDrag(pointerId, clientX) {
  if (!DOM.mascotCarouselViewport || !DOM.mascotCarouselTrack) {
    return;
  }

  clearMascotCarouselSnapTimer();
  mascotCarouselDrag.pointerId = pointerId;
  mascotCarouselDrag.startX = clientX;
  mascotCarouselDrag.deltaX = 0;
  mascotCarouselDrag.isDragging = true;
  DOM.mascotCarouselViewport.classList.add("is-dragging");
  DOM.mascotCarouselTrack.style.transition = "none";
}

function updateMascotCarouselActiveCard(direction = null) {
  if (!DOM.mascotCarouselTrack) {
    return;
  }

  const cards = [...DOM.mascotCarouselTrack.children];
  cards.forEach((card) => {
    const isSelectedMascot = card.dataset.mascotId === state.mascotId;
    const isVisibleCard = Number(card.dataset.trackIndex) === mascotCarouselDisplayIndex;
    card.classList.toggle("is-active", isSelectedMascot);
    card.classList.remove("is-entering");
    if (isVisibleCard && direction !== null) {
      card.style.setProperty("--carousel-entry-shift", `${direction >= 0 ? 28 : -28}px`);
      card.classList.add("is-entering");
      window.setTimeout(() => {
        card.classList.remove("is-entering");
      }, 320);
    }
  });
}

function updateMascotCarouselLabel() {
  if (!DOM.mascotCarouselLabel) {
    return;
  }

  DOM.mascotCarouselLabel.textContent = (MASCOT_CATALOG[state.mascotId] || MASCOT_CATALOG.fox).label;
}

function renderMascotCarousel() {
  if (!DOM.mascotCarouselTrack) {
    return;
  }

  clearMascotCarouselSnapTimer();
  DOM.mascotCarouselTrack.innerHTML = "";
  const currentIndex = Math.max(0, MASCOT_IDS.indexOf(state.mascotId));
  mascotCarouselDisplayIndex = getMascotCarouselTrackIndex(currentIndex);

  buildMascotCarouselSequence().forEach((mascotId, trackIndex) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "mascot-carousel-card";
    card.dataset.mascotId = mascotId;
    card.dataset.trackIndex = String(trackIndex);
    card.setAttribute("aria-label", `Selecionar ${MASCOT_CATALOG[mascotId].label}`);
    card.appendChild(createMascotAvatar({ mascotId }));
    card.addEventListener("click", () => {
      if (mascotId === state.mascotId) {
        return;
      }
      const currentIndex = MASCOT_IDS.indexOf(state.mascotId);
      const targetIndex = MASCOT_IDS.indexOf(mascotId);
      const total = MASCOT_IDS.length;
      
      // Calcular distância circular em ambas as direções
      const forwardDist = (targetIndex - currentIndex + total) % total;
      const backwardDist = (currentIndex - targetIndex + total) % total;
      
      // Escolher direção circular mais curta.
      const direction = forwardDist <= backwardDist ? 1 : -1;

      selectMascotByIndex(targetIndex, { direction });
    });
    DOM.mascotCarouselTrack.appendChild(card);
  });

  updateMascotCarouselPosition({ animate: false });
  updateMascotCarouselActiveCard();
  updateMascotCarouselLabel();
}

function moveMascotCarouselDrag(clientX) {
  if (!mascotCarouselDrag.isDragging || !DOM.mascotCarouselViewport || !DOM.mascotCarouselTrack) {
    return;
  }

  mascotCarouselDrag.deltaX = clientX - mascotCarouselDrag.startX;
  const viewportWidth = DOM.mascotCarouselViewport.clientWidth || 1;
  const baseOffset = -mascotCarouselDisplayIndex * viewportWidth;
  DOM.mascotCarouselTrack.style.transform = `translateX(${baseOffset + mascotCarouselDrag.deltaX}px)`;
}

function endMascotCarouselDrag() {
  if (!mascotCarouselDrag.isDragging || !DOM.mascotCarouselViewport) {
    return;
  }

  const threshold = Math.min(60, DOM.mascotCarouselViewport.clientWidth * 0.18);
  const delta = mascotCarouselDrag.deltaX;
  mascotCarouselDrag.pointerId = null;
  mascotCarouselDrag.startX = 0;
  mascotCarouselDrag.deltaX = 0;
  mascotCarouselDrag.isDragging = false;
  DOM.mascotCarouselViewport.classList.remove("is-dragging");

  if (Math.abs(delta) >= threshold) {
    nudgeMascotCarousel(delta < 0 ? 1 : -1);
    return;
  }

  updateMascotCarouselPosition();
}

function buyOrEquipItem(itemId) {
  const item = SHOP_ITEMS.find((candidate) => candidate.id === itemId);
  if (!item) {
    return;
  }

  if (!state.ownedItems.has(itemId)) {
    if (state.coins < item.price) {
      showFeedback("Moedas insuficientes para esse item.", "error");
      return;
    }
    state.coins -= item.price;
    state.ownedItems.add(itemId);
  }

  state.equippedItems[item.slot] = state.equippedItems[item.slot] === itemId ? null : itemId;
  renderShopItems();
  renderMascotCarousel();
  renderCoinDisplays();
}

function renderShopItems() {
  if (!DOM.shopItems) {
    return;
  }

  DOM.shopItems.innerHTML = "";
  SHOP_ITEMS.forEach((item) => {
    const owned = state.ownedItems.has(item.id);
    const equipped = state.equippedItems[item.slot] === item.id;

    const card = document.createElement("article");
    card.className = `shop-item ${equipped ? "equipped" : ""}`.trim();

    const title = document.createElement("h5");
    title.textContent = item.name;

    const slot = document.createElement("p");
    slot.className = "shop-slot";
    slot.textContent = `Tipo: ${item.slot}`;

    const price = document.createElement("p");
    price.className = "shop-price";
    price.textContent = owned ? "Comprado" : `${item.price} moedas`;

    const btn = document.createElement("button");
    btn.className = "btn ghost shop-btn";
    btn.disabled = !owned && state.coins < item.price;
    if (equipped) {
      btn.textContent = "Remover";
    } else if (owned) {
      btn.textContent = "Equipar";
    } else {
      btn.textContent = "Comprar";
    }
    btn.addEventListener("click", () => buyOrEquipItem(item.id));

    card.appendChild(title);
    card.appendChild(slot);
    card.appendChild(price);
    card.appendChild(btn);
    DOM.shopItems.appendChild(card);
  });
}

function initMascotSetup() {
  if (!DOM.mascotCarouselTrack) {
    return;
  }

  clearMascotCarouselSnapTimer();

  if (!MASCOT_CATALOG[state.mascotId]) {
    state.mascotId = MASCOT_IDS[0];
  }

  renderMascotCarousel();
  renderShopAvatarPreview();
  updateCoinDisplays();
}

function openShopModal() {
  if (!DOM.shopModal) {
    return;
  }
  renderShopAvatarPreview();
  renderShopItems();
  updateCoinDisplays();
  DOM.shopModal.hidden = false;
}

function closeShopModal() {
  if (!DOM.shopModal) {
    return;
  }
  DOM.shopModal.hidden = true;
}

function showMascotSidePop() {
  if (!DOM.mascotSidePop) {
    return;
  }
  DOM.mascotSidePop.innerHTML = "";
  DOM.mascotSidePop.appendChild(createMascotAvatar({ pose: "profile" }));
  DOM.mascotSidePop.classList.remove("active");
  // Restart animation cleanly.
  void DOM.mascotSidePop.offsetWidth;
  DOM.mascotSidePop.classList.add("active");
}

async function showMascotDanceCelebration(durationMs = 1900) {
  if (!DOM.mascotDanceOverlay || !DOM.mascotDanceStage) {
    return;
  }

  DOM.mascotDanceStage.innerHTML = "";
  DOM.mascotDanceStage.appendChild(createMascotAvatar({ pose: "front", dancing: true }));
  DOM.mascotDanceOverlay.hidden = false;
  await wait(durationMs);
  DOM.mascotDanceOverlay.hidden = true;
  DOM.mascotDanceStage.innerHTML = "";
}

async function applyEasterEggOutcome(phraseIndex) {
  if (phraseIndex >= EASTER_EGG_PHRASES.length - 1) {
    state.isAudioPenaltyActive = true;
    updateAudioButtonState();

    if (state.bgmAudio) {
      state.bgmAudio.pause();
    }

    await wait(EASTER_EGG_PENALTY_MS);

    state.isAudioPenaltyActive = false;
    state.audioEasterEggLevel = 0;

    if (state.bgmAudio && state.isMusicEnabled && DOM.gamePanel.classList.contains("active")) {
      state.bgmAudio.play().then(() => {
        state.bgmStarted = true;
      }).catch(() => {
        state.bgmStarted = false;
      });
    }
  } else {
    state.audioEasterEggLevel += 1;
  }
}

function registerAudioRapidClick() {
  const now = Date.now();
  state.audioClickTimes.push(now);
  state.audioClickTimes = state.audioClickTimes.filter((time) => now - time <= EASTER_EGG_WINDOW_MS);
  return state.audioClickTimes.length >= EASTER_EGG_TRIGGER_CLICKS;
}

async function playStopClickingEasterEgg() {
  state.isAudioEasterEggPlaying = true;
  updateAudioButtonState();
  state.audioClickTimes = [];

  const phraseIndex = Math.min(state.audioEasterEggLevel, EASTER_EGG_PHRASES.length - 1);
  const phrase = EASTER_EGG_PHRASES[phraseIndex];

  if (!("speechSynthesis" in window)) {
    await wait(2200);
    state.isAudioEasterEggPlaying = false;
    await applyEasterEggOutcome(phraseIndex);
    updateAudioButtonState();
    return;
  }

  await new Promise((resolve) => {
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(phrase);
    utterance.lang = "en-US";
    utterance.rate = 0.92;
    utterance.pitch = 1;

    if (!state.speechVoice) {
      state.speechVoice = chooseEnglishVoice();
    }

    if (state.speechVoice) {
      utterance.voice = state.speechVoice;
    }

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    speechSynthesis.speak(utterance);
  });

  state.isAudioEasterEggPlaying = false;
  await applyEasterEggOutcome(phraseIndex);
  updateAudioButtonState();
}

function playSfx(name) {
  if (isAudioMutedByPenalty()) {
    return;
  }

  const src = SOUND_PATHS[name];
  if (!src) {
    return;
  }

  const sfx = new Audio(src);
  sfx.volume = SOUND_VOLUMES[name] ?? 0.35;
  sfx.play().catch(() => {});
}

function startBackgroundMusic() {
  if (!state.isMusicEnabled) {
    return;
  }

  if (!state.bgmAudio) {
    const audio = new Audio(SOUND_PATHS.bgm);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = SOUND_VOLUMES.bgm;
    state.bgmAudio = audio;
  }

  if (state.bgmStarted) {
    return;
  }

  state.bgmAudio.currentTime = 0;
  state.bgmAudio.play().then(() => {
    state.bgmStarted = true;
  }).catch(() => {
    state.bgmStarted = false;
  });
}

function stopBackgroundMusic() {
  if (!state.bgmAudio) {
    return;
  }

  state.bgmAudio.pause();
  state.bgmAudio.currentTime = 0;
  state.bgmStarted = false;
}

function toggleMusic() {
  state.isMusicEnabled = !state.isMusicEnabled;
  updateMusicButtonState();

  if (!state.isMusicEnabled) {
    stopBackgroundMusic();
    return;
  }

  if (DOM.gamePanel.classList.contains("active") && !state.isAudioPenaltyActive) {
    startBackgroundMusic();
  }
}

function normalizeWord(raw) {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\.mp3$/i, "")
    .replace(/[^a-z\s-]/g, " ")
    .replace(/\s*-\s*/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/\s+/g, " ")
    .trim();
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

function updateSlotSize(wordText = "") {
  if (!DOM.wordSlots) {
    return;
  }

  const sourceWord = (wordText || state.currentWord || "").toLowerCase();
  const lettersOnly = sourceWord.replace(/[\s-]/g, "");
  const spacesCount = (sourceWord.match(/\s/g) || []).length;
  const hyphenCount = (sourceWord.match(/-/g) || []).length;
  const slots = Math.max(1, lettersOnly.length || DOM.wordSlots.querySelectorAll(".slot, .letter-input").length || 1);
  const visualUnits = slots + spacesCount * 0.55 + hyphenCount * 0.38;
  const hasSpaces = spacesCount > 0;
  const containerWidth = DOM.wordCard ? DOM.wordCard.clientWidth : window.innerWidth;
  const gap = Math.max(6, Math.min(10, Math.floor(containerWidth * 0.018)));
  const horizontalPadding = isLikelyMobile() ? 22 : 30;
  const safety = 12;
  const usableWidth = Math.max(180, containerWidth - horizontalPadding - safety);

  const minSingleLineSize = isLikelyMobile() ? 26 : 30;
  const visualElements = Math.max(1, slots + spacesCount + hyphenCount);
  const singleLineComputed = Math.floor((usableWidth - (visualElements - 1) * gap) / visualUnits);
  const canStaySingleLine = slots + hyphenCount <= 12 && singleLineComputed >= minSingleLineSize;

  let size;
  if (canStaySingleLine) {
    size = Math.max(minSingleLineSize, Math.min(58, singleLineComputed));
    DOM.wordSlots.classList.add("single-row");
    DOM.wordSlots.classList.remove("break-at-space");
  } else {
    const maxSlotsInRow = isLikelyMobile() ? Math.min(slots, 8) : Math.min(slots, 10);
    const wrappedComputed = Math.floor((usableWidth - (maxSlotsInRow - 1) * gap) / maxSlotsInRow);
    size = Math.max(26, Math.min(58, wrappedComputed));
    DOM.wordSlots.classList.remove("single-row");
    DOM.wordSlots.classList.toggle("break-at-space", hasSpaces && isLikelyMobile());
  }

  DOM.wordSlots.style.setProperty("--slot-size", `${size}px`);
  DOM.wordSlots.style.setProperty("--slot-gap", `${gap}px`);
}

function appendRenderedWordSegment(token, startIndex, mask, { revealAll = false } = {}) {
  const segment = document.createElement("div");
  segment.className = "word-segment";

  for (let offset = 0; offset < token.length; offset += 1) {
    const ch = token[offset];
    const index = startIndex + offset;

    if (ch === "-") {
      const hyphen = document.createElement("div");
      hyphen.className = "hyphen-slot";
      hyphen.dataset.index = String(index);
      hyphen.setAttribute("aria-hidden", "true");
      segment.appendChild(hyphen);
      continue;
    }

    if (revealAll || mask[index]) {
      const slot = document.createElement("div");
      slot.className = revealAll ? "slot all-correct" : "slot";
      slot.dataset.index = String(index);
      slot.textContent = ch.toUpperCase();
      segment.appendChild(slot);
      continue;
    }

    const input = document.createElement("input");
    input.className = "letter-input";
    input.type = "text";
    input.maxLength = 1;
    input.inputMode = "text";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.dataset.index = String(index);
    input.setAttribute("aria-label", `Letra ${index + 1}`);
    input.addEventListener("input", onLetterInput);
    input.addEventListener("keydown", onLetterKeyDown);
    segment.appendChild(input);
  }

  DOM.wordSlots.appendChild(segment);
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
  const indexes = Array.from({ length: word.length }, (_, i) => i);
  const letterIndexes = indexes.filter((idx) => /[a-z]/.test(word[idx]));
  const revealCount = getRevealCount(letterIndexes.map(() => "a").join(""), difficulty);
  const revealSet = new Set(shuffle(letterIndexes).slice(0, revealCount));

  return indexes.map((idx) => {
    if (!/[a-z]/.test(word[idx])) {
      return true;
    }
    return revealSet.has(idx);
  });
}

function renderWordInputs(word, mask) {
  DOM.wordSlots.innerHTML = "";
  updateSlotSize(word);

  let index = 0;
  const tokens = word.split(" ");

  tokens.forEach((token, tokenIndex) => {
    appendRenderedWordSegment(token, index, mask);
    index += token.length;

    if (tokenIndex < tokens.length - 1) {
      const spacer = document.createElement("div");
      spacer.className = "space-slot";
      spacer.dataset.index = String(index);
      spacer.setAttribute("aria-hidden", "true");
      DOM.wordSlots.appendChild(spacer);
      index += 1;
    }
  });

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
    if (node.classList.contains("space-slot")) {
      chars.push(" ");
    } else {
      const segmentChildren = [...node.children];
      for (const segmentNode of segmentChildren) {
        if (segmentNode.classList.contains("hyphen-slot")) {
          chars.push("-");
        } else if (segmentNode.classList.contains("slot")) {
          chars.push(segmentNode.textContent.toLowerCase());
        } else {
          chars.push((segmentNode.value || "").toLowerCase());
        }
      }
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
  DOM.feedback.classList.toggle("has-text", Boolean(text));
}

async function playWordAudio(word) {
  if (isAudioMutedByPenalty()) {
    return;
  }

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
  if (!("speechSynthesis" in window) || isAudioMutedByPenalty()) {
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
  updateAudioButtonState();
  DOM.wordSlots.querySelectorAll(".letter-input").forEach((el) => {
    el.disabled = locked;
  });
  updateSubmitVisibility();
}

function markWrongLetters(targetWord) {
  const inputs = [...DOM.wordSlots.querySelectorAll(".letter-input")];
  inputs.forEach((node) => {
    const idx = Number(node.dataset.index);
    const expected = targetWord[idx]?.toUpperCase() || "";
    const value = (node.value || "").toUpperCase();
    node.classList.toggle("wrong", value !== expected);
    node.classList.toggle("correct", value === expected);
  });
}

function revealCorrectWord(word) {
  DOM.wordSlots.innerHTML = "";
  updateSlotSize(word);

  let index = 0;
  const tokens = word.split(" ");
  tokens.forEach((token, tokenIndex) => {
    appendRenderedWordSegment(token, index, [], { revealAll: true });
    index += token.length;

    if (tokenIndex < tokens.length - 1) {
      const spacer = document.createElement("div");
      spacer.className = "space-slot";
      spacer.setAttribute("aria-hidden", "true");
      DOM.wordSlots.appendChild(spacer);
      index += 1;
    }
  });

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
    if (idx === state.currentQueueIndex) {
      dot.classList.add("current");
    }
    if (status === "done") {
      dot.classList.add("done");
    } else if (status === "failed") {
      dot.classList.add("failed");
    }
    dot.setAttribute("role", "img");
    const statusText = status === "pending" ? "pendente" : status;
    const currentText = idx === state.currentQueueIndex ? " (atual)" : "";
    dot.setAttribute("aria-label", `Palavra ${idx + 1}: ${statusText}${currentText}`);
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
  updateCoinDisplays();
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
  renderRoundDots();
  ensureWordStats(state.currentWord);
  state.mask = buildMask(state.currentWord, state.difficulty);
  renderWordInputs(state.currentWord, state.mask);
  setLocked(false);
  await playWordAudio(state.currentWord);
}

async function celebrateRoundClear() {
  const celebrationDurationMs = 1900;
  state.coins += 40;
  updateCoinDisplays();
  playSfx("applause");
  showFeedback("Excelente! Rodada completa!", "ok");
  const mascotDancePromise = showMascotDanceCelebration(celebrationDurationMs);
  await playFireworks(1900);
  await mascotDancePromise;
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
    state.coins += 12;
    updateCoinDisplays();
    playSfx("success");
    recordWordAttempt(target, typed, true);
    showFeedback("Boa! Você acertou!", "ok");
    showMascotSidePop();
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
  playSfx("error");
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

  playSfx("start");
  startBackgroundMusic();
  closeShopModal();
  setPanel(true);
  startRound();
}

function attachEvents() {
  DOM.themeSelect.addEventListener("change", (e) => {
    state.selectedTheme = e.target.value;
  });

  if (DOM.mascotPrevBtn) {
    DOM.mascotPrevBtn.addEventListener("click", () => nudgeMascotCarousel(-1));
  }

  if (DOM.mascotNextBtn) {
    DOM.mascotNextBtn.addEventListener("click", () => nudgeMascotCarousel(1));
  }

  if (DOM.mascotCarouselViewport) {
    DOM.mascotCarouselViewport.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }
      beginMascotCarouselDrag(event.pointerId, event.clientX);
      DOM.mascotCarouselViewport.setPointerCapture(event.pointerId);
    });

    DOM.mascotCarouselViewport.addEventListener("pointermove", (event) => {
      if (event.pointerId !== mascotCarouselDrag.pointerId) {
        return;
      }
      moveMascotCarouselDrag(event.clientX);
    });

    DOM.mascotCarouselViewport.addEventListener("pointerup", (event) => {
      if (event.pointerId !== mascotCarouselDrag.pointerId) {
        return;
      }
      endMascotCarouselDrag();
    });

    DOM.mascotCarouselViewport.addEventListener("pointercancel", (event) => {
      if (event.pointerId !== mascotCarouselDrag.pointerId) {
        return;
      }
      endMascotCarouselDrag();
    });

    DOM.mascotCarouselViewport.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        nudgeMascotCarousel(-1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        nudgeMascotCarousel(1);
      }
    });
  }

  DOM.openShopBtn.addEventListener("click", () => {
    openShopModal();
  });

  DOM.closeShopBtn.addEventListener("click", closeShopModal);

  DOM.shopModal.addEventListener("click", (e) => {
    if (e.target === DOM.shopModal) {
      closeShopModal();
    }
  });

  DOM.startGameBtn.addEventListener("click", startGame);

  if (DOM.toggleMusicBtn) {
    DOM.toggleMusicBtn.addEventListener("click", toggleMusic);
  }

  DOM.playAudioBtn.addEventListener("click", async () => {
    if (!state.currentWord || state.isLocked || state.isAudioEasterEggPlaying || state.isAudioPenaltyActive) {
      return;
    }

    if (registerAudioRapidClick()) {
      await playStopClickingEasterEgg();
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
    closeShopModal();
    renderShopAvatarPreview();
    updateCoinDisplays();
    showFeedback("");
    stopBackgroundMusic();
  });

  DOM.wordSlots.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && DOM.shopModal && !DOM.shopModal.hidden) {
      closeShopModal();
      return;
    }

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
  initMascotSetup();
  attachEvents();
  updateAudioButtonState();
  updateMusicButtonState();
  if (DOM.mascotDanceOverlay) {
    DOM.mascotDanceOverlay.hidden = true;
  }
  closeShopModal();
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", handleViewportResize);
  }
  state.speechVoice = chooseEnglishVoice();
  handleViewportResize();
}

init();
