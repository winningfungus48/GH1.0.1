// Wordle Game Script
const WORD_LIST_URL = 'https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt';
const WORD_LIST_KEY = 'wordle-5-letter-words-v1';
const GAME_STATE_KEY = 'wordle-game-state-v1';

let wordList = [];
let secretWord = '';
let board = null;
let message = null;
let wordPad = null;
let deleteBtn = null;
let enterBtn = null;
let playagainBtn = null;
let backHomeBtn = null;
let endgameOverlay = null;
let endgameTitle = null;
let endgameMessage = null;
let welcomeOverlay = null;
let welcomePlay = null;
let welcomeClose = null;

const ROWS = 6;
const COLS = 5;
let gameState = null;
let messageTimeout = null;

async function getWordList() {
  let cached = localStorage.getItem(WORD_LIST_KEY);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {}
  }
  const response = await fetch(WORD_LIST_URL);
  const text = await response.text();
  const words = text
    .split('\n')
    .map(w => w.trim().toLowerCase())
    .filter(w => w.length === 5 && /^[a-z]+$/.test(w));
  localStorage.setItem(WORD_LIST_KEY, JSON.stringify(words));
  return words;
}

function pickSecretWord() {
  return wordList[Math.floor(Math.random() * wordList.length)];
}

function saveGameState() {
  localStorage.setItem(GAME_STATE_KEY, JSON.stringify(gameState));
}

function loadGameState() {
  const saved = localStorage.getItem(GAME_STATE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {}
  }
  return null;
}

function resetGameState() {
  gameState = {
    guesses: Array(ROWS).fill('').map(() => ''),
    feedback: Array(ROWS).fill(null),
    currentRow: 0,
    currentCol: 0,
    gameOver: false,
    gameWon: false
  };
  saveGameState();
}

function showMessage(text) {
  message.textContent = text;
  if (text === 'Not in word list') {
    if (messageTimeout) clearTimeout(messageTimeout);
    messageTimeout = setTimeout(() => {
      clearMessage();
      messageTimeout = null;
    }, 5000);
  }
}

function clearMessage() {
  message.textContent = '';
  if (messageTimeout) {
    clearTimeout(messageTimeout);
    messageTimeout = null;
  }
}

function createBoard() {
  board.innerHTML = '';
  for (let row = 0; row < ROWS; row++) {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'row';
    rowDiv.dataset.row = row;
    for (let col = 0; col < COLS; col++) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.dataset.row = row;
      tile.dataset.col = col;
      rowDiv.appendChild(tile);
    }
    board.appendChild(rowDiv);
  }
}

function createWordPad() {
  wordPad.innerHTML = '';
  // Standard QWERTY layout
  const rows = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'DEL']
  ];
  rows.forEach((row, i) => {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'word-row';
    row.forEach(ch => {
      if (ch === 'ENTER') {
        const btn = document.createElement('button');
        btn.className = 'enter-btn';
        btn.textContent = 'ENTER';
        btn.id = 'enter-btn';
        btn.addEventListener('click', submitGuess);
        rowDiv.appendChild(btn);
      } else if (ch === 'DEL') {
        const btn = document.createElement('button');
        btn.className = 'delete-btn';
        btn.textContent = 'DEL';
        btn.id = 'delete-btn';
        btn.addEventListener('click', deleteLetter);
        rowDiv.appendChild(btn);
      } else {
        const btn = document.createElement('button');
        btn.className = 'letter-btn';
        btn.textContent = ch;
        btn.dataset.letter = ch;
        btn.addEventListener('click', () => inputLetter(ch));
        rowDiv.appendChild(btn);
      }
    });
    wordPad.appendChild(rowDiv);
  });
}

function updateEnterButton() {
  enterBtn.disabled = gameState.guesses[gameState.currentRow].length !== COLS;
}

function inputLetter(letter) {
  if (gameState.gameOver || gameState.guesses[gameState.currentRow].length >= COLS) return;
  const row = gameState.currentRow;
  gameState.guesses[row] += letter.toLowerCase();
  updateBoard();
  updateEnterButton();
  saveGameState();
}

function deleteLetter() {
  if (gameState.gameOver || gameState.guesses[gameState.currentRow].length === 0) return;
  const row = gameState.currentRow;
  gameState.guesses[row] = gameState.guesses[row].slice(0, -1);
  updateBoard();
  updateEnterButton();
  saveGameState();
}

function submitGuess() {
  if (gameState.gameOver) return;
  const guess = gameState.guesses[gameState.currentRow];
  if (guess.length !== COLS) {
    showMessage('Not enough letters');
    shakeRow(gameState.currentRow);
    return;
  }
  if (!wordList.includes(guess)) {
    showMessage('Not in word list');
    shakeRow(gameState.currentRow);
    return;
  }
  const feedback = getFeedback(guess, secretWord);
  gameState.feedback[gameState.currentRow] = feedback;
  updateBoard();
  if (guess === secretWord) {
    gameState.gameOver = true;
    gameState.gameWon = true;
    showEndgameModal(true);
  } else if (gameState.currentRow === ROWS - 1) {
    gameState.gameOver = true;
    gameState.gameWon = false;
    showEndgameModal(false);
  } else {
    gameState.currentRow++;
    updateEnterButton();
    clearMessage();
  }
  saveGameState();
}

function getFeedback(guess, answer) {
  const feedback = Array(COLS).fill('absent');
  const answerArr = answer.split('');
  const guessArr = guess.split('');
  const used = Array(COLS).fill(false);
  // First pass: correct
  for (let i = 0; i < COLS; i++) {
    if (guessArr[i] === answerArr[i]) {
      feedback[i] = 'correct';
      used[i] = true;
      answerArr[i] = null;
    }
  }
  // Second pass: present
  for (let i = 0; i < COLS; i++) {
    if (feedback[i] === 'correct') continue;
    const idx = answerArr.indexOf(guessArr[i]);
    if (idx !== -1 && answerArr[idx] !== null) {
      feedback[i] = 'present';
      answerArr[idx] = null;
    }
  }
  return feedback;
}

function updateBoard() {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const tile = document.querySelector(`.tile[data-row="${row}"][data-col="${col}"]`);
      tile.textContent = gameState.guesses[row][col] ? gameState.guesses[row][col].toUpperCase() : '';
      tile.classList.remove('correct', 'present', 'absent', 'filled');
      if (gameState.guesses[row][col]) tile.classList.add('filled');
      if (gameState.feedback[row]) tile.classList.add(gameState.feedback[row][col]);
    }
  }
  updateWordPadColors();
}

function updateWordPadColors() {
  const bestStatus = {};
  for (let row = 0; row <= gameState.currentRow; row++) {
    const guess = gameState.guesses[row];
    const feedback = gameState.feedback[row];
    if (!feedback) continue;
    for (let i = 0; i < COLS; i++) {
      const letter = guess[i];
      if (!letter) continue;
      if (feedback[i] === 'correct') bestStatus[letter] = 'correct';
      else if (feedback[i] === 'present' && bestStatus[letter] !== 'correct') bestStatus[letter] = 'present';
      else if (feedback[i] === 'absent' && !bestStatus[letter]) bestStatus[letter] = 'absent';
    }
  }
  document.querySelectorAll('.letter-btn').forEach(btn => {
    const l = btn.textContent.toLowerCase();
    btn.classList.remove('correct', 'present', 'absent');
    if (bestStatus[l] === 'correct') btn.classList.add('correct');
    else if (bestStatus[l] === 'present') btn.classList.add('present');
    else if (bestStatus[l] === 'absent') btn.classList.add('absent');
  });
}

function shakeRow(rowIdx) {
  const row = document.querySelector(`.row[data-row="${rowIdx}"]`);
  row.classList.remove('shake');
  void row.offsetWidth;
  row.classList.add('shake');
  setTimeout(() => row.classList.remove('shake'), 400);
}

function showEndgameModal(won) {
  endgameOverlay.classList.add('show');
  endgameOverlay.classList.remove('hide');
  endgameOverlay.style.display = 'flex';
  endgameTitle.textContent = 'Game Over';
  if (won) {
    endgameMessage.textContent = 'Great Job!';
  } else {
    endgameMessage.innerHTML = 'The Word was:<br><span class="endgame-number">' + secretWord.toUpperCase() + '</span>';
  }
}

function hideEndgameModal() {
  endgameOverlay.classList.add('hide');
  setTimeout(() => {
    endgameOverlay.classList.remove('show');
    endgameOverlay.classList.remove('hide');
    endgameOverlay.style.display = 'none';
  }, 300);
}

function attachPadButtonListeners() {
  deleteBtn = document.getElementById('delete-btn');
  enterBtn = document.getElementById('enter-btn');
  if (deleteBtn) {
    deleteBtn.removeEventListener('click', deleteLetter);
    deleteBtn.addEventListener('click', deleteLetter);
  }
  if (enterBtn) {
    enterBtn.removeEventListener('click', submitGuess);
    enterBtn.addEventListener('click', submitGuess);
  }
}

function startNewGame() {
  secretWord = pickSecretWord();
  resetGameState();
  createBoard();
  createWordPad();
  attachPadButtonListeners();
  updateBoard();
  updateEnterButton();
  clearMessage();
  hideEndgameModal();
}

function setupEventListeners() {
  document.addEventListener('keydown', handleKeydown);
  deleteBtn.addEventListener('click', deleteLetter);
  enterBtn.addEventListener('click', submitGuess);
  playagainBtn.addEventListener('click', () => {
    hideEndgameModal();
    setTimeout(() => startNewGame(), 350);
  });
  backHomeBtn.addEventListener('click', () => {
    window.location.href = '../../index.html';
  });
}

function handleKeydown(e) {
  if (welcomeOverlay && welcomeOverlay.style.display !== 'none' && !welcomeOverlay.classList.contains('hide')) {
    if (e.key === 'Enter') hideWelcomeModal();
    return;
  }
  if (gameState.gameOver) return;
  if (/^[a-zA-Z]$/.test(e.key)) inputLetter(e.key.toUpperCase());
  else if (e.key === 'Backspace') deleteLetter();
  else if (e.key === 'Enter') submitGuess();
}

function showWelcomeModal() {
  welcomeOverlay.classList.remove('hide');
  welcomeOverlay.style.display = '';
  document.body.style.overflow = 'hidden';
}

function hideWelcomeModal() {
  welcomeOverlay.classList.add('hide');
  setTimeout(() => {
    welcomeOverlay.style.display = 'none';
    document.body.style.overflow = '';
  }, 300);
}

window.addEventListener('DOMContentLoaded', async () => {
  board = document.getElementById('board');
  message = document.getElementById('message');
  wordPad = document.getElementById('word-pad');
  playagainBtn = document.getElementById('playagain-btn');
  backHomeBtn = document.getElementById('backhome-btn');
  endgameOverlay = document.getElementById('endgame-overlay');
  endgameTitle = document.getElementById('endgame-title');
  endgameMessage = document.getElementById('endgame-message');
  welcomeOverlay = document.getElementById('welcome-overlay');
  welcomePlay = document.getElementById('welcome-play');
  welcomeClose = document.getElementById('welcome-close');

  wordList = await getWordList();
  startNewGame();
  setupEventListeners();
  attachPadButtonListeners();
  welcomePlay.addEventListener('click', hideWelcomeModal);
  welcomeClose.addEventListener('click', hideWelcomeModal);
  showWelcomeModal();
  endgameOverlay.style.display = 'none'; // Hide endgame modal initially
  window.addEventListener('keydown', (e) => {
    if (welcomeOverlay && welcomeOverlay.style.display !== 'none' && !welcomeOverlay.classList.contains('hide')) {
      if (e.key === 'Enter') hideWelcomeModal();
    }
  });
}); 