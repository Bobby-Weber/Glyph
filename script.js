const supabaseUrl = "https://eewwhibfdxmcyuradnjf.supabase.co";
const supabaseUrlPlaceholder = "YOUR_SUPABASE_PROJECT_URL_HERE";
const supabasePublishableKey = "sb_publishable_sNCwxOQHkicGjnX_-Pfusg_2eJ5wXXU";
const supabaseClient = createSupabaseClient();

const emojiDisplay = document.querySelector("#emoji-display");
const statsButton = document.querySelector("#stats-button");
const puzzleDate = document.querySelector("#puzzle-date");
const gameTitle = document.querySelector("#game-title");
const gameTagline = document.querySelector("#game-tagline");
const timerBar = document.querySelector("#timer-bar");
const timerDisplay = document.querySelector("#timer-display");
const startScreen = document.querySelector("#start-screen");
const startButton = document.querySelector("#start-button");
const gameContent = document.querySelector("#game-content");
const modeToggle = document.querySelector("#mode-toggle");
const statsScreen = document.querySelector("#stats-screen");
const backButton = document.querySelector("#back-button");
const statsList = document.querySelector("#stats-list");
const modeDragButton = document.querySelector("#mode-drag");
const modeClickButton = document.querySelector("#mode-click");
const answerSlots = document.querySelector("#answer-slots");
const letterTiles = document.querySelector("#letter-tiles");
const message = document.querySelector("#message");
const successModal = document.querySelector("#success-modal");
const modalTime = document.querySelector("#modal-time");
const modalAnswer = document.querySelector("#modal-answer");
const backToPuzzleButton = document.querySelector("#back-to-puzzle");
const statsModalButton = document.querySelector("#stats-modal-button");
const shareResultsButton = document.querySelector("#share-results-button");
const deleteModal = document.querySelector("#delete-modal");
const cancelDeleteButton = document.querySelector("#cancel-delete");
const confirmDeleteButton = document.querySelector("#confirm-delete");
const developerPanel = document.querySelector("#developer-panel");
const developerForm = document.querySelector("#developer-form");
const developerKey = document.querySelector("#developer-key");
const developerScheduled = document.querySelector("#developer-scheduled");
const developerDaily = document.querySelector("#developer-daily");
const developerEmoji = document.querySelector("#developer-emoji");
const developerScrambled = document.querySelector("#developer-scrambled");
const developerAnswer = document.querySelector("#developer-answer");
const developerMessage = document.querySelector("#developer-message");
const queueStatus = document.querySelector("#queue-status");
const queueList = document.querySelector("#queue-list");
const queueSidebar = document.querySelector("#queue-sidebar");

const defaultPuzzle = {
  emoji: "\u{1F355}",
  answer: "PIZZA",
  scrambled: "ZAPIZ",
};

const statsStorageKey = "glyph-daily-stats";
const gameStartDate = new Date(2026, 5, 1);

let currentPuzzle = { ...defaultPuzzle };
let currentPuzzleDateKey = getTodayDateKey();
let draggedTile = null;
let hasWon = false;
let roundStarted = false;
let roundStartTimestamp = null;
let timerInterval = null;
let finalRoundTime = null;
let currentView = "game";
let inputMode = window.localStorage.getItem("glyph-input-mode") === "click" ? "click" : "drag";
let currentQueueItems = [];
let activePointerTile = null;
let activePointerOrigin = null;
let pointerOffsetX = 0;
let pointerOffsetY = 0;
let pointerGhost = null;
let pointerDropTarget = null;
let queueRefreshTimer = null;
let queuePollTimer = null;
let deleteTargetQueueItemId = null;
let dailyPuzzleArchive = new Map();
const developerKeyStorage = "glyph-dev-key";

function createSupabaseClient() {
  const supabaseLibrary = globalThis.supabase ?? window.supabase;

  if (supabaseUrl === supabaseUrlPlaceholder || !supabaseLibrary) {
    return null;
  }

  return supabaseLibrary.createClient(supabaseUrl, supabasePublishableKey);
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function normalizeText(value) {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

function normalizeAnswerDisplay(value) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function toLocalDateTimeInputValue(date) {
  const offsetMilliseconds = date.getTimezoneOffset() * 60 * 1000;
  const localDate = new Date(date.getTime() - offsetMilliseconds);
  return localDate.toISOString().slice(0, 16);
}

function parseDateTimeInputValue(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatQueueDateTime(value) {
  const date = new Date(value);
  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatShareDate(date) {
  return date.toLocaleDateString([], {
    month: "long",
    day: "2-digit",
    year: "numeric",
  });
}

function buildShareText(dateLabel, emoji, durationMs) {
  return `Glyph ${dateLabel} ${emoji} ${formatDuration(durationMs || 0)}`;
}

function getDateLabelForKey(dateKey) {
  return getDateLabelFromKey(dateKey);
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayDateKey() {
  return toDateKey(new Date());
}

function getDateLabelFromKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString([], {
    month: "long",
    day: "2-digit",
    year: "numeric",
  });
}

function loadLocalStats() {
  try {
    const stored = window.localStorage.getItem(statsStorageKey);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveLocalStats(stats) {
  window.localStorage.setItem(statsStorageKey, JSON.stringify(stats));
}

function getDailyStat(stats, dateKey) {
  return stats[dateKey] || {
    started: false,
    completed: false,
    durationMs: null,
    startedAt: null,
    completedAt: null,
    emoji: null,
  };
}

function recordDailyStart(dateKey = currentPuzzleDateKey) {
  const stats = loadLocalStats();
  const existing = getDailyStat(stats, dateKey);

  if (!existing.started) {
    stats[dateKey] = {
      ...existing,
      started: true,
      startedAt: Date.now(),
      emoji: currentPuzzle.emoji,
    };
    saveLocalStats(stats);
  }
}

function recordDailyCompletion(durationMs, dateKey = currentPuzzleDateKey) {
  const stats = loadLocalStats();
  const existing = getDailyStat(stats, dateKey);

  stats[dateKey] = {
    ...existing,
    started: true,
    completed: true,
    durationMs,
    startedAt: existing.startedAt || Date.now() - durationMs,
    completedAt: Date.now(),
    emoji: existing.emoji || currentPuzzle.emoji,
  };

  saveLocalStats(stats);
}

function buildStatsDays() {
  const days = [];
  const today = new Date();

  for (let cursor = new Date(gameStartDate); cursor <= today; cursor.setDate(cursor.getDate() + 1)) {
    days.push(toDateKey(cursor));
  }

  return days.reverse();
}

function renderStatsList() {
  const stats = loadLocalStats();
  const days = buildStatsDays();

  statsList.replaceChildren();

  days.forEach((dateKey) => {
    const dayStat = getDailyStat(stats, dateKey);
    const item = document.createElement("div");
    item.className = "stats-item";
    const archivedPuzzle = dailyPuzzleArchive.get(dateKey) || null;

    if (archivedPuzzle) {
      item.classList.add("is-clickable");
      item.tabIndex = 0;
      item.setAttribute("role", "button");
      item.setAttribute("aria-label", `Open puzzle for ${getDateLabelFromKey(dateKey)}`);
      item.addEventListener("click", () => openArchivedPuzzle(dateKey));
      item.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openArchivedPuzzle(dateKey);
        }
      });
    }

    const dateLabel = document.createElement("div");
    dateLabel.className = "stats-item-date";
    dateLabel.textContent = getDateLabelFromKey(dateKey);

    const emojiLabel = document.createElement("span");
    emojiLabel.className = "stats-item-emoji";
    emojiLabel.textContent = dayStat.emoji || "?";

    const header = document.createElement("div");
    header.className = "stats-item-header";
    header.append(dateLabel, emojiLabel);

    const meta = document.createElement("div");
    meta.className = "stats-item-meta";

    if (dayStat.completed) {
      item.classList.add("is-complete");
      meta.textContent = `Completed in ${formatDuration(dayStat.durationMs || 0)}`;

      const shareButton = document.createElement("button");
      shareButton.type = "button";
      shareButton.className = "stats-share-button";
      shareButton.textContent = "Share";
      shareButton.addEventListener("click", async (event) => {
        event.stopPropagation();
        const shareText = buildShareText(getDateLabelFromKey(dateKey), dayStat.emoji || "?", dayStat.durationMs || 0);

        try {
          await navigator.clipboard.writeText(shareText);
          shareButton.textContent = "Copied!";
          window.setTimeout(() => {
            shareButton.textContent = "Share";
          }, 1500);
        } catch {
          shareButton.textContent = "Copy failed";
          window.setTimeout(() => {
            shareButton.textContent = "Share";
          }, 1500);
        }
      });

      const metaGroup = document.createElement("div");
      metaGroup.className = "stats-item-meta-group";
      metaGroup.append(meta, shareButton);
      item.append(header, metaGroup);
    } else if (dayStat.started) {
      item.classList.add("is-missed");
      meta.textContent = "Started, not completed";
      item.append(header, meta);
    } else {
      meta.textContent = "Not started";
      item.append(header, meta);
    }

    statsList.appendChild(item);
  });
}
function sortLetters(value) {
  return normalizeText(value).split("").sort().join("");
}

function isDeveloperMode() {
  const query = new URLSearchParams(window.location.search);
  return query.has("dev") || query.has("developer") || query.get("mode") === "developer";
}

function isClickMode() {
  return inputMode === "click";
}

function getEmptyAnswerSlot() {
  return [...answerSlots.querySelectorAll(".slot")].find((slot) => !slot.firstElementChild) || null;
}

function getPlacementHint() {
  return isClickMode()
    ? "Click a letter to place it in the next empty slot."
    : "Drag each letter into a slot to solve it.";
}

function setDefaultScheduledTime() {
  developerScheduled.value = toLocalDateTimeInputValue(new Date(Date.now() + 5 * 60 * 1000));
}

function setCurrentPuzzle(nextPuzzle, dateKey, shouldRender = true) {
  currentPuzzle = { ...nextPuzzle };
  currentPuzzleDateKey = dateKey;
  hasWon = false;
  roundStarted = false;
  roundStartTimestamp = null;
  finalRoundTime = null;
  stopTimer();
  updateTimerDisplay(0);

  if (shouldRender) {
    renderPuzzle();
  }
}

function fillCompletedPuzzleDisplay() {
  const answer = normalizeAnswerDisplay(currentPuzzle.answer);
  const tilesByLetter = new Map();

  [...letterTiles.querySelectorAll('.tile')].forEach((tile) => {
    const letter = tile.dataset.letter;
    if (!tilesByLetter.has(letter)) {
      tilesByLetter.set(letter, []);
    }
    tilesByLetter.get(letter).push(tile);
  });

  const slots = [...answerSlots.querySelectorAll('.slot')];
  let slotIndex = 0;

  answer.split('').forEach((character) => {
    if (character === ' ') {
      return;
    }

    const slot = slots[slotIndex];
    const tileQueue = tilesByLetter.get(character) || [];
    const tile = tileQueue.shift();

    if (slot && tile) {
      slot.appendChild(tile);
      tile.classList.add('correct');
    }

    slotIndex += 1;
  });

  hasWon = true;
  message.textContent = 'Correct! Deliciously unscrambled.';
}

function updateTimerDisplay(milliseconds = 0) {
  timerDisplay.textContent = formatDuration(milliseconds);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  if (roundStartTimestamp !== null) {
    finalRoundTime = Date.now() - roundStartTimestamp;
    updateTimerDisplay(finalRoundTime);
  }
}

function startTimer(elapsedMilliseconds = 0) {
  roundStarted = true;
  roundStartTimestamp = Date.now() - elapsedMilliseconds;
  finalRoundTime = null;
  updateTimerDisplay(elapsedMilliseconds);

  if (timerInterval) {
    clearInterval(timerInterval);
  }

  timerInterval = setInterval(() => {
    if (roundStartTimestamp === null) {
      return;
    }

    updateTimerDisplay(Date.now() - roundStartTimestamp);
  }, 250);
}

function showGameContent() {
  startScreen.hidden = true;
  startScreen.setAttribute("aria-hidden", "true");
  startScreen.style.display = "none";
  gameContent.hidden = false;
  startButton.blur();
}

function startRound() {
  if (roundStarted) {
    return;
  }

  showGameContent();
  recordDailyStart();
  startTimer();
}

function updateViewVisibility() {
  const isGameView = currentView === "game";

  document.body.classList.toggle("is-stats-view", !isGameView);
  gameTitle.hidden = !isGameView;
  gameTagline.hidden = !isGameView;
  timerBar.hidden = !isGameView;
  startScreen.hidden = !isGameView || roundStarted;
  gameContent.hidden = !isGameView || !roundStarted;
  modeToggle.hidden = !isGameView;
  statsButton.hidden = !isGameView;
  statsScreen.hidden = isGameView;
  developerPanel.hidden = !isGameView || !isDeveloperMode();
  queueSidebar.hidden = !isGameView || !isDeveloperMode();
}

function showGameView() {
  currentView = "game";
  updateViewVisibility();
  if (roundStarted) {
    gameContent.hidden = false;
    startScreen.hidden = true;
  }
}

function showStatsView() {
  currentView = "stats";
  updateViewVisibility();
  void refreshDailyArchiveFromSupabase().finally(() => {
    renderStatsList();
  });
}

function updateModeToggleUI() {
  modeDragButton.setAttribute("aria-pressed", String(inputMode === "drag"));
  modeClickButton.setAttribute("aria-pressed", String(inputMode === "click"));
}

function setInputMode(nextMode) {
  inputMode = nextMode;
  window.localStorage.setItem("glyph-input-mode", nextMode);
  updateModeToggleUI();
  updateTileDraggability();

  if (activePointerTile) {
    cancelPointerDrag();
  }

  message.textContent = getPlacementHint();
}

function animateTileMove(tile, targetParent, beforeNode = null) {
  const startRect = tile.getBoundingClientRect();

  if (beforeNode) {
    targetParent.insertBefore(tile, beforeNode);
  } else {
    targetParent.appendChild(tile);
  }

  const endRect = tile.getBoundingClientRect();
  const deltaX = startRect.left - endRect.left;
  const deltaY = startRect.top - endRect.top;

  tile.animate(
    [
      { transform: `translate(${deltaX}px, ${deltaY}px) scale(1)` },
      { transform: "translate(0, 0) scale(1)" },
    ],
    {
      duration: 240,
      easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    }
  );
}

function moveTileToBank(tile) {
  animateTileMove(tile, letterTiles);
  clearTileStatus();
  if (!hasWon) {
    message.textContent = getPlacementHint();
  }
  checkAnswer();
}

function moveTileToNextEmptySlot(tile) {
  const emptySlot = getEmptyAnswerSlot();

  if (!emptySlot) {
    message.textContent = "All answer slots are already filled.";
    return;
  }

  animateTileMove(tile, emptySlot);
  checkAnswer();
}

function handleTileClick(tile) {
  if (hasWon || inputMode !== "click") {
    return;
  }

  if (tile.parentElement?.classList.contains("slot")) {
    moveTileToBank(tile);
    return;
  }

  if (tile.parentElement === letterTiles) {
    moveTileToNextEmptySlot(tile);
  }
}

function createTile(letter, index) {
  const tile = document.createElement("button");
  tile.className = "tile";
  tile.type = "button";
  tile.textContent = letter;
  tile.draggable = inputMode === "drag";
  tile.dataset.letter = letter;
  tile.id = `tile-${index}`;
  tile.setAttribute("aria-label", `Letter ${letter}`);

  tile.addEventListener("dragstart", (event) => {
    draggedTile = tile;
    tile.classList.add("dragging");
    event.dataTransfer.setData("text/plain", tile.id);
  });

  tile.addEventListener("dragend", () => {
    draggedTile = null;
    tile.classList.remove("dragging");
  });

  tile.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch" || !tile.draggable) {
      return;
    }

    if (hasWon) {
      return;
    }

    event.preventDefault();
    beginPointerDrag(tile, event);
  });

  tile.addEventListener("click", () => {
    handleTileClick(tile);
  });

  return tile;
}

function createSpaceSlot() {
  const space = document.createElement("div");
  space.className = "slot-space";
  space.setAttribute("aria-hidden", "true");
  return space;
}

function createSlot(index) {
  const slot = document.createElement("div");
  slot.className = "slot";
  slot.dataset.index = index;
  slot.setAttribute("aria-label", `Answer slot ${index + 1}`);

  slot.addEventListener("dragover", (event) => {
    event.preventDefault();
    slot.classList.add("drag-over");
  });

  slot.addEventListener("dragleave", () => {
    slot.classList.remove("drag-over");
  });

  slot.addEventListener("drop", (event) => {
    event.preventDefault();
    slot.classList.remove("drag-over");

    if (!draggedTile || hasWon) {
      return;
    }

    const previousParent = draggedTile.parentElement;
    const replacedTile = slot.firstElementChild;

    if (replacedTile && previousParent !== slot) {
      previousParent.appendChild(replacedTile);
    }

    slot.appendChild(draggedTile);
    checkAnswer();
  });

  return slot;
}

function createPointerGhost(tile) {
  const ghost = tile.cloneNode(true);
  ghost.classList.add("pointer-ghost");
  ghost.style.width = `${tile.getBoundingClientRect().width}px`;
  ghost.style.height = `${tile.getBoundingClientRect().height}px`;
  document.body.appendChild(ghost);
  return ghost;
}

function updatePointerGhost(event) {
  if (!pointerGhost) {
    return;
  }

  pointerGhost.style.transform = `translate(${event.clientX - pointerOffsetX}px, ${event.clientY - pointerOffsetY}px)`;

  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".slot, .letter-tiles");

  if (pointerDropTarget && pointerDropTarget !== target) {
    pointerDropTarget.classList.remove("drag-over");
  }

  pointerDropTarget = target;

  if (pointerDropTarget) {
    pointerDropTarget.classList.add("drag-over");
  }
}

function commitPointerDrop(event) {
  if (!activePointerTile) {
    return;
  }

  const dropTarget = document.elementFromPoint(event.clientX, event.clientY)?.closest(".slot, .letter-tiles");

  if (pointerDropTarget) {
    pointerDropTarget.classList.remove("drag-over");
  }

  if (dropTarget?.classList.contains("slot")) {
    const previousParent = activePointerTile.parentElement;
    const replacedTile = dropTarget.firstElementChild;

    if (replacedTile && previousParent !== dropTarget) {
      previousParent.appendChild(replacedTile);
    }

    dropTarget.appendChild(activePointerTile);
    checkAnswer();
  } else if (dropTarget?.classList.contains("letter-tiles")) {
    letterTiles.appendChild(activePointerTile);
    clearTileStatus();
    message.textContent = getPlacementHint();
  } else if (activePointerOrigin) {
    activePointerOrigin.appendChild(activePointerTile);
  }

  if (pointerGhost) {
    pointerGhost.remove();
  }

  activePointerTile.classList.remove("dragging");
  activePointerTile = null;
  activePointerOrigin = null;
  pointerGhost = null;
  pointerDropTarget = null;

  document.removeEventListener("pointermove", updatePointerGhost);
  document.removeEventListener("pointerup", commitPointerDrop);
  document.removeEventListener("pointercancel", cancelPointerDrag);
}

function cancelPointerDrag() {
  if (pointerGhost) {
    pointerGhost.remove();
  }

  if (pointerDropTarget) {
    pointerDropTarget.classList.remove("drag-over");
  }

  if (activePointerTile) {
    activePointerTile.classList.remove("dragging");
  }

  activePointerTile = null;
  activePointerOrigin = null;
  pointerGhost = null;
  pointerDropTarget = null;

  document.removeEventListener("pointermove", updatePointerGhost);
  document.removeEventListener("pointerup", commitPointerDrop);
  document.removeEventListener("pointercancel", cancelPointerDrag);
}

function beginPointerDrag(tile, event) {
  activePointerTile = tile;
  activePointerOrigin = tile.parentElement;
  pointerOffsetX = event.clientX - event.currentTarget.getBoundingClientRect().left;
  pointerOffsetY = event.clientY - event.currentTarget.getBoundingClientRect().top;
  pointerGhost = createPointerGhost(tile);
  tile.classList.add("dragging");

  document.addEventListener("pointermove", updatePointerGhost);
  document.addEventListener("pointerup", commitPointerDrop);
  document.addEventListener("pointercancel", cancelPointerDrag);
  updatePointerGhost(event);
}

async function playVictoryAnimation(slots) {
  const tiles = slots.map((slot) => slot.firstElementChild);

  for (const tile of tiles) {
    tile.classList.add("wave-bounce");
    await wait(160);
  }

  await wait(450);

  tiles.forEach((tile) => {
    tile.classList.remove("wave-bounce");
    tile.classList.add("group-bounce");
  });

  await wait(700);

  tiles.forEach((tile) => {
    tile.classList.remove("group-bounce");
  });

  showSuccessModal();
}

function showSuccessModal() {
  modalTime.textContent = formatDuration(finalRoundTime || 0);
  modalAnswer.textContent = normalizeAnswerDisplay(currentPuzzle.answer);
  successModal.hidden = false;
  backToPuzzleButton.focus();
}

function checkAnswer() {
  const slots = [...answerSlots.querySelectorAll(".slot")];
  const guessedLetters = slots.map((slot) => slot.textContent.trim());

  if (hasWon) {
    return;
  }

  clearTileStatus();

  if (guessedLetters.some((letter) => !letter)) {
    message.textContent = getPlacementHint();
    return;
  }

  const guess = guessedLetters.join("");

  if (guess === normalizeText(currentPuzzle.answer)) {
    stopTimer();
    recordDailyCompletion(finalRoundTime || 0);
    hasWon = true;
    message.textContent = "Correct! Deliciously unscrambled.";
    slots.forEach((slot) => slot.firstElementChild.classList.add("correct"));
    playVictoryAnimation(slots);
    return;
  }

  message.textContent = "Not quite. Keep rearranging the tiles.";
  slots.forEach((slot) => slot.firstElementChild.classList.add("incorrect"));
}

function clearTileStatus() {
  document.querySelectorAll(".tile").forEach((tile) => {
    tile.classList.remove("correct", "incorrect");
  });
}

function clearBoard() {
  answerSlots.replaceChildren();
  letterTiles.replaceChildren();
  letterTiles.classList.remove("drag-over");
  successModal.hidden = true;
  hasWon = false;
}

function renderPuzzle() {
  clearBoard();

  const answer = normalizeAnswerDisplay(currentPuzzle.answer);
  const scrambled = normalizeText(currentPuzzle.scrambled);
  let slotIndex = 0;

  puzzleDate.textContent = getDateLabelForKey(currentPuzzleDateKey);
  emojiDisplay.textContent = currentPuzzle.emoji;
  emojiDisplay.setAttribute("aria-label", `${currentPuzzle.emoji} emoji clue`);
  modalAnswer.textContent = answer;

  answer.split("").forEach((character) => {
    if (character === " ") {
      answerSlots.appendChild(createSpaceSlot());
      return;
    }

    answerSlots.appendChild(createSlot(slotIndex));
    slotIndex += 1;
  });

  scrambled.split("").forEach((letter, index) => {
    letterTiles.appendChild(createTile(letter, index));
  });

  message.textContent = getPlacementHint();
  if (!roundStarted) {
    updateTimerDisplay(0);
    modalTime.textContent = "00:00";
  }
}

function setupLetterBankDropZone() {
  letterTiles.addEventListener("dragover", (event) => {
    event.preventDefault();
    letterTiles.classList.add("drag-over");
  });

  letterTiles.addEventListener("dragleave", (event) => {
    if (!letterTiles.contains(event.relatedTarget)) {
      letterTiles.classList.remove("drag-over");
    }
  });

  letterTiles.addEventListener("drop", (event) => {
    event.preventDefault();
    letterTiles.classList.remove("drag-over");

    if (!draggedTile || hasWon) {
      return;
    }

    letterTiles.appendChild(draggedTile);
    clearTileStatus();
    message.textContent = getPlacementHint();
  });
}

function updateTileDraggability() {
  document.querySelectorAll(".tile").forEach((tile) => {
    tile.draggable = inputMode === "drag";
  });
}

function setupMobilePointerMode() {
  if (!window.PointerEvent) {
    return;
  }

  if (!window.matchMedia("(pointer: coarse)").matches) {
    return;
  }

  document.addEventListener("contextmenu", (event) => {
    if (event.target.closest(".tile")) {
      event.preventDefault();
    }
  });
}

function scheduleMidnightStatsRefresh() {
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  const waitMilliseconds = nextMidnight.getTime() - now.getTime();

  window.setTimeout(() => {
    renderStatsList();
    scheduleMidnightStatsRefresh();
  }, waitMilliseconds);
}

updateTimerDisplay(0);
modalTime.textContent = "00:00";

function validatePuzzle(puzzle) {
  const emoji = puzzle.emoji.trim();
  const answer = normalizeText(puzzle.answer);
  const scrambled = normalizeText(puzzle.scrambled);

  if (!emoji || !answer || !scrambled) {
    return "Please fill out the emoji, scrambled letters, and correct answer.";
  }

  if (answer.length !== scrambled.length) {
    return "The scrambled letters must contain the same number of letters as the answer.";
  }

  if (sortLetters(answer) !== sortLetters(scrambled)) {
    return "The scrambled letters must use the exact same letters as the answer.";
  }

  return "";
}

function populateDeveloperForm() {
  setDefaultScheduledTime();
  developerDaily.checked = true;
  developerEmoji.value = "";
  developerScrambled.value = "";
  developerAnswer.value = "";
}

function clearQueueTimers() {
  if (queueRefreshTimer) {
    clearTimeout(queueRefreshTimer);
    queueRefreshTimer = null;
  }

  if (queuePollTimer) {
    clearInterval(queuePollTimer);
    queuePollTimer = null;
  }
}

function renderQueueList(queueItems, currentItemId) {
  queueList.replaceChildren();
  queueSidebar.hidden = currentView !== "game" || !isDeveloperMode();

  if (!queueItems.length) {
    queueStatus.textContent = "No queued puzzles yet.";
    return;
  }

  const nextItem = queueItems.find((item) => new Date(item.scheduled_at) > new Date()) || null;
  queueStatus.textContent = nextItem
    ? `Next puzzle at ${formatQueueDateTime(nextItem.scheduled_at)}.`
    : "All queued puzzles are currently live.";

  queueItems.forEach((item) => {
    const queueItem = document.createElement("article");
    queueItem.className = "queue-item";
    if (item.id === currentItemId) {
      queueItem.classList.add("is-current");
    }

    const topRow = document.createElement("div");
    topRow.className = "queue-item-top";

    const emoji = document.createElement("div");
    emoji.className = "queue-item-emoji";
    emoji.textContent = item.emoji;

    const metaRow = document.createElement("div");
    metaRow.className = "queue-item-meta-row";

    if (item.is_daily) {
      const dailyBadge = document.createElement("span");
      dailyBadge.className = "queue-item-badge";
      dailyBadge.textContent = "Daily";
      metaRow.appendChild(dailyBadge);
    }

    const scheduledTime = document.createElement("div");
    scheduledTime.className = "queue-item-time";
    scheduledTime.textContent = formatQueueDateTime(item.scheduled_at);
    metaRow.appendChild(scheduledTime);

    const answer = document.createElement("p");
    answer.className = "queue-item-answer";
    answer.textContent = item.answer;

    const actions = document.createElement("div");
    actions.className = "queue-item-actions";

    const deleteButton = document.createElement("button");
    deleteButton.className = "queue-delete-button";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => openDeleteModal(item.id));

    actions.append(deleteButton);
    topRow.append(emoji, actions);
    queueItem.append(topRow, metaRow, answer);
    queueList.appendChild(queueItem);
  });
}

function removeQueueItemFromLocalState(queueItemId) {
  currentQueueItems = currentQueueItems.filter((item) => item.id !== queueItemId);
  const activeItem = getActiveQueueItem(currentQueueItems);
  renderQueueList(currentQueueItems, activeItem?.id || null);
}

function getActiveQueueItem(queueItems) {
  const now = new Date();
  const activeItems = queueItems.filter((item) => new Date(item.scheduled_at) <= now);

  if (!activeItems.length) {
    return null;
  }

  return activeItems.reduce((latestItem, currentItem) => {
    return new Date(currentItem.scheduled_at) > new Date(latestItem.scheduled_at)
      ? currentItem
      : latestItem;
  });
}

function scheduleQueueRefresh(queueItems) {
  clearQueueTimers();
}

async function refreshPuzzleFromSupabase() {
  if (!supabaseClient) {
    message.textContent = "Add your Supabase Project URL in script.js to load the shared puzzle.";
    setCurrentPuzzle({ ...defaultPuzzle }, getTodayDateKey(), false);
    renderPuzzle();
    renderQueueList([], null);
    return;
  }

  const { data, error } = await supabaseClient
    .from("puzzle_queue")
    .select("id, emoji, scrambled, answer, scheduled_at, created_at, is_daily, archive_date_key")
    .order("scheduled_at", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    message.textContent = "Could not load the puzzle queue, so the default puzzle is showing.";
    setCurrentPuzzle({ ...defaultPuzzle }, getTodayDateKey(), false);
    renderPuzzle();
    renderQueueList([], null);
    return;
  }

  currentQueueItems = data || [];
  const activeItem = getActiveQueueItem(currentQueueItems);
  const nextPuzzle = activeItem || { ...defaultPuzzle };
  const nextPuzzleDateKey = activeItem
    ? (activeItem.is_daily && activeItem.archive_date_key
      ? activeItem.archive_date_key
      : toDateKey(new Date(activeItem.scheduled_at)))
    : getTodayDateKey();
  setCurrentPuzzle(nextPuzzle, nextPuzzleDateKey, true);

  renderQueueList(currentQueueItems, activeItem?.id || null);
  await refreshDailyArchiveFromSupabase();
}

async function refreshDailyArchiveFromSupabase() {
  if (!supabaseClient) {
    dailyPuzzleArchive = new Map();
    return;
  }

  const { data, error } = await supabaseClient
    .from("daily_puzzle_archive")
    .select("date_key, emoji, scrambled, answer, created_at, updated_at")
    .order("date_key", { ascending: false });

  if (error) {
    return;
  }

  dailyPuzzleArchive = new Map((data || []).map((item) => [item.date_key, item]));
}

async function openArchivedPuzzle(dateKey) {
  let archivedPuzzle = dailyPuzzleArchive.get(dateKey) || null;

  if (!archivedPuzzle && supabaseClient) {
    const { data, error } = await supabaseClient
      .from("daily_puzzle_archive")
      .select("date_key, emoji, scrambled, answer")
      .eq("date_key", dateKey)
      .maybeSingle();

    if (!error) {
      archivedPuzzle = data || null;
      if (archivedPuzzle) {
        dailyPuzzleArchive.set(dateKey, archivedPuzzle);
      }
    }
  }

  if (!archivedPuzzle) {
    message.textContent = "No archived puzzle exists for that day yet.";
    showGameView();
    return;
  }

  const stats = loadLocalStats();
  const dayStat = getDailyStat(stats, dateKey);

  currentPuzzle = { ...archivedPuzzle };
  currentPuzzleDateKey = dateKey;

  stopTimer();
  roundStarted = false;
  hasWon = false;
  roundStartTimestamp = null;
  finalRoundTime = null;

  if (dayStat.completed) {
    roundStarted = true;
    renderPuzzle();
    finalRoundTime = dayStat.durationMs || 0;
    updateTimerDisplay(finalRoundTime);
    fillCompletedPuzzleDisplay();
  } else if (dayStat.started) {
    const elapsedMilliseconds = dayStat.durationMs || Math.max(0, Date.now() - (dayStat.startedAt || Date.now()));
    renderPuzzle();
    startTimer(elapsedMilliseconds);
    message.textContent = `Resuming the puzzle from ${getDateLabelFromKey(dateKey)}.`;
  } else {
    roundStarted = false;
    hasWon = false;
    renderPuzzle();
    message.textContent = `Start the puzzle from ${getDateLabelFromKey(dateKey)}.`;
  }

  showGameView();
}
function openDeleteModal(queueItemId) {
  deleteTargetQueueItemId = queueItemId;
  deleteModal.hidden = false;
}

function closeDeleteModal() {
  deleteTargetQueueItemId = null;
  deleteModal.hidden = true;
}

async function deleteQueueItem(queueItemId) {
  if (!supabaseClient) {
    throw new Error("Add your Supabase Project URL in script.js first.");
  }

  const { error } = await supabaseClient.rpc("delete_queue_item", {
    p_dev_key: developerKey.value.trim(),
    p_item_id: queueItemId,
  });

  if (error) {
    throw error;
  }
}

async function savePuzzleToSupabase(nextPuzzle) {
  if (!supabaseClient) {
    throw new Error("Add your Supabase Project URL in script.js first.");
  }

  if (!developerKey.value.trim()) {
    throw new Error("Developer key is missing.");
  }

  const { error } = await supabaseClient.rpc("queue_puzzle", {
    p_dev_key: developerKey.value.trim(),
    p_emoji: nextPuzzle.emoji,
    p_scrambled: nextPuzzle.scrambled,
    p_answer: nextPuzzle.answer,
    p_scheduled_at: nextPuzzle.scheduledAt,
    p_is_daily: nextPuzzle.isDaily,
    p_archive_date_key: nextPuzzle.archiveDateKey,
  });

  if (error) {
    throw error;
  }
}

async function setupDeveloperMode() {
  if (!isDeveloperMode()) {
    return;
  }

  developerPanel.hidden = false;
  developerKey.value = window.localStorage.getItem(developerKeyStorage) || "";
  if (!developerKey.value.trim()) {
    developerMessage.textContent = "Enter your developer key to save changes.";
  }
  populateDeveloperForm();

  developerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!developerKey.value.trim()) {
      developerMessage.textContent = "Enter your developer key first.";
      return;
    }

    const scheduledAt = parseDateTimeInputValue(developerScheduled.value);

    if (!scheduledAt) {
      developerMessage.textContent = "Enter a valid scheduled time.";
      return;
    }

    if (scheduledAt.getTime() < Date.now() + 30 * 1000) {
      developerMessage.textContent = "Scheduled time must be at least 30 seconds in the future.";
      return;
    }

    const nextPuzzle = {
      emoji: developerEmoji.value.trim(),
      scrambled: developerScrambled.value.trim(),
      answer: normalizeAnswerDisplay(developerAnswer.value),
      scheduledAt: scheduledAt.toISOString(),
      isDaily: developerDaily.checked,
      archiveDateKey: developerDaily.checked ? toDateKey(scheduledAt) : null,
    };

    const error = validatePuzzle(nextPuzzle);

    if (error) {
      developerMessage.textContent = error;
      return;
    }

    developerMessage.textContent = "Saving...";

    try {
      await savePuzzleToSupabase(nextPuzzle);
    } catch (saveError) {
      developerMessage.textContent = saveError.message;
      return;
    }

    window.localStorage.setItem(developerKeyStorage, developerKey.value.trim());
    developerMessage.textContent = "Queued. It will go live at the scheduled time.";
    populateDeveloperForm();
    await refreshPuzzleFromSupabase();
  });
}

backToPuzzleButton.addEventListener("click", () => {
  successModal.hidden = true;
});

statsModalButton.addEventListener("click", () => {
  successModal.hidden = true;
  showStatsView();
});

shareResultsButton.addEventListener("click", async () => {
  const shareText = buildShareText(getDateLabelForKey(currentPuzzleDateKey), currentPuzzle.emoji, finalRoundTime || 0);

  try {
    await navigator.clipboard.writeText(shareText);
    shareResultsButton.textContent = "Copied!";
    window.setTimeout(() => {
      shareResultsButton.textContent = "Share results";
    }, 1500);
  } catch {
    shareResultsButton.textContent = "Copy failed";
    window.setTimeout(() => {
      shareResultsButton.textContent = "Share results";
    }, 1500);
  }
});

startButton.addEventListener("click", () => {
  startRound();
});

statsButton.addEventListener("click", () => {
  showStatsView();
});

backButton.addEventListener("click", () => {
  showGameView();
});

cancelDeleteButton.addEventListener("click", closeDeleteModal);

confirmDeleteButton.addEventListener("click", async () => {
  if (!deleteTargetQueueItemId) {
    closeDeleteModal();
    return;
  }

  try {
    await deleteQueueItem(deleteTargetQueueItemId);
    removeQueueItemFromLocalState(deleteTargetQueueItemId);
    developerMessage.textContent = "Queue item deleted.";
  } catch (error) {
    developerMessage.textContent = error.message;
  } finally {
    closeDeleteModal();
  }
});

modeDragButton.addEventListener("click", () => setInputMode("drag"));
modeClickButton.addEventListener("click", () => setInputMode("click"));

setupLetterBankDropZone();
setupMobilePointerMode();
setupDeveloperMode();
setInputMode(inputMode);
updateViewVisibility();
scheduleMidnightStatsRefresh();
refreshPuzzleFromSupabase();
