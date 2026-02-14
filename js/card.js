/**
 * Card class and deck utilities
 * No external dependencies
 */

export class Card {
  constructor(suit, rank) {
    this.suit = suit; // 'hearts', 'diamonds', 'clubs', 'spades'
    this.rank = rank; // 'A', '2'-'10', 'J', 'Q', 'K'
    this.color = (suit === 'hearts' || suit === 'diamonds') ? 'red' : 'black';
    this.isFaceUp = false;
    this.id = `${suit}-${rank}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get numeric value of rank (Ace = 1, Jack = 11, Queen = 12, King = 13)
   */
  getValue() {
    if (this.rank === 'A') return 1;
    if (this.rank === 'J') return 11;
    if (this.rank === 'Q') return 12;
    if (this.rank === 'K') return 13;
    return parseInt(this.rank);
  }

  /**
   * Get suit symbol
   */
  getSuitSymbol() {
    const symbols = {
      hearts: '♥',
      diamonds: '♦',
      clubs: '♣',
      spades: '♠'
    };
    return symbols[this.suit];
  }

  /**
   * Flip the card
   */
  flip() {
    this.isFaceUp = !this.isFaceUp;
  }

  /**
   * Create DOM element for this card
   */
  render() {
    const cardElement = document.createElement('div');
    cardElement.className = `card ${this.suit} ${this.isFaceUp ? 'face-up' : 'face-down'}`;
    cardElement.dataset.cardId = this.id;
    cardElement.dataset.suit = this.suit;
    cardElement.dataset.rank = this.rank;
    cardElement.dataset.color = this.color;

    if (this.isFaceUp) {
      cardElement.innerHTML = `
        <div class="card-inner">
          <div class="card-corner top-left">
            <span class="card-corner-rank">${this.rank}</span>
            <span class="card-corner-suit">${this.getSuitSymbol()}</span>
          </div>
          <div class="card-center">
            <span class="card-rank">${this.rank}</span>
            <span class="card-suit">${this.getSuitSymbol()}</span>
          </div>
          <div class="card-corner bottom-right">
            <span class="card-corner-rank">${this.rank}</span>
            <span class="card-corner-suit">${this.getSuitSymbol()}</span>
          </div>
        </div>
      `;
    } else {
      cardElement.innerHTML = '<div class="card-inner"></div>';
    }

    return cardElement;
  }

  /**
   * Clone this card
   */
  clone() {
    const cloned = new Card(this.suit, this.rank);
    cloned.isFaceUp = this.isFaceUp;
    return cloned;
  }
}

/**
 * Create a standard 52-card deck
 */
export function createDeck() {
  const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck = [];

  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push(new Card(suit, rank));
    }
  }

  return deck;
}

/**
 * Shuffle a deck using Fisher-Yates algorithm
 */
export function shuffleDeck(deck) {
  const shuffled = [...deck];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}
