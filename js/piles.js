/**
 * Pile management classes
 */

import { Card } from './card.js';

/**
 * Base Pile class
 */
export class Pile {
  constructor(id, type) {
    this.id = id;
    this.type = type; // 'tableau', 'foundation', 'stock', 'waste'
    this.cards = [];
    this.element = null;
  }

  addCard(card) {
    this.cards.push(card);
  }

  removeCard() {
    return this.cards.pop();
  }

  getTopCard() {
    return this.cards.length > 0 ? this.cards[this.cards.length - 1] : null;
  }

  getCardCount() {
    return this.cards.length;
  }

  isEmpty() {
    return this.cards.length === 0;
  }

  clear() {
    this.cards = [];
  }

  /**
   * Get cards that can be moved from this pile
   */
  getMovableCards(cardIndex) {
    return [];
  }

  /**
   * Check if this pile can accept a card
   */
  canAcceptCard(card, fromPile) {
    return false;
  }

  /**
   * Render pile to DOM
   */
  render(container) {
    this.element = container;
    this.updateDisplay();
  }

  updateDisplay() {
    // To be overridden by subclasses
  }
}

/**
 * Tableau Pile - Cascading cards with alternating colors
 */
export class TableauPile extends Pile {
  constructor(id, index) {
    super(id, 'tableau');
    this.index = index;
  }

  /**
   * Get all face-up cards from a specific index
   */
  getMovableCards(cardIndex) {
    // Find the clicked card
    if (cardIndex < 0 || cardIndex >= this.cards.length) {
      return [];
    }

    const clickedCard = this.cards[cardIndex];

    // Card must be face-up
    if (!clickedCard.isFaceUp) {
      return [];
    }

    // Get all cards from clicked card to end
    const movableCards = this.cards.slice(cardIndex);

    // Check if all cards in sequence are face-up
    for (const card of movableCards) {
      if (!card.isFaceUp) {
        return [];
      }
    }

    return movableCards;
  }

  /**
   * Check if this pile can accept a card (or sequence)
   */
  canAcceptCard(card) {
    // Empty tableau only accepts Kings
    if (this.isEmpty()) {
      return card.getValue() === 13; // King
    }

    const topCard = this.getTopCard();

    // Top card must be face-up
    if (!topCard.isFaceUp) {
      return false;
    }

    // Must be alternating colors
    if (card.color === topCard.color) {
      return false;
    }

    // Must be descending rank (one less)
    return card.getValue() === topCard.getValue() - 1;
  }

  /**
   * Remove multiple cards
   */
  removeCards(count) {
    return this.cards.splice(this.cards.length - count, count);
  }

  /**
   * Add multiple cards
   */
  addCards(cards) {
    this.cards.push(...cards);
  }

  updateDisplay() {
    if (!this.element) return;

    // Clear existing cards
    const existingCards = this.element.querySelectorAll('.card');
    existingCards.forEach(card => card.remove());

    // Render each card with cascade
    this.cards.forEach((card, index) => {
      const cardElement = card.render();

      // Position with cascade
      let offset;
      if (index === 0) {
        offset = 0;
      } else if (!this.cards[index - 1].isFaceUp) {
        offset = index * 20; // Face-down cascade spacing
      } else {
        // Calculate cumulative offset
        offset = 0;
        for (let i = 1; i <= index; i++) {
          offset += this.cards[i - 1].isFaceUp ? 30 : 20;
        }
      }

      cardElement.style.position = 'absolute';
      cardElement.style.top = `${offset}px`;
      cardElement.style.left = '0';
      cardElement.style.zIndex = 10 + index;
      cardElement.dataset.pileIndex = this.index;
      cardElement.dataset.cardIndex = index;

      this.element.appendChild(cardElement);
    });
  }
}

/**
 * Foundation Pile - Suit-specific, ascending from Ace
 */
export class FoundationPile extends Pile {
  constructor(id, suit, index) {
    super(id, 'foundation');
    this.suit = suit;
    this.index = index;
  }

  canAcceptCard(card) {
    // Must match suit
    if (card.suit !== this.suit) {
      return false;
    }

    // Empty foundation only accepts Ace
    if (this.isEmpty()) {
      return card.getValue() === 1; // Ace
    }

    const topCard = this.getTopCard();

    // Must be ascending rank (one more)
    return card.getValue() === topCard.getValue() + 1;
  }

  updateDisplay() {
    if (!this.element) return;

    // Clear existing cards
    const existingCards = this.element.querySelectorAll('.card');
    existingCards.forEach(card => card.remove());

    // Only show top card
    if (!this.isEmpty()) {
      const topCard = this.getTopCard();
      const cardElement = topCard.render();
      cardElement.style.position = 'absolute';
      cardElement.style.top = '0';
      cardElement.style.left = '0';
      cardElement.dataset.pileType = 'foundation';
      cardElement.dataset.pileIndex = this.index;

      this.element.appendChild(cardElement);
    }
  }
}

/**
 * Stock Pile - Draw cards
 */
export class StockPile extends Pile {
  constructor(id) {
    super(id, 'stock');
  }

  /**
   * Draw N cards from stock
   */
  draw(count) {
    const drawn = [];
    for (let i = 0; i < count && this.cards.length > 0; i++) {
      drawn.push(this.removeCard());
    }
    return drawn;
  }

  /**
   * Refill from waste pile
   */
  refillFrom(cards) {
    // Reverse order when refilling
    this.cards = [...cards].reverse();
    cards.forEach(card => card.isFaceUp = false);
  }

  updateDisplay() {
    if (!this.element) return;

    // Clear existing cards
    const existingCards = this.element.querySelectorAll('.card');
    existingCards.forEach(card => card.remove());

    // Show card back if not empty
    if (!this.isEmpty()) {
      const topCard = this.getTopCard();
      const cardElement = topCard.render();
      cardElement.style.position = 'absolute';
      cardElement.style.top = '0';
      cardElement.style.left = '0';
      cardElement.dataset.pileType = 'stock';

      this.element.appendChild(cardElement);
    }
  }
}

/**
 * Waste Pile - Display last N cards with overlap
 */
export class WastePile extends Pile {
  constructor(id, displayCount = 3) {
    super(id, 'waste');
    this.displayCount = displayCount; // How many cards to show (draw-3 = 3, draw-1 = 1)
  }

  /**
   * Get visible cards (last N cards)
   */
  getVisibleCards() {
    const startIndex = Math.max(0, this.cards.length - this.displayCount);
    return this.cards.slice(startIndex);
  }

  canAcceptCard(card) {
    // Waste pile doesn't accept cards via drag-drop
    return false;
  }

  updateDisplay() {
    if (!this.element) return;

    // Clear existing cards
    const existingCards = this.element.querySelectorAll('.card');
    existingCards.forEach(card => card.remove());

    // Show last N cards with overlap
    const visibleCards = this.getVisibleCards();

    visibleCards.forEach((card, displayIndex) => {
      const cardElement = card.render();

      // Position with horizontal overlap
      cardElement.style.position = 'absolute';
      cardElement.style.top = '0';
      cardElement.style.left = `${displayIndex * 30}px`; // 30px overlap
      cardElement.style.zIndex = 10 + displayIndex;
      cardElement.dataset.pileType = 'waste';

      // Only top card is draggable
      const isTopCard = displayIndex === visibleCards.length - 1;
      if (!isTopCard) {
        cardElement.style.pointerEvents = 'none';
      }

      this.element.appendChild(cardElement);
    });
  }

  setDisplayCount(count) {
    this.displayCount = count;
  }
}
