const supabaseUrl = "https://eewwhibfdxmcyuradnjf.supabase.co";
const supabaseUrlPlaceholder = "YOUR_SUPABASE_PROJECT_URL_HERE";
const supabasePublishableKey = "sb_publishable_sNCwxOQHkicGjnX_-Pfusg_2eJ5wXXU";
const supabaseClient = createSupabaseClient();

const emojiDisplay = document.querySelector("#emoji-display");
const answerSlots = document.querySelector("#answer-slots");
const letterTiles = document.querySelector("#letter-tiles");
const message = document.querySelector("#message");
const successModal = document.querySelector("#success-modal");
const modalAnswer = document.querySelector("#modal-answer");
const closeModalButton = document.querySelector("#close-modal");
const developerPanel = document.querySelector("#developer-panel");
const developerForm = document.querySelector("#developer-form");
const developerKey = document.querySelector("#developer-key");
const developerEmoji = document.querySelector("#developer-emoji");
const developerScrambled = document.querySelector("#developer-scrambled");
const developerAnswer = document.querySelector("#developer-answer");
const developerMessage = document.querySelector("#developer-message");

const defaultPuzzle = {
  emoji: "\u{1F355}",
  answer: "PIZZA",
  scrambled: "ZAPIZ",
};

let currentPuzzle = { ...defaultPuzzle };
let draggedTile = null;
let hasWon = false;
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

function sortLetters(value) {
  return normalizeText(value).split("").sort().join("");
}

function isDeveloperMode() {
  const query = new URLSearchParams(window.location.search);
  return query.has("dev") || query.has("developer") || query.get("mode") === "developer";
}

function createTile(letter, index) {
  const tile = document.createElement("button");
  tile.className = "tile";
  tile.type = "button";
  tile.textContent = letter;
  tile.draggable = true;
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
  successModal.hidden = false;
  closeModalButton.focus();
}

function checkAnswer() {
  const slots = [...answerSlots.querySelectorAll(".slot")];
  const guessedLetters = slots.map((slot) => slot.textContent.trim());

  if (hasWon) {
    return;
  }

  clearTileStatus();

  if (guessedLetters.some((letter) => !letter)) {
    message.textContent = "Drag each letter into a slot to solve it.";
    return;
  }

  const guess = guessedLetters.join("");

  if (guess === normalizeText(currentPuzzle.answer)) {
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

  message.textContent = "Drag each letter into a slot to solve it.";
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
    message.textContent = "Drag each letter into a slot to solve it.";
  });
}

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
  developerEmoji.value = currentPuzzle.emoji;
  developerScrambled.value = currentPuzzle.scrambled;
  developerAnswer.value = currentPuzzle.answer;
}

async function loadPuzzleFromSupabase() {
  if (!supabaseClient) {
    message.textContent = "Add your Supabase Project URL in script.js to load the shared puzzle.";
    renderPuzzle();
    return;
  }

  const { data, error } = await supabaseClient
    .from("puzzles")
    .select("emoji, scrambled, answer")
    .eq("id", "current")
    .single();

  if (error) {
    message.textContent = "Could not load the shared puzzle, so the default puzzle is showing.";
    renderPuzzle();
    return;
  }

  currentPuzzle = data;
  renderPuzzle();
  populateDeveloperForm();
}

async function savePuzzleToSupabase(nextPuzzle) {
  if (!supabaseClient) {
    throw new Error("Add your Supabase Project URL in script.js first.");
  }

  if (!developerKey.value.trim()) {
    throw new Error("Developer key is missing.");
  }

  const { error } = await supabaseClient.rpc("save_current_puzzle", {
    p_dev_key: developerKey.value.trim(),
    p_emoji: nextPuzzle.emoji,
    p_scrambled: nextPuzzle.scrambled,
    p_answer: nextPuzzle.answer,
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

    const nextPuzzle = {
      emoji: developerEmoji.value.trim(),
      scrambled: developerScrambled.value.trim(),
      answer: normalizeAnswerDisplay(developerAnswer.value),
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

    currentPuzzle = nextPuzzle;
    window.localStorage.setItem(developerKeyStorage, developerKey.value.trim());
    renderPuzzle();
    populateDeveloperForm();
    developerMessage.textContent = "Saved. Everyone will now see this puzzle.";
  });
}

closeModalButton.addEventListener("click", () => {
  successModal.hidden = true;
});

setupLetterBankDropZone();
setupDeveloperMode();
loadPuzzleFromSupabase();
