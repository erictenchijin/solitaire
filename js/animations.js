/**
 * Animation Controller - Manages card animations and queue
 */

export class AnimationController {
  constructor(stateManager) {
    this.state = stateManager;
    this.animationQueue = [];
    this.isProcessing = false;
  }

  /**
   * Animate a card moving from one position to another
   */
  async animateCardMove(cardElement, fromPos, toPos, duration = 300) {
    return new Promise((resolve, reject) => {
      if (!cardElement) {
        reject(new Error('No card element provided'));
        return;
      }

      // Get current position if not provided
      if (!fromPos) {
        const rect = cardElement.getBoundingClientRect();
        fromPos = { x: rect.left, y: rect.top };
      }

      // Calculate delta
      const deltaX = toPos.x - fromPos.x;
      const deltaY = toPos.y - fromPos.y;

      // Add moving class
      cardElement.classList.add('card-moving');

      // Use transform for smooth animation
      cardElement.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
      cardElement.style.transition = `transform ${duration}ms ease-out`;

      // Wait for animation to complete
      const onTransitionEnd = () => {
        cardElement.classList.remove('card-moving');
        cardElement.style.transform = '';
        cardElement.style.transition = '';
        cardElement.removeEventListener('transitionend', onTransitionEnd);
        resolve();
      };

      cardElement.addEventListener('transitionend', onTransitionEnd);

      // Fallback timeout in case transitionend doesn't fire
      setTimeout(() => {
        if (cardElement.classList.contains('card-moving')) {
          onTransitionEnd();
        }
      }, duration + 50);
    });
  }

  /**
   * Animate card flip
   */
  async animateCardFlip(cardElement, toFaceUp) {
    return new Promise((resolve) => {
      if (!cardElement) {
        resolve();
        return;
      }

      cardElement.classList.add('card-flipping');

      // Update card content at midpoint
      setTimeout(() => {
        if (toFaceUp) {
          cardElement.classList.remove('face-down');
          cardElement.classList.add('face-up');
        } else {
          cardElement.classList.remove('face-up');
          cardElement.classList.add('face-down');
        }
      }, 125);

      // Remove animation class after completion
      setTimeout(() => {
        cardElement.classList.remove('card-flipping');
        resolve();
      }, 250);
    });
  }

  /**
   * Animate dealing cards
   */
  async animateDeal(dealSequence) {
    this.state.updateState('gamePhase', 'dealing');

    for (const deal of dealSequence) {
      const { pile, card, cardElement } = deal;

      // Animate card moving to pile
      const stockPos = document.getElementById('stock-pile').getBoundingClientRect();
      const pilePos = pile.element.getBoundingClientRect();

      await this.animateCardMove(
        cardElement,
        { x: stockPos.left, y: stockPos.top },
        { x: pilePos.left, y: pilePos.top },
        200
      );

      // Small delay between cards
      await this.delay(50);
    }

    this.state.updateState('gamePhase', 'playing');
  }

  /**
   * Animate win celebration
   */
  async animateWin() {
    this.state.updateState('gamePhase', 'won');

    // Get all foundation cards
    const foundationPiles = document.querySelectorAll('.foundation-pile');

    // Subtle bounce animation for each pile
    const animations = [];
    foundationPiles.forEach((pile, index) => {
      animations.push(
        this.delay(index * 100).then(() => {
          pile.style.transform = 'scale(1.05)';
          pile.style.transition = 'transform 300ms ease-out';

          return this.delay(300).then(() => {
            pile.style.transform = 'scale(1)';
            return this.delay(200);
          });
        })
      );
    });

    await Promise.all(animations);

    // Reset transforms
    foundationPiles.forEach(pile => {
      pile.style.transform = '';
      pile.style.transition = '';
    });
  }

  /**
   * Queue an animation
   */
  queueAnimation(animationFn) {
    return new Promise((resolve, reject) => {
      this.animationQueue.push({
        fn: animationFn,
        resolve,
        reject
      });

      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process animation queue
   */
  async processQueue() {
    if (this.isProcessing || this.animationQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    this.state.updateState('gamePhase', 'animating');

    while (this.animationQueue.length > 0) {
      const animation = this.animationQueue.shift();

      try {
        const result = await animation.fn();
        animation.resolve(result);
      } catch (error) {
        console.error('Animation error:', error);
        animation.reject(error);
      }
    }

    this.isProcessing = false;
    const currentPhase = this.state.getState().gamePhase;
    if (currentPhase === 'animating') {
      this.state.updateState('gamePhase', 'playing');
    }
  }

  /**
   * Cancel all pending animations
   */
  cancelAllAnimations() {
    this.animationQueue.forEach(animation => {
      animation.reject(new Error('Animation cancelled'));
    });
    this.animationQueue = [];
    this.isProcessing = false;
  }

  /**
   * Check if currently animating
   */
  isAnimating() {
    return this.isProcessing || this.animationQueue.length > 0;
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get element position
   */
  getElementPosition(element) {
    if (!element) return { x: 0, y: 0 };
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height
    };
  }
}
