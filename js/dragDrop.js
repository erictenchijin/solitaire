/**
 * Drag and Drop Controller - Desktop and mobile support
 */

import { ERROR_CODES } from './gameLogic.js';

export class DragDropController {
  constructor(stateManager, gameLogic, animationController) {
    this.state = stateManager;
    this.gameLogic = gameLogic;
    this.animations = animationController;

    this.dragTimeout = null;
    this.dragTimeoutDuration = 30000; // 30 seconds

    this.isTouchDevice = false;
    this.lastValidationTime = 0;
    this.validationThrottle = 16; // ~60fps

    // Touch-specific state
    this.touchStartPos = null;
    this.touchMoveThreshold = 10; // pixels to move before starting drag
  }

  /**
   * Initialize drag and drop handlers
   */
  initialize() {
    // Detect touch capability
    this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // Set up event listeners
    this.setupEventListeners();

    // Listen for escape key to cancel drag
    document.addEventListener('keydown', this.handleEscapeKey.bind(this));
  }

  /**
   * Setup event listeners for both mouse and touch
   */
  setupEventListeners() {
    const gameBoard = document.querySelector('.game-board');

    if (this.isTouchDevice) {
      // Touch events
      gameBoard.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
      gameBoard.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
      gameBoard.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
      gameBoard.addEventListener('touchcancel', this.handleTouchCancel.bind(this));
    }

    // Mouse events (also work on desktop)
    gameBoard.addEventListener('mousedown', this.handleMouseDown.bind(this));
    gameBoard.addEventListener('mousemove', this.handleMouseMove.bind(this));
    gameBoard.addEventListener('mouseup', this.handleMouseUp.bind(this));

    // Stock pile click
    const stockPile = document.getElementById('stock-pile');
    stockPile.addEventListener('click', this.handleStockClick.bind(this));
  }

  /**
   * Handle touch start
   */
  handleTouchStart(event) {
    const touch = event.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);

    if (!target || !target.classList.contains('card')) return;

    this.touchStartPos = { x: touch.clientX, y: touch.clientY };
    this.potentialDragTarget = target;
  }

  /**
   * Handle touch move
   */
  handleTouchMove(event) {
    if (!this.touchStartPos) return;

    const touch = event.touches[0];
    const deltaX = touch.clientX - this.touchStartPos.x;
    const deltaY = touch.clientY - this.touchStartPos.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    const gameState = this.state.getState();

    // Start drag if moved beyond threshold
    if (!gameState.dragState.isDragging && distance > this.touchMoveThreshold) {
      event.preventDefault();
      this.startDrag(this.potentialDragTarget, touch.clientX, touch.clientY);
    }

    // Update drag position
    if (gameState.dragState.isDragging) {
      event.preventDefault();
      this.updateDragPosition(touch.clientX, touch.clientY);
    }
  }

  /**
   * Handle touch end
   */
  handleTouchEnd(event) {
    const gameState = this.state.getState();

    if (!gameState.dragState.isDragging) {
      // Check for double-tap (auto-move)
      if (this.potentialDragTarget) {
        this.handleDoubleClick(this.potentialDragTarget);
      }
      this.touchStartPos = null;
      this.potentialDragTarget = null;
      return;
    }

    const touch = event.changedTouches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);

    this.endDrag(target);
    this.touchStartPos = null;
    this.potentialDragTarget = null;
  }

  /**
   * Handle touch cancel
   */
  handleTouchCancel(event) {
    this.cancelDrag();
    this.touchStartPos = null;
    this.potentialDragTarget = null;
  }

  /**
   * Handle mouse down
   */
  handleMouseDown(event) {
    if (this.isTouchDevice) return; // Ignore on touch devices

    const target = event.target;
    if (!target.classList.contains('card')) return;

    this.mouseDownTarget = target;
    this.mouseDownTime = Date.now();
  }

  /**
   * Handle mouse move
   */
  handleMouseMove(event) {
    if (this.isTouchDevice) return;

    const gameState = this.state.getState();

    if (this.mouseDownTarget && !gameState.dragState.isDragging) {
      // Start drag
      this.startDrag(this.mouseDownTarget, event.clientX, event.clientY);
      this.mouseDownTarget = null;
    }

    if (gameState.dragState.isDragging) {
      this.updateDragPosition(event.clientX, event.clientY);
    }
  }

  /**
   * Handle mouse up
   */
  handleMouseUp(event) {
    if (this.isTouchDevice) return;

    const gameState = this.state.getState();

    if (gameState.dragState.isDragging) {
      this.endDrag(event.target);
    } else if (this.mouseDownTarget) {
      // Check for double-click
      const timeSinceDown = Date.now() - this.mouseDownTime;
      if (timeSinceDown < 300) {
        this.handleDoubleClick(this.mouseDownTarget);
      }
    }

    this.mouseDownTarget = null;
  }

  /**
   * Start drag operation
   */
  startDrag(cardElement, clientX, clientY) {
    const gameState = this.state.getState();

    // Don't start drag if animating or already dragging
    if (gameState.gamePhase === 'animating' || gameState.dragState.isDragging) {
      return;
    }

    // Identify source pile and cards
    const pileType = cardElement.dataset.pileType ||
                     cardElement.parentElement.classList.contains('tableau-pile') ? 'tableau' : null;

    if (!pileType) return;

    let sourcePile = null;
    let draggedCards = [];

    if (pileType === 'tableau') {
      const pileIndex = parseInt(cardElement.dataset.pileIndex);
      const cardIndex = parseInt(cardElement.dataset.cardIndex);
      sourcePile = gameState.piles.tableau[pileIndex];

      // Get movable cards from this position
      draggedCards = sourcePile.getMovableCards(cardIndex);
    } else if (pileType === 'waste') {
      sourcePile = gameState.piles.waste;
      const topCard = sourcePile.getTopCard();
      if (topCard) {
        draggedCards = [topCard];
      }
    }

    if (draggedCards.length === 0) return;

    // Pre-calculate valid targets
    const validTargets = this.calculateValidTargets(draggedCards, gameState);

    // Create drag preview elements
    const draggedElements = this.createDragPreview(cardElement, draggedCards, clientX, clientY);

    // Update drag state
    this.state.updateMultiple({
      'dragState.isDragging': true,
      'dragState.sourceType': pileType,
      'dragState.sourceIndex': pileType === 'tableau' ? parseInt(cardElement.dataset.pileIndex) : null,
      'dragState.draggedCards': draggedCards,
      'dragState.draggedElements': draggedElements,
      'dragState.validTargets': validTargets,
      'dragState.sourcePile': sourcePile
    });

    // Set drag timeout
    this.dragTimeout = setTimeout(() => {
      console.warn('Drag timeout - cancelling');
      this.cancelDrag();
    }, this.dragTimeoutDuration);

    // Highlight valid targets
    this.highlightValidTargets(validTargets);
  }

  /**
   * Update drag position
   */
  updateDragPosition(clientX, clientY) {
    const gameState = this.state.getState();
    const draggedElements = gameState.dragState.draggedElements;

    if (!draggedElements || draggedElements.length === 0) return;

    // Throttle validation
    const now = Date.now();
    if (now - this.lastValidationTime < this.validationThrottle) {
      return;
    }
    this.lastValidationTime = now;

    // Update position of dragged elements
    draggedElements.forEach((element, index) => {
      if (element) {
        element.style.left = `${clientX}px`;
        element.style.top = `${clientY + (index * 30)}px`;
      }
    });
  }

  /**
   * End drag operation
   */
  endDrag(targetElement) {
    const gameState = this.state.getState();

    if (!gameState.dragState.isDragging) return;

    // Clear timeout
    if (this.dragTimeout) {
      clearTimeout(this.dragTimeout);
      this.dragTimeout = null;
    }

    // Find target pile
    let targetPile = null;
    let validDrop = false;

    if (targetElement) {
      const pileElement = targetElement.classList.contains('pile') ?
                          targetElement :
                          targetElement.closest('.pile');

      if (pileElement) {
        targetPile = this.findPileFromElement(pileElement, gameState);

        if (targetPile) {
          // Validate move
          const validation = this.gameLogic.validateMove(
            gameState.dragState.draggedCards,
            targetPile
          );

          validDrop = validation.valid;

          if (validDrop) {
            // Execute move
            this.executeMove(
              gameState.dragState.draggedCards,
              gameState.dragState.sourcePile,
              targetPile
            );
          } else {
            console.log('Invalid move:', validation.message);
          }
        }
      }
    }

    // Clean up drag state
    this.cleanupDrag(validDrop);
  }

  /**
   * Execute a validated move
   */
  executeMove(cards, sourcePile, targetPile) {
    // Execute through game logic
    const move = this.gameLogic.executeMove(cards, sourcePile, targetPile);

    // Update displays
    sourcePile.updateDisplay();
    targetPile.updateDisplay();

    // Increment move count
    const gameState = this.state.getState();
    this.state.updateState('moveCount', gameState.moveCount + 1);

    // Add to history
    gameState.moveHistory.push(move);

    // Update UI
    this.updateMoveCounter();
  }

  /**
   * Calculate valid drop targets
   */
  calculateValidTargets(draggedCards, gameState) {
    const validTargets = new Set();

    // Check tableau piles
    gameState.piles.tableau.forEach(pile => {
      if (this.gameLogic.validateDuringDrag(draggedCards, pile)) {
        validTargets.add(pile.id);
      }
    });

    // Check foundation piles (only for single cards)
    if (draggedCards.length === 1) {
      gameState.piles.foundation.forEach(pile => {
        if (this.gameLogic.validateDuringDrag(draggedCards, pile)) {
          validTargets.add(pile.id);
        }
      });
    }

    return validTargets;
  }

  /**
   * Create visual preview of dragged cards
   */
  createDragPreview(sourceElement, cards, clientX, clientY) {
    const elements = [];

    cards.forEach((card, index) => {
      const preview = card.render();
      preview.classList.add('drag-preview');
      preview.style.position = 'fixed';
      preview.style.left = `${clientX}px`;
      preview.style.top = `${clientY + (index * 30)}px`;
      preview.style.zIndex = 1000 + index;
      preview.style.pointerEvents = 'none';

      document.body.appendChild(preview);
      elements.push(preview);
    });

    // Hide original card
    sourceElement.style.opacity = '0.3';

    return elements;
  }

  /**
   * Highlight valid drop targets
   */
  highlightValidTargets(validTargets) {
    document.querySelectorAll('.pile').forEach(pile => {
      const pileId = pile.id;
      if (validTargets.has(pileId)) {
        pile.classList.add('highlight-valid');
      }
    });
  }

  /**
   * Clean up drag operation
   */
  cleanupDrag(validDrop) {
    const gameState = this.state.getState();

    // Remove drag preview elements
    if (gameState.dragState.draggedElements) {
      gameState.dragState.draggedElements.forEach(element => {
        if (element && element.parentElement) {
          element.remove();
        }
      });
    }

    // Remove highlights
    document.querySelectorAll('.pile').forEach(pile => {
      pile.classList.remove('highlight-valid', 'highlight-invalid');
    });

    // Restore original card visibility
    document.querySelectorAll('.card').forEach(card => {
      card.style.opacity = '';
    });

    // Reset drag state
    this.state.updateMultiple({
      'dragState.isDragging': false,
      'dragState.sourceType': null,
      'dragState.sourceIndex': null,
      'dragState.draggedCards': [],
      'dragState.draggedElements': [],
      'dragState.validTargets': new Set(),
      'dragState.sourcePile': null
    });
  }

  /**
   * Cancel drag operation
   */
  cancelDrag() {
    this.cleanupDrag(false);

    if (this.dragTimeout) {
      clearTimeout(this.dragTimeout);
      this.dragTimeout = null;
    }
  }

  /**
   * Handle escape key
   */
  handleEscapeKey(event) {
    if (event.key === 'Escape') {
      const gameState = this.state.getState();
      if (gameState.dragState.isDragging) {
        this.cancelDrag();
      }
    }
  }

  /**
   * Handle double-click for auto-move
   */
  handleDoubleClick(cardElement) {
    const gameState = this.state.getState();

    // Don't auto-move during animation
    if (gameState.gamePhase === 'animating') return;

    // Find the card and its pile
    const pileType = cardElement.dataset.pileType ||
                     (cardElement.parentElement.classList.contains('tableau-pile') ? 'tableau' : null);

    if (!pileType) return;

    let card = null;
    let sourcePile = null;

    if (pileType === 'tableau') {
      const pileIndex = parseInt(cardElement.dataset.pileIndex);
      sourcePile = gameState.piles.tableau[pileIndex];
      card = sourcePile.getTopCard();
    } else if (pileType === 'waste') {
      sourcePile = gameState.piles.waste;
      card = sourcePile.getTopCard();
    }

    if (!card) return;

    // Try to find foundation for this card
    const targetFoundation = this.gameLogic.findFoundationForCard(card, gameState.piles.foundation);

    if (targetFoundation) {
      this.executeMove([card], sourcePile, targetFoundation);
    }
  }

  /**
   * Handle stock pile click
   */
  handleStockClick(event) {
    const gameState = this.state.getState();

    if (gameState.gamePhase === 'animating') return;

    const result = this.gameLogic.handleStockClick(gameState);

    if (result.success) {
      gameState.piles.stock.updateDisplay();
      gameState.piles.waste.updateDisplay();

      if (result.action === 'draw') {
        this.updateMoveCounter();
      }
    }
  }

  /**
   * Find pile object from DOM element
   */
  findPileFromElement(element, gameState) {
    const pileId = element.id;

    if (pileId === 'stock-pile') return gameState.piles.stock;
    if (pileId === 'waste-pile') return gameState.piles.waste;

    if (pileId.startsWith('tableau-')) {
      const index = parseInt(pileId.split('-')[1]);
      return gameState.piles.tableau[index];
    }

    if (pileId.startsWith('foundation-')) {
      const index = parseInt(pileId.split('-')[1]);
      return gameState.piles.foundation[index];
    }

    return null;
  }

  /**
   * Update move counter display
   */
  updateMoveCounter() {
    const gameState = this.state.getState();
    const moveCountElement = document.getElementById('move-count');
    if (moveCountElement) {
      moveCountElement.textContent = gameState.moveCount;
    }
  }

  /**
   * Destroy controller and clean up
   */
  destroy() {
    if (this.dragTimeout) {
      clearTimeout(this.dragTimeout);
    }

    document.removeEventListener('keydown', this.handleEscapeKey);
  }
}
