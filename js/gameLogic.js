/**
 * Game Logic - Klondike rules and move validation
 */

import { Card } from './card.js';
import { TableauPile, FoundationPile } from './piles.js';

export const ERROR_CODES = {
  INVALID_SEQUENCE: 'Cards not in valid sequence',
  WRONG_COLOR: 'Alternating colors required',
  WRONG_RANK: 'Descending rank required',
  WRONG_SUIT: 'Same suit required',
  NOT_KING: 'Only Kings allowed on empty tableau',
  PILE_FULL: 'Foundation already complete',
  DRAG_TIMEOUT: 'Drag operation timed out',
  INVALID_STATE: 'Game in invalid state',
  ANIMATION_FAILED: 'Animation could not complete',
  INVALID_MOVE: 'Invalid move',
  NO_CARDS: 'No cards to move'
};

export class GameLogic {
  constructor(stateManager) {
    this.state = stateManager;
  }

  /**
   * Full validation for move execution
   */
  validateMove(sourceCards, targetPile) {
    if (!sourceCards || sourceCards.length === 0) {
      return {
        valid: false,
        errorCode: 'NO_CARDS',
        message: ERROR_CODES.NO_CARDS
      };
    }

    const firstCard = sourceCards[0];

    // Validate sequence
    if (sourceCards.length > 1) {
      const sequenceValidation = this.validateSequence(sourceCards);
      if (!sequenceValidation.valid) {
        return sequenceValidation;
      }
    }

    // Validate target pile acceptance
    if (targetPile.type === 'tableau') {
      return this.validateTableauMove(firstCard, targetPile);
    } else if (targetPile.type === 'foundation') {
      // Foundation only accepts single cards
      if (sourceCards.length > 1) {
        return {
          valid: false,
          errorCode: 'INVALID_SEQUENCE',
          message: 'Foundation only accepts single cards'
        };
      }
      return this.validateFoundationMove(firstCard, targetPile);
    }

    return {
      valid: false,
      errorCode: 'INVALID_MOVE',
      message: ERROR_CODES.INVALID_MOVE
    };
  }

  /**
   * Lightweight validation during drag (for performance)
   */
  validateDuringDrag(sourceCards, targetPile) {
    if (!sourceCards || sourceCards.length === 0) return false;

    const firstCard = sourceCards[0];

    if (targetPile.type === 'tableau') {
      return targetPile.canAcceptCard(firstCard);
    } else if (targetPile.type === 'foundation') {
      if (sourceCards.length > 1) return false;
      return targetPile.canAcceptCard(firstCard);
    }

    return false;
  }

  /**
   * Validate card sequence (alternating colors, descending ranks)
   */
  validateSequence(cards) {
    for (let i = 1; i < cards.length; i++) {
      const prevCard = cards[i - 1];
      const currentCard = cards[i];

      // Check alternating colors
      if (prevCard.color === currentCard.color) {
        return {
          valid: false,
          errorCode: 'WRONG_COLOR',
          message: ERROR_CODES.WRONG_COLOR
        };
      }

      // Check descending rank
      if (currentCard.getValue() !== prevCard.getValue() - 1) {
        return {
          valid: false,
          errorCode: 'WRONG_RANK',
          message: ERROR_CODES.WRONG_RANK
        };
      }
    }

    return { valid: true };
  }

  /**
   * Validate move to tableau pile
   */
  validateTableauMove(card, targetPile) {
    if (targetPile.isEmpty()) {
      // Only Kings can go on empty tableau
      if (card.getValue() !== 13) {
        return {
          valid: false,
          errorCode: 'NOT_KING',
          message: ERROR_CODES.NOT_KING
        };
      }
      return { valid: true };
    }

    const topCard = targetPile.getTopCard();

    // Top card must be face-up
    if (!topCard.isFaceUp) {
      return {
        valid: false,
        errorCode: 'INVALID_MOVE',
        message: 'Cannot place on face-down card'
      };
    }

    // Check alternating colors
    if (card.color === topCard.color) {
      return {
        valid: false,
        errorCode: 'WRONG_COLOR',
        message: ERROR_CODES.WRONG_COLOR
      };
    }

    // Check descending rank
    if (card.getValue() !== topCard.getValue() - 1) {
      return {
        valid: false,
        errorCode: 'WRONG_RANK',
        message: ERROR_CODES.WRONG_RANK
      };
    }

    return { valid: true };
  }

  /**
   * Validate move to foundation pile
   */
  validateFoundationMove(card, targetPile) {
    // Check suit match
    if (card.suit !== targetPile.suit) {
      return {
        valid: false,
        errorCode: 'WRONG_SUIT',
        message: ERROR_CODES.WRONG_SUIT
      };
    }

    if (targetPile.isEmpty()) {
      // Only Aces on empty foundation
      if (card.getValue() !== 1) {
        return {
          valid: false,
          errorCode: 'INVALID_MOVE',
          message: 'Foundation must start with Ace'
        };
      }
      return { valid: true };
    }

    const topCard = targetPile.getTopCard();

    // Check if foundation is already complete
    if (topCard.getValue() === 13) {
      return {
        valid: false,
        errorCode: 'PILE_FULL',
        message: ERROR_CODES.PILE_FULL
      };
    }

    // Check ascending rank
    if (card.getValue() !== topCard.getValue() + 1) {
      return {
        valid: false,
        errorCode: 'WRONG_RANK',
        message: 'Foundation requires ascending rank'
      };
    }

    return { valid: true };
  }

  /**
   * Execute a validated move
   */
  executeMove(sourceCards, sourcePile, targetPile) {
    // Create move record for history
    const move = {
      sourceCards: sourceCards.map(c => c.clone()),
      sourcePile: sourcePile,
      targetPile: targetPile,
      sourcePileState: sourcePile.cards.map(c => c.clone()),
      targetPileState: targetPile.cards.map(c => c.clone()),
      timestamp: Date.now()
    };

    // Remove cards from source
    if (sourcePile.type === 'tableau') {
      sourcePile.removeCards(sourceCards.length);
    } else {
      sourceCards.forEach(() => sourcePile.removeCard());
    }

    // Add cards to target
    if (targetPile.type === 'tableau') {
      targetPile.addCards(sourceCards);
    } else {
      sourceCards.forEach(card => targetPile.addCard(card));
    }

    // Check if we need to flip a card on source tableau
    if (sourcePile.type === 'tableau' && !sourcePile.isEmpty()) {
      const topCard = sourcePile.getTopCard();
      if (!topCard.isFaceUp) {
        topCard.flip();
        move.flippedCard = topCard;
      }
    }

    return move;
  }

  /**
   * Rollback a move
   */
  rollbackMove(move) {
    // Restore pile states
    move.sourcePile.cards = move.sourcePileState.map(c => c.clone());
    move.targetPile.cards = move.targetPileState.map(c => c.clone());

    return true;
  }

  /**
   * Detect possible auto-moves to foundation
   */
  detectAutoMoves(gameState) {
    const autoMoves = [];
    const piles = gameState.piles;

    // Check waste pile top card
    if (piles.waste && !piles.waste.isEmpty()) {
      const wasteCard = piles.waste.getTopCard();
      const foundationMove = this.findFoundationForCard(wasteCard, piles.foundation);
      if (foundationMove) {
        autoMoves.push({
          card: wasteCard,
          source: piles.waste,
          target: foundationMove,
          priority: 1
        });
      }
    }

    // Check tableau piles top cards
    piles.tableau.forEach(tableau => {
      if (!tableau.isEmpty()) {
        const topCard = tableau.getTopCard();
        if (topCard.isFaceUp) {
          const foundationMove = this.findFoundationForCard(topCard, piles.foundation);
          if (foundationMove) {
            autoMoves.push({
              card: topCard,
              source: tableau,
              target: foundationMove,
              priority: 2
            });
          }
        }
      }
    });

    return autoMoves;
  }

  /**
   * Find foundation pile that can accept a card
   */
  findFoundationForCard(card, foundationPiles) {
    for (const foundation of foundationPiles) {
      if (foundation.canAcceptCard(card)) {
        return foundation;
      }
    }
    return null;
  }

  /**
   * Check win condition
   */
  checkWinCondition(gameState) {
    const foundations = gameState.piles.foundation;

    // All four foundations must have 13 cards (Ace through King)
    return foundations.every(foundation => foundation.getCardCount() === 13);
  }

  /**
   * Handle stock pile click
   */
  handleStockClick(gameState) {
    const stock = gameState.piles.stock;
    const waste = gameState.piles.waste;
    const drawCount = gameState.settings.drawCount;

    if (stock.isEmpty()) {
      // Refill stock from waste
      if (!waste.isEmpty()) {
        const wasteCards = [...waste.cards];
        waste.clear();
        stock.refillFrom(wasteCards);
        return { action: 'refill', success: true };
      }
      return { action: 'none', success: false };
    }

    // Draw cards
    const drawn = stock.draw(drawCount);
    drawn.forEach(card => {
      card.isFaceUp = true;
      waste.addCard(card);
    });

    return { action: 'draw', count: drawn.length, success: true };
  }
}
