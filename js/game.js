/**
 * Main Game Controller
 * Orchestrates all modules and manages game lifecycle
 */

import { StateManager } from './stateManager.js';
import { createDeck, shuffleDeck } from './card.js';
import { TableauPile, FoundationPile, StockPile, WastePile } from './piles.js';
import { GameLogic } from './gameLogic.js';
import { AnimationController } from './animations.js';
import { DragDropController } from './dragDrop.js';

class Game {
  constructor() {
    // Initialize state manager
    this.stateManager = new StateManager();

    // Initialize modules
    this.animations = new AnimationController(this.stateManager);
    this.gameLogic = new GameLogic(this.stateManager);
    this.dragDrop = new DragDropController(this.stateManager, this.gameLogic, this.animations);

    // Timer
    this.timerInterval = null;

    // Double-click tracking
    this.lastClickTime = 0;
    this.lastClickTarget = null;
  }

  /**
   * Initialize the game
   */
  async init() {
    try {
      console.log('Initializing Zen Solitaire...');

      // Create piles
      this.createPiles();

      // Setup UI event listeners
      this.setupUIListeners();

      // Initialize drag-drop controller
      this.dragDrop.initialize();

      // Start new game
      await this.newGame();

      console.log('Game initialized successfully');
    } catch (error) {
      console.error('Error initializing game:', error);
      this.handleError(error);
    }
  }

  /**
   * Create all pile objects
   */
  createPiles() {
    const gameState = this.stateManager.getState();

    // Create tableau piles
    gameState.piles.tableau = [];
    for (let i = 0; i < 7; i++) {
      const pile = new TableauPile(`tableau-${i}`, i);
      const element = document.getElementById(`tableau-${i}`);
      pile.render(element);
      gameState.piles.tableau.push(pile);
    }

    // Create foundation piles
    gameState.piles.foundation = [];
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    for (let i = 0; i < 4; i++) {
      const pile = new FoundationPile(`foundation-${i}`, suits[i], i);
      const element = document.getElementById(`foundation-${i}`);
      pile.render(element);
      gameState.piles.foundation.push(pile);
    }

    // Create stock pile
    const stockPile = new StockPile('stock-pile');
    const stockElement = document.getElementById('stock-pile');
    stockPile.render(stockElement);
    gameState.piles.stock = stockPile;

    // Create waste pile
    const drawCount = gameState.settings.drawCount;
    const wastePile = new WastePile('waste-pile', drawCount);
    const wasteElement = document.getElementById('waste-pile');
    wastePile.render(wasteElement);
    gameState.piles.waste = wastePile;
  }

  /**
   * Start a new game
   */
  async newGame() {
    try {
      // Stop timer
      this.stopTimer();

      // Cancel any ongoing animations
      this.animations.cancelAllAnimations();

      // Reset state
      this.stateManager.resetState();

      // Recreate piles with fresh state
      const gameState = this.stateManager.getState();

      // Clear all piles
      [...gameState.piles.tableau, ...gameState.piles.foundation].forEach(pile => pile.clear());
      gameState.piles.stock.clear();
      gameState.piles.waste.clear();

      // Create and shuffle deck
      const deck = createDeck();
      const shuffled = shuffleDeck(deck);

      // Deal to tableau
      let cardIndex = 0;
      for (let i = 0; i < 7; i++) {
        const tableauPile = gameState.piles.tableau[i];

        for (let j = 0; j <= i; j++) {
          const card = shuffled[cardIndex++];

          // Last card in pile is face-up
          if (j === i) {
            card.isFaceUp = true;
          }

          tableauPile.addCard(card);
        }

        tableauPile.updateDisplay();
      }

      // Remaining cards go to stock
      while (cardIndex < shuffled.length) {
        gameState.piles.stock.addCard(shuffled[cardIndex++]);
      }
      gameState.piles.stock.updateDisplay();

      // Update game state
      this.stateManager.updateState('gamePhase', 'playing');
      this.stateManager.updateState('startTime', Date.now());
      this.stateManager.updateState('moveCount', 0);

      // Update UI
      this.updateMoveCounter();
      this.updateTimer();

      // Start timer
      this.startTimer();

      console.log('New game started');
    } catch (error) {
      console.error('Error starting new game:', error);
      this.handleError(error);
    }
  }

  /**
   * Setup UI event listeners
   */
  setupUIListeners() {
    // New game button
    const newGameBtn = document.getElementById('new-game-btn');
    newGameBtn.addEventListener('click', () => this.confirmNewGame());

    // Undo button
    const undoBtn = document.getElementById('undo-btn');
    undoBtn.addEventListener('click', () => this.undo());

    // Settings button
    const settingsBtn = document.getElementById('settings-btn');
    settingsBtn.addEventListener('click', () => this.openSettings());

    // Settings modal
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    closeSettingsBtn.addEventListener('click', () => this.closeSettings());

    // Draw count setting
    const draw1Radio = document.getElementById('draw-1');
    const draw3Radio = document.getElementById('draw-3');

    draw1Radio.addEventListener('change', () => {
      if (draw1Radio.checked) {
        this.changeDrawCount(1);
      }
    });

    draw3Radio.addEventListener('change', () => {
      if (draw3Radio.checked) {
        this.changeDrawCount(3);
      }
    });

    // Win modal
    const newGameModalBtn = document.getElementById('new-game-modal-btn');
    newGameModalBtn.addEventListener('click', () => {
      this.closeWinModal();
      this.newGame();
    });

    // Listen for state changes
    this.stateManager.subscribe('stateChanged', (data) => {
      this.onStateChanged(data);
    });
  }

  /**
   * Confirm new game if game in progress
   */
  confirmNewGame() {
    const gameState = this.stateManager.getState();

    if (gameState.moveCount > 0 && gameState.gamePhase !== 'won') {
      const confirmed = confirm('Start a new game? Current progress will be lost.');
      if (!confirmed) return;
    }

    this.newGame();
  }

  /**
   * Undo last move
   */
  undo() {
    const gameState = this.stateManager.getState();

    if (gameState.moveHistory.length === 0) {
      console.log('No moves to undo');
      return;
    }

    const lastMove = gameState.moveHistory.pop();
    this.gameLogic.rollbackMove(lastMove);

    // Update displays
    lastMove.sourcePile.updateDisplay();
    lastMove.targetPile.updateDisplay();

    // Decrement move count
    this.stateManager.updateState('moveCount', Math.max(0, gameState.moveCount - 1));
    this.updateMoveCounter();

    console.log('Move undone');
  }

  /**
   * Open settings modal
   */
  openSettings() {
    const modal = document.getElementById('settings-modal');
    modal.classList.remove('hidden');
  }

  /**
   * Close settings modal
   */
  closeSettings() {
    const modal = document.getElementById('settings-modal');
    modal.classList.add('hidden');
  }

  /**
   * Change draw count
   */
  changeDrawCount(count) {
    const gameState = this.stateManager.getState();
    this.stateManager.updateState('settings.drawCount', count);

    // Update waste pile display count
    gameState.piles.waste.setDisplayCount(count);

    console.log(`Draw count changed to ${count}`);
  }

  /**
   * Handle state changes
   */
  onStateChanged(data) {
    const gameState = this.stateManager.getState();

    // Check win condition
    if (gameState.gamePhase === 'playing') {
      const hasWon = this.gameLogic.checkWinCondition(gameState);

      if (hasWon) {
        this.handleWin();
      }
    }

    // Update undo button
    const undoBtn = document.getElementById('undo-btn');
    undoBtn.disabled = gameState.moveHistory.length === 0;
  }

  /**
   * Handle win condition
   */
  async handleWin() {
    console.log('You won!');

    this.stopTimer();

    // Play win animation
    await this.animations.animateWin();

    // Show win modal
    const gameState = this.stateManager.getState();
    const modal = document.getElementById('win-modal');
    const finalMoves = document.getElementById('final-moves');
    const finalTime = document.getElementById('final-time');

    finalMoves.textContent = gameState.moveCount;

    const elapsedSeconds = Math.floor((Date.now() - gameState.startTime) / 1000);
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    finalTime.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    modal.classList.remove('hidden');
  }

  /**
   * Close win modal
   */
  closeWinModal() {
    const modal = document.getElementById('win-modal');
    modal.classList.add('hidden');
  }

  /**
   * Start timer
   */
  startTimer() {
    this.stopTimer();

    this.timerInterval = setInterval(() => {
      this.updateTimer();
    }, 1000);
  }

  /**
   * Stop timer
   */
  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /**
   * Update timer display
   */
  updateTimer() {
    const gameState = this.stateManager.getState();

    if (!gameState.startTime) {
      document.getElementById('timer').textContent = '0:00';
      return;
    }

    const elapsedSeconds = Math.floor((Date.now() - gameState.startTime) / 1000);
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;

    document.getElementById('timer').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Update move counter
   */
  updateMoveCounter() {
    const gameState = this.stateManager.getState();
    document.getElementById('move-count').textContent = gameState.moveCount;
  }

  /**
   * Handle errors
   */
  handleError(error) {
    console.error('Game error:', error);

    // Show error to user
    const announcement = document.getElementById('game-announcements');
    if (announcement) {
      announcement.textContent = 'An error occurred. Please try starting a new game.';
    }

    // Try to recover
    setTimeout(() => {
      if (announcement) {
        announcement.textContent = '';
      }
    }, 5000);
  }
}

// Initialize game when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    game.init();
  });
} else {
  const game = new Game();
  game.init();
}
