/**
 * StateManager - Centralized state management with event emitter pattern
 * Single source of truth for all game state
 */

export class StateManager {
  constructor() {
    this.state = this.createInitialState();
    this.listeners = new Map();
    this.transaction = null;
  }

  createInitialState() {
    return {
      gameId: this.generateGameId(),
      gamePhase: 'idle', // 'idle' | 'dealing' | 'playing' | 'animating' | 'won'
      piles: {
        tableau: [],
        foundation: [],
        stock: null,
        waste: null
      },
      dragState: {
        isDragging: false,
        sourceType: null,
        sourceIndex: null,
        draggedCards: [],
        draggedElements: [],
        validTargets: new Set(),
        currentZIndex: 1000
      },
      animationQueue: [],
      moveHistory: [],
      moveCount: 0,
      startTime: null,
      settings: {
        drawCount: 3,
        autoComplete: false
      }
    };
  }

  generateGameId() {
    return `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getState() {
    return this.state;
  }

  /**
   * Update state at a specific path
   * @param {string} path - Dot notation path (e.g., 'dragState.isDragging')
   * @param {any} value - New value
   */
  updateState(path, value) {
    const keys = path.split('.');
    let current = this.state;

    // Navigate to the parent of the target property
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }

    // Set the value
    const lastKey = keys[keys.length - 1];
    current[lastKey] = value;

    // Emit change event
    this.emit('stateChanged', { path, value });
  }

  /**
   * Update multiple state properties atomically
   * @param {Object} updates - Object with paths as keys and values
   */
  updateMultiple(updates) {
    Object.entries(updates).forEach(([path, value]) => {
      const keys = path.split('.');
      let current = this.state;

      for (let i = 0; i < keys.length - 1; i++) {
        if (!(keys[i] in current)) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }

      const lastKey = keys[keys.length - 1];
      current[lastKey] = value;
    });

    this.emit('stateChanged', { multiple: true, updates });
  }

  resetState() {
    this.state = this.createInitialState();
    this.emit('stateReset');
  }

  /**
   * Subscribe to state change events
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  subscribe(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * Unsubscribe from events
   * @param {string} event - Event name
   * @param {Function} callback - Callback function to remove
   */
  unsubscribe(event, callback) {
    if (!this.listeners.has(event)) return;

    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  /**
   * Emit an event to all subscribers
   * @param {string} event - Event name
   * @param {any} data - Event data
   */
  emit(event, data) {
    if (!this.listeners.has(event)) return;

    this.listeners.get(event).forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }

  /**
   * Begin a transaction for atomic multi-step updates
   */
  beginTransaction() {
    this.transaction = JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Commit the current transaction
   */
  commitTransaction() {
    this.transaction = null;
    this.emit('stateChanged', { transaction: 'committed' });
  }

  /**
   * Rollback to the transaction start state
   */
  rollbackTransaction() {
    if (this.transaction) {
      this.state = this.transaction;
      this.transaction = null;
      this.emit('stateChanged', { transaction: 'rolled back' });
    }
  }

  /**
   * Validate current state
   * @returns {Object} Validation result with valid flag and errors array
   */
  validateState() {
    const errors = [];

    // Check game phase is valid
    const validPhases = ['idle', 'dealing', 'playing', 'animating', 'won'];
    if (!validPhases.includes(this.state.gamePhase)) {
      errors.push(`Invalid game phase: ${this.state.gamePhase}`);
    }

    // Check drag state consistency
    if (this.state.dragState.isDragging) {
      if (!this.state.dragState.sourceType) {
        errors.push('Dragging but no source type');
      }
      if (this.state.dragState.draggedCards.length === 0) {
        errors.push('Dragging but no cards');
      }
    }

    // Check piles exist
    if (!this.state.piles.stock || !this.state.piles.waste) {
      errors.push('Stock or waste pile missing');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
