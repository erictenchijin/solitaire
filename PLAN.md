# Implementation Plan: Zen-Inspired Solitaire Game (REVISED)

## 1. Summary

Build a web-based Klondike solitaire game with a zen-inspired aesthetic featuring:
- **Minimalist UI**: Clean design with muted colors, subtle shadows, and generous whitespace
- **Smooth Animations**: Fluid card movements using CSS transitions and transforms
- **Drag-and-Drop Gameplay**: Intuitive mouse/touch interactions with comprehensive error handling
- **Standard Klondike Rules**: Classic solitaire gameplay with draw-3 variant
- **Calming Visual Design**: Soft color palette (sage green, cream, soft grays), subtle gradients, and gentle transitions
- **Responsive Layout**: Works on desktop, tablet, and mobile devices with proper touch support

**Technology Stack:**
- Vanilla JavaScript (ES6+ modules) for game logic
- HTML5 for structure
- CSS3 for styling and animations
- No external runtime dependencies (development tooling only)

---

## 2. Architecture & State Management

### 2.1 Module System & Dependency Graph

**Module Import/Export Strategy:**
```
game.js (entry point, no imports)
  └─ imports: card.js, piles.js, gameLogic.js, dragDrop.js, animations.js, stateManager.js

stateManager.js (no imports)
  └─ exports: StateManager class

card.js (no imports)
  └─ exports: Card class, createDeck(), shuffleDeck()

piles.js
  └─ imports: card.js
  └─ exports: Pile, TableauPile, FoundationPile, StockPile, WastePile

gameLogic.js
  └─ imports: card.js, piles.js
  └─ exports: GameLogic class

dragDrop.js
  └─ imports: stateManager.js, gameLogic.js, animations.js
  └─ exports: DragDropController class

animations.js
  └─ imports: stateManager.js
  └─ exports: AnimationController class
```

**Dependency Rules:**
- No circular dependencies
- Core modules (card.js, stateManager.js) have no dependencies
- UI controllers (dragDrop.js, animations.js) depend on core modules
- game.js orchestrates all modules but is not imported by others

### 2.2 State Management Architecture

**Centralized State Object** (managed by StateManager):
```javascript
{
  gameId: string,              // Unique ID for this game session
  gamePhase: 'idle' | 'dealing' | 'playing' | 'animating' | 'won',
  piles: {
    tableau: [TableauPile × 7],
    foundation: [FoundationPile × 4],
    stock: StockPile,
    waste: WastePile
  },
  dragState: {
    isDragging: boolean,
    sourceType: 'tableau' | 'waste' | null,
    sourceIndex: number | null,
    draggedCards: Card[],
    draggedElements: HTMLElement[],
    validTargets: Set<string>,    // Pile IDs that can accept current drag
    currentZIndex: number
  },
  animationQueue: Animation[],   // Pending animations
  moveHistory: Move[],            // For undo functionality
  moveCount: number,
  startTime: number | null,
  settings: {
    drawCount: 1 | 3,
    autoComplete: boolean
  }
}
```

**State Synchronization:**
- Single source of truth in StateManager
- All modules receive state reference during initialization
- State updates trigger events that modules can listen to
- No module stores duplicate state
- Pile objects are part of state but maintain internal consistency

**State Update Flow:**
```
User Action → DragDropController.handleDrop()
  → GameLogic.validateMove() [read state]
  → StateManager.updateState() [write state]
  → StateManager.emit('stateChanged')
  → All modules react to state change
```

---

## 3. Files to Create/Modify

### Core Files

#### `/index.html`
**Purpose**: Main HTML structure and entry point
- Semantic HTML structure for game board
- Container elements for all pile types
- UI controls (reset, undo, settings)
- Meta tags for viewport and touch optimization
- Script tag with `type="module"` for ES6 modules
- ARIA labels and roles for accessibility

#### `/styles.css`
**Purpose**: All visual styling
- CSS variables for zen color palette (revised for contrast)
- Card styling (front/back)
- Layout for tableau, foundation, stock, and waste piles
- Z-index management system (defined layers)
- Responsive breakpoints
- Animation classes (declarative, applied by JS)

#### `/js/stateManager.js` ⭐ NEW
**Purpose**: Centralized state management
- `StateManager` class with event emitter pattern
- Methods: `getState()`, `updateState(path, value)`, `resetState()`
- `subscribe(event, callback)` for state change notifications
- `beginTransaction()` / `commitTransaction()` for atomic multi-step updates
- State validation to prevent invalid states
- Deep freeze state in development mode to prevent accidental mutations

#### `/js/game.js`
**Purpose**: Main game controller and orchestration
- Initialize all modules with state reference
- Game lifecycle management (start, pause, reset)
- Win condition checking
- Coordinate module interactions
- Error boundary - catch and handle errors from all modules
- Entry point for the application

#### `/js/card.js`
**Purpose**: Card entity and deck management
- `Card` class with properties: suit, rank, color, isFaceUp, id
- `createDeck()` - generates standard 52-card deck
- `shuffleDeck(deck)` - Fisher-Yates shuffle
- Card rendering utilities
- No external dependencies

#### `/js/piles.js`
**Purpose**: Pile management classes
- `Pile` base class with common functionality
- `TableauPile` - handles cascading with cascade spacing constant (20px)
- `FoundationPile` - suit-specific, ascending order
- `StockPile` - draw mechanism
- `WastePile` - displays last N cards with overlap, only top card interactive
- Each pile manages its own DOM rendering
- Methods: `addCard()`, `removeCard()`, `canAcceptCard()`, `getTopCard()`, `getMovableCards()`, `render()`

#### `/js/gameLogic.js`
**Purpose**: Klondike rules and move validation
- `GameLogic` class with validation methods
- `validateMove(sourceCards, targetPile, gameState)` - validates before execution
- `validateDuringDrag(sourceCards, targetPile)` - lightweight validation during drag (no multi-card sequence checking)
- `canMoveToTableau()`, `canMoveToFoundation()`, `canMoveSequence()`
- `executeMove(move, gameState)` - updates state atomically
- `rollbackMove(move, gameState)` - undo/rollback support
- `detectAutoMoves(gameState)` - find valid auto-moves
- Stock/waste mechanics with draw-3 specification
- Returns validation results with error codes for different failure types

#### `/js/dragDrop.js`
**Purpose**: Drag-and-drop interaction handling
- `DragDropController` class
- **Desktop**: HTML5 Drag and Drop API with comprehensive error handling
- **Mobile**: Touch event fallback (touchstart, touchmove, touchend)
- Automatic detection and switching between touch/mouse
- Event handlers: `handleDragStart()`, `handleDragMove()`, `handleDragEnd()`
- Error recovery for failed drags (timeout, escape key, invalid state)
- Visual feedback coordination with AnimationController
- Z-index management during drag operations
- Rollback mechanism for failed moves after animation starts
- Validation throttling during drag (max 60fps)

#### `/js/animations.js`
**Purpose**: Animation control and coordination
- `AnimationController` class
- **Responsibility**: JavaScript-based animation orchestration only
- **CSS Animations**: Used for simple transitions (hover, highlights)
- **JS Animations**: Used for complex multi-step animations (deal, move sequences)
- Methods: `animateCardMove(card, fromPos, toPos)`, `animateCardFlip(card)`, `animateDeal()`, `animateWin()`
- Animation queuing system - prevents conflicting animations
- Returns promises that resolve when animation completes
- Can cancel animations if needed
- Uses RequestAnimationFrame for smooth 60fps
- Integrates with StateManager to set `gamePhase: 'animating'`

**Animation Responsibility Boundaries:**
- **CSS handles**: Single-property transitions (opacity, transform for hover states, highlights)
- **JS handles**: Multi-step sequences, coordinated timing, position calculations, state-dependent animations
- **Coordination**: AnimationController adds/removes CSS classes for declarative animations

---

## 4. Implementation Steps (Ordered)

### Phase 1: Project Setup & Core Architecture
**Goal**: Establish foundation with proper module system and state management

1. **Create project structure**
   - Set up all directories and empty files
   - Create package.json (dev dependencies only: local server, optional linter)
   - Create .gitignore
   - Add NPM scripts: `npm run dev` (local server), `npm run lint` (optional)

2. **Implement StateManager** (`js/stateManager.js`)
   - Event emitter base functionality
   - State object initialization
   - `updateState()` with path notation (e.g., `updateState('dragState.isDragging', true)`)
   - Transaction support for atomic multi-step updates
   - State validation checks
   - Subscribe/unsubscribe pattern

3. **Build HTML skeleton** (`index.html`)
   - HTML5 structure with semantic elements
   - Containers: stock pile, waste pile, 4 foundation piles (with suit icons), 7 tableau piles
   - UI elements: reset button, undo button, move counter, timer, settings toggle
   - ARIA labels: `role="button"`, `aria-label`, `aria-live` for game state
   - Script tag: `<script type="module" src="js/game.js"></script>`

4. **Define CSS variables and base styles** (`styles.css`)
   - Revised color palette with better contrast ratios
   - Z-index layer system (CSS custom properties):
     ```css
     --z-base: 1;
     --z-card: 10;
     --z-tableau-card: calc(var(--z-card) + position-in-pile);
     --z-dragging: 1000;
     --z-ui: 100;
     ```
   - Card dimensions with cascade spacing constant
   - Grid layout for game board
   - Base typography
   - Animation class definitions (applied by JS)

### Phase 2: Card System & Pile Management
**Goal**: Create card entities and pile infrastructure

5. **Implement Card class** (`js/card.js`)
   - Card constructor with all properties including unique `id`
   - `createDeck()` - generates 52 cards with proper suits/ranks
   - `shuffleDeck()` - Fisher-Yates implementation
   - `render()` - creates DOM element with proper attributes
   - Export as ES6 module

6. **Design card visuals** (`styles.css`)
   - Card front with suit symbols (Unicode: ♠ ♥ ♦ ♣)
   - Card back with zen pattern
   - Distinct styling for face-down cards in tableau
   - Face-down cards between face-up cards: darker overlay or different border
   - Shadow and border styling
   - Responsive card sizing

7. **Implement Pile classes** (`js/piles.js`)
   - Base `Pile` class with common methods
   - `TableauPile`:
     - Cascade spacing: 20px for face-down, 30px for face-up
     - Handles partial face-up sequences
   - `FoundationPile`: Suit-specific acceptance logic
   - `StockPile`: Draw mechanism with draw-count support
   - `WastePile`:
     - **Draw-3 display**: Shows last 3 cards with 30px horizontal overlap
     - **Interactivity**: Only top card is draggable/clickable
     - **Visual layering**: Proper z-index for stacked display
   - Each pile manages its own rendering to DOM
   - Export all pile classes

### Phase 3: Game Logic & Rules
**Goal**: Implement Klondike rules with comprehensive validation

8. **Implement move validation** (`js/gameLogic.js`)
   - `validateMove(sourceCards, targetPile, gameState)`:
     - Returns `{valid: boolean, errorCode: string, message: string}`
     - Error codes: `INVALID_SEQUENCE`, `WRONG_COLOR`, `WRONG_RANK`, `WRONG_SUIT`, `NOT_KING`, `PILE_FULL`
   - `validateDuringDrag(sourceCards, targetPile)`:
     - Lightweight version for real-time feedback
     - Only checks first and last card of sequence, not full validation
     - Used during mousemove/touchmove (max 60fps throttled)
   - Specific validators:
     - `canMoveToTableau()` - alternating colors, descending rank
     - `canMoveToFoundation()` - same suit, ascending from Ace
     - `canMoveSequence()` - validate all cards in sequence
     - `isKingToEmptyTableau()` - only Kings to empty tableau

9. **Implement stock/waste mechanics** (`js/gameLogic.js`)
   - **Draw-3 specification**:
     - Click stock: move 3 cards (or remaining if < 3) to waste
     - WastePile displays last 3 cards with overlap
     - Only waste.getTopCard() is draggable
     - Cards beneath top card are visible but not interactive
   - **Stock reset**:
     - When stock empty and waste has cards: flip waste back to stock
     - Maintain original order (don't shuffle)
   - **Draw-1 mode**: Same logic but N=1

10. **Implement game initialization** (`js/game.js`)
    - Deal sequence with animation coordination:
      - Deal 1, 2, 3, 4, 5, 6, 7 cards to tableau piles
      - Top card of each pile face-up
      - Remaining cards to stock
      - Set `gamePhase: 'dealing'` during deal, then `'playing'`
    - Initialize state via StateManager
    - Set up error boundary try-catch around all game logic

### Phase 4: Drag & Drop with Mobile Support
**Goal**: Robust drag-and-drop with comprehensive error handling

11. **Implement desktop drag handlers** (`js/dragDrop.js`)
    - Feature detection: Check for Drag and Drop API support
    - `handleDragStart(event)`:
      - Identify dragged card(s) from event target
      - Validate cards are draggable (face-up, movable sequence)
      - Store drag state in StateManager
      - Pre-calculate valid targets using lightweight validation
      - Set initial z-index above all other cards
      - Error handling: Try-catch with rollback
    - `handleDragMove(event)`:
      - Throttle to 60fps using RequestAnimationFrame
      - Update visual feedback (highlight valid targets)
      - Perform lightweight validation only
    - `handleDragEnd(event)`:
      - Full validation of final drop
      - Execute move through GameLogic if valid
      - Trigger animation through AnimationController
      - Rollback mechanism if move fails during animation
      - Clean up drag state
      - Error handling: Always restore original state on failure

12. **Implement mobile touch handlers** (`js/dragDrop.js`)
    - Feature detection: Check for touch events
    - Touch event handlers as fallback:
      - `touchstart` → equivalent to dragstart
      - `touchmove` → update card position to follow finger
      - `touchend` → detect drop target via coordinates
    - Prevent default to avoid scroll during drag
    - Same validation and error handling as desktop
    - Touch-friendly hit areas (min 44×44px)

13. **Implement error handling** (`js/dragDrop.js`)
    - **Timeout protection**: Cancel drag after 30s
    - **Escape key**: Cancel drag and rollback
    - **Invalid state detection**: Check for orphaned drag states
    - **Rollback mechanism**:
      - Store original pile state before move
      - If animation fails or error occurs: restore original state
      - Clear animation queue
      - Reset drag state
    - **Error logging**: Console warnings for debugging
    - **User feedback**: Show subtle error message for failed moves

14. **Z-index management during drag** (`js/dragDrop.js`)
    - **System**:
      - Base layer (z-index: 1): Empty piles
      - Card layer (z-index: 10+): Static cards
      - Tableau cascade: Each card +1 from position
      - Dragging layer (z-index: 1000): Active drag
      - UI layer (z-index: 100): Buttons, menus
    - **During drag**:
      - Set dragged cards to z-index: 1000
      - Maintain relative z-index within dragged sequence
      - Reset to calculated z-index on drop
    - **Overlapping cards**: Tableau cascades use position-based z-index

15. **Multi-card dragging** (`js/dragDrop.js`)
    - Detect click on face-up tableau card
    - Identify all face-up cards below clicked card
    - Validate sequence is movable (no face-down cards in between)
    - Move entire sequence together as single unit
    - Maintain relative positions during drag

### Phase 5: Animations & Polish
**Goal**: Smooth, coordinated animations with proper queuing

16. **Implement AnimationController** (`js/animations.js`)
    - Animation queue system:
      - Queue animations to prevent conflicts
      - Process queue sequentially or in parallel as appropriate
      - Set `gamePhase: 'animating'` during animations
      - Block user input during critical animations
    - Core animations:
      - `animateCardMove(card, fromPos, toPos, duration)` - Returns promise
      - `animateCardFlip(card, toFaceUp)` - Returns promise
      - `animateDeal(cards, piles)` - Sequential animation with delays
      - `animateWin()` - Subtle celebration
    - Use RequestAnimationFrame for 60fps
    - Cancelable animations (for game reset)

17. **Define CSS animation classes** (`styles.css`)
    - `.card-moving` - Applied during JS-animated moves
    - `.card-flipping` - 3D transform flip (applied by JS)
    - `.highlight-valid` - Subtle glow for valid drop zones
    - `.highlight-invalid` - Subtle red tint for invalid drops
    - `.dragging` - Semi-transparent state
    - Transition properties: `transform 300ms ease-out`, `opacity 150ms ease`

18. **Implement auto-flip** (`js/gameLogic.js`, `js/animations.js`)
    - When top card removed from tableau pile:
      - Check if new top card is face-down
      - If yes: Queue flip animation via AnimationController
      - Update card state after animation completes
      - Coordinate with drag-drop to prevent conflicts

### Phase 6: Auto-Move & Advanced Features
**Goal**: Implement auto-move with proper coordination

19. **Implement auto-move system** (`js/gameLogic.js`)
    - **Double-click detection**:
      - Track click timestamps and targets
      - Detect double-click within 300ms
      - Prevent during drag operations
    - **Auto-move logic**:
      - Find valid foundation move for clicked card
      - If valid: Queue move animation
      - If not: Try tableau moves (optional)
    - **Coordination with drag-drop**:
      - Disable drag during auto-move animation
      - Use same animation queue as drag-drop
      - Set `gamePhase: 'animating'` to block conflicts

20. **Add win condition** (`js/game.js`, `js/gameLogic.js`)
    - Check after each move: all foundations have 13 cards
    - Set `gamePhase: 'won'`
    - Trigger win animation via AnimationController
    - Display stats: time, move count
    - Offer new game

### Phase 7: UI/UX & Accessibility
**Goal**: Polished user experience with accessibility

21. **Implement game controls** (`js/game.js`)
    - New Game button:
      - Confirmation dialog if game in progress
      - Reset state via StateManager
      - Cancel active animations
      - Re-deal cards
    - Undo button:
      - Pop last move from moveHistory
      - Rollback move via GameLogic
      - Animate reverse move
    - Settings:
      - Toggle draw-1 vs draw-3
      - Toggle auto-complete
      - Stored in state

22. **Responsive design** (`styles.css`)
    - Mobile-first approach
    - Breakpoints:
      - Mobile: < 640px (portrait)
      - Tablet: 640px - 1024px
      - Desktop: > 1024px
    - Card sizes:
      - Mobile: 50px × 70px
      - Tablet: 70px × 98px
      - Desktop: 80px × 112px
    - Touch-friendly targets: min 44×44px
    - Stack tableau piles more compactly on mobile

23. **Accessibility** (`index.html`, `js/*.js`)
    - ARIA labels on all interactive elements
    - `aria-live="polite"` region for game state updates
    - Focus management during game flow
    - Focus indicators (visible outline)
    - Keyboard navigation (future enhancement - not in MVP)

### Phase 8: Testing & Edge Cases
**Goal**: Comprehensive testing and error handling verification

24. **Edge case testing**
    - All Kings in stock pile
    - Empty tableau pile moves
    - Rapid clicking/dragging
    - Interrupted drag operations (mouse leaves window)
    - Invalid state recovery
    - Animation conflicts
    - Touch + mouse mixed input

25. **Cross-browser/device testing**
    - Desktop: Chrome, Firefox, Safari, Edge
    - Mobile: iOS Safari, Chrome Mobile
    - Test drag-and-drop fallbacks
    - Test touch vs mouse detection
    - Verify error handling on all platforms

26. **Performance optimization**
    - Minimize DOM manipulations (batch updates)
    - Use CSS transforms (GPU accelerated)
    - Throttle drag events to 60fps
    - Profile memory usage
    - Verify 60fps during animations
    - Debounce window resize

---

## 5. Test Strategy

### Manual Testing Checklist

#### Functional Testing
- [ ] All valid moves are accepted
- [ ] All invalid moves are rejected with appropriate error codes
- [ ] Cards flip correctly when revealed
- [ ] Stock pile draws 3 cards correctly (draw-3 mode)
- [ ] Stock pile draws 1 card correctly (draw-1 mode)
- [ ] Waste pile displays last 3 cards with overlap
- [ ] Only top waste card is draggable
- [ ] Stock pile resets when empty (no shuffle)
- [ ] Foundation piles accept only correct cards (suit + rank)
- [ ] Tableau piles accept alternating colors, descending
- [ ] Empty tableau accepts only Kings
- [ ] Multi-card sequences move correctly
- [ ] Face-down cards flip when revealed
- [ ] Win condition triggers when all foundations complete
- [ ] New game resets all state correctly

#### Drag & Drop Testing
- [ ] Desktop mouse drag works smoothly
- [ ] Touch drag works on mobile/tablet
- [ ] Mixed input handled correctly (touch then mouse)
- [ ] Escape key cancels drag
- [ ] Drag timeout (30s) triggers rollback
- [ ] Invalid drops snap back to origin
- [ ] Valid drop zones highlight during drag
- [ ] Invalid drop zones show negative feedback
- [ ] Multi-card drag maintains card positions
- [ ] Z-index correct during drag (cards appear above all)
- [ ] Z-index restored correctly after drop

#### Error Handling Testing
- [ ] Orphaned drag state recovery
- [ ] Animation failure rollback
- [ ] Invalid state detection and correction
- [ ] Mouse leaves window during drag
- [ ] Rapid click/drag sequences
- [ ] Drag during animation blocked
- [ ] Conflicting animations prevented

#### State Management Testing
- [ ] State updates trigger proper events
- [ ] No duplicate state in modules
- [ ] State synchronization across modules
- [ ] Transaction rollback on error
- [ ] State validation catches invalid states

#### Animation Testing
- [ ] Card flip animations smooth (250ms)
- [ ] Card move animations smooth (300ms)
- [ ] Deal animation cascades correctly
- [ ] Win animation appropriate
- [ ] No animation conflicts
- [ ] Animations maintain 60fps
- [ ] Animations cancelable on reset
- [ ] CSS and JS animations coordinated

#### Visual Testing
- [ ] Colors are calming and cohesive
- [ ] Sufficient contrast for readability (WCAG AA)
- [ ] Face-down cards visually distinct
- [ ] Cascade spacing consistent (20px face-down, 30px face-up)
- [ ] Waste pile overlap consistent (30px)
- [ ] No visual glitches during interactions
- [ ] Responsive breakpoints work correctly

#### Cross-Browser Testing
- [ ] Chrome/Edge (Chromium) - desktop & mobile
- [ ] Firefox - desktop & mobile
- [ ] Safari - desktop & mobile (iOS)
- [ ] Drag API fallback triggers on unsupported browsers
- [ ] Touch events work on all mobile browsers

#### Responsive Testing
- [ ] Desktop large (1920×1080)
- [ ] Desktop medium (1366×768)
- [ ] Tablet landscape (1024×768)
- [ ] Tablet portrait (768×1024)
- [ ] Mobile large (414×896)
- [ ] Mobile medium (375×667)
- [ ] Mobile small (320×568)

#### Performance Testing
- [ ] First Contentful Paint < 1s
- [ ] Time to Interactive < 2s
- [ ] Animation frame rate 60fps
- [ ] Memory usage < 50MB
- [ ] No memory leaks during extended play
- [ ] Throttling works (drag events ≤ 60fps)

### Automated Testing (Optional)

**Unit Tests** (Jest or similar - optional):
- Card class methods
- Pile class methods
- Move validation logic
- Shuffle algorithm (statistical distribution)
- State manager updates
- Error code generation

**Integration Tests**:
- Game initialization flow
- Complete game simulation
- Edge cases (all Kings in stock)
- State recovery scenarios

### Testing Tools
- Chrome DevTools: Performance profiling, memory analysis
- Firefox DevTools: Responsive mode
- Safari Developer Tools: iOS testing
- Optional: Lighthouse for performance metrics
- Optional: Jest for unit tests

---

## 6. Acceptance Criteria

### Core Functionality
- [ ] Game follows standard Klondike solitaire rules
- [ ] 7 tableau piles with correct initial deal (1-7 cards, top card face-up)
- [ ] 4 foundation piles (one per suit, Ace to King ascending)
- [ ] Stock pile with configurable draw-1 or draw-3
- [ ] Waste pile displays last 3 cards with 30px overlap (draw-3 mode)
- [ ] Only top waste card is interactive/draggable
- [ ] Valid move detection (alternating colors, descending tableau)
- [ ] Valid foundation moves (same suit, ascending from Ace)
- [ ] Only Kings can move to empty tableau piles
- [ ] Win condition triggers when all 4 foundations complete (13 cards each)
- [ ] New game button resets all state and cancels animations

### Drag & Drop
- [ ] Single cards draggable from tableau, waste, foundation
- [ ] Multiple cards draggable from tableau (face-up sequences only)
- [ ] Desktop mouse drag works correctly
- [ ] Mobile/tablet touch drag works correctly
- [ ] Feature detection switches between mouse and touch
- [ ] Invalid moves prevented (visual snap-back animation)
- [ ] Valid drop zones highlight during drag
- [ ] Invalid drop zones show negative feedback
- [ ] Smooth drop animations (300ms)
- [ ] Escape key cancels drag and restores state
- [ ] Drag timeout (30s) triggers automatic rollback
- [ ] Z-index management during drag (dragged cards always on top)

### Error Handling & Robustness
- [ ] Orphaned drag states detected and cleaned up
- [ ] Animation failures trigger rollback to previous state
- [ ] Invalid game states detected with error codes
- [ ] Mouse leaving window during drag handled gracefully
- [ ] Rapid click/drag sequences don't break state
- [ ] Drag blocked during animations
- [ ] Conflicting animations prevented via queue system
- [ ] All errors logged to console for debugging
- [ ] User receives subtle feedback for failed operations

### State Management
- [ ] Single source of truth in StateManager
- [ ] State updates trigger events to all modules
- [ ] No duplicate state across modules
- [ ] Transactions support atomic multi-step updates
- [ ] State validation prevents invalid configurations
- [ ] Move history maintained for undo functionality

### Visual Design (Zen Aesthetic)
- [ ] Revised color palette with sufficient contrast (WCAG AA)
- [ ] Minimalist card design with clean suits and ranks
- [ ] Face-down cards visually distinct from face-up
- [ ] Face-down cards between face-up cards have distinct styling
- [ ] Generous whitespace around elements
- [ ] Subtle shadows and depth (not harsh)
- [ ] Consistent typography (simple, readable font)
- [ ] No clutter or unnecessary UI elements
- [ ] Cohesive, harmonious overall appearance

### Animations
- [ ] Smooth card flip animations (250ms, 3D transform)
- [ ] Smooth card movement between piles (300ms)
- [ ] Initial deal animation with cascade effect (50ms delay per card)
- [ ] Auto-flip when tableau card revealed
- [ ] Win celebration animation (subtle, zen-appropriate)
- [ ] All animations maintain 60fps (verified via DevTools)
- [ ] No janky or abrupt transitions
- [ ] Animations can be canceled on game reset
- [ ] Animation queue prevents conflicts
- [ ] CSS and JS animations coordinated via defined boundaries

### User Experience
- [ ] Intuitive controls (no tutorial needed for solitaire players)
- [ ] Responsive feedback to all interactions
- [ ] Game state always clear (what's draggable, what's valid)
- [ ] Fast load time (< 2 seconds to interactive)
- [ ] No bugs during normal gameplay
- [ ] Works on desktop browsers (Chrome, Firefox, Safari, Edge)
- [ ] Works on mobile browsers (iOS Safari, Chrome Mobile)
- [ ] Touch and mouse input both supported
- [ ] Automatic detection of input method

### Responsive Design
- [ ] Adapts to screen sizes from 320px to 1920px+
- [ ] Card sizes scale appropriately (50px to 80px width)
- [ ] Tablet layout works in both portrait and landscape
- [ ] Touch targets minimum 44×44px on mobile
- [ ] All UI elements accessible on small screens
- [ ] No horizontal scrolling on any screen size

### Code Quality
- [ ] Clean, readable code with consistent style
- [ ] ES6 modules with clear import/export
- [ ] No circular dependencies
- [ ] Meaningful variable and function names
- [ ] Comments for complex logic
- [ ] No console errors or warnings
- [ ] Efficient DOM manipulation (batched updates)
- [ ] Proper error handling with try-catch
- [ ] State synchronization verified

### Accessibility
- [ ] ARIA labels on all interactive elements
- [ ] `aria-live` region for game state announcements
- [ ] Focus management during game flow
- [ ] Visible focus indicators
- [ ] Semantic HTML structure
- [ ] Sufficient color contrast (WCAG AA minimum)

### Optional Enhancements (Post-MVP)
- [ ] Undo/redo functionality
- [ ] Move counter and timer
- [ ] Hint system (show valid moves)
- [ ] Statistics tracking (games won, best time)
- [ ] Subtle sound effects (muted by default)
- [ ] Keyboard navigation (full accessibility)
- [ ] Dark mode variant
- [ ] Save/restore game state (localStorage)
- [ ] Auto-complete when game is winnable

---

## 7. Implementation Notes

### Color Palette (Revised for Contrast)

```css
/* Revised palette with WCAG AA compliance */
--color-background: #d8dcd8;      /* Sage gray - darker for contrast */
--color-surface: #f5f5f0;          /* Warm white */
--color-card-back: #8fa88f;        /* Sage green */
--color-card-face: #ffffff;        /* Pure white for cards */
--color-text-primary: #2a2a2a;     /* Darker for readability */
--color-text-secondary: #5a5a5a;   /* Medium gray */
--color-accent: #6b8f6b;           /* Deeper sage */
--color-red-suit: #b84545;         /* Deeper muted red */
--color-black-suit: #2a2a2a;       /* Dark gray-black */
--color-highlight: #b8d4b8;        /* Light sage - more distinct */
--color-shadow: rgba(0,0,0,0.15);  /* Slightly stronger shadow */
--color-error: #c86060;            /* Muted red for errors */
```

### Animation Timing & Responsibilities

**CSS Transitions** (simple, single-property):
- Hover states: 150ms ease
- Highlight on/off: 200ms ease
- Opacity changes: 150ms ease

**JS Animations** (complex, multi-step):
- Card flip: 250ms ease-in-out (3D transform)
- Card move: 300ms ease-out (position interpolation)
- Deal animation: 50ms delay per card
- Auto-flip: 250ms (same as manual flip)

### Card Dimensions & Spacing

**Card Sizes** (aspect ratio 1:1.4):
- Desktop: 80px × 112px
- Tablet: 70px × 98px
- Mobile: 50px × 70px

**Cascade Spacing**:
- Tableau face-down: 20px vertical offset
- Tableau face-up: 30px vertical offset
- Waste pile horizontal: 30px offset (draw-3 mode)

### Z-Index System

```css
/* Layer system */
--z-base: 1;              /* Empty piles, background */
--z-card: 10;             /* Static cards */
--z-tableau: 10-80;       /* Tableau cards (10 + position) */
--z-ui: 100;              /* Buttons, controls */
--z-dragging: 1000;       /* Cards being dragged */
--z-modal: 2000;          /* Dialogs, modals */
```

### Stock/Waste Draw-3 Mechanics

**Visual Layout**:
```
[Stock]  [Waste: Card1 Card2 Card3]
                   ◯──◯──● (only ● draggable)
```

**Logic**:
- Stock click → Move min(3, stock.length) cards to waste
- WastePile.render() → Display last 3 cards with 30px overlap
- WastePile.getTopCard() → Only top card (last in array)
- Lower cards visible but no event listeners attached
- Z-index: waste[0] = 10, waste[1] = 11, waste[2] = 12 (top)

### Error Codes

```javascript
const ERROR_CODES = {
  INVALID_SEQUENCE: 'Cards not in valid sequence',
  WRONG_COLOR: 'Alternating colors required',
  WRONG_RANK: 'Descending rank required',
  WRONG_SUIT: 'Same suit required',
  NOT_KING: 'Only Kings allowed on empty tableau',
  PILE_FULL: 'Foundation already complete',
  DRAG_TIMEOUT: 'Drag operation timed out',
  INVALID_STATE: 'Game in invalid state',
  ANIMATION_FAILED: 'Animation could not complete'
};
```

### Module Initialization Pattern

```javascript
// game.js
import { StateManager } from './stateManager.js';
import { DragDropController } from './dragDrop.js';
import { AnimationController } from './animations.js';
import { GameLogic } from './gameLogic.js';

const state = new StateManager();
const animations = new AnimationController(state);
const gameLogic = new GameLogic(state);
const dragDrop = new DragDropController(state, gameLogic, animations);

// All modules share state reference - single source of truth
```

### Performance Targets

- **First Contentful Paint**: < 1s
- **Time to Interactive**: < 2s
- **Frame rate during animations**: 60fps (16.67ms per frame)
- **Memory usage**: < 50MB (measured via Chrome DevTools)
- **Drag event throttle**: 60fps (16.67ms minimum interval)
- **Animation queue processing**: < 5ms overhead per animation

### Validation Strategy

**Two-tier validation**:
1. **Lightweight** (during drag): Check only first and last card, valid targets pre-calculated
2. **Full** (on drop): Validate entire sequence, check game state, verify move legality

**Validation Throttling**:
- Use RequestAnimationFrame to throttle drag event processing
- Max 60 validation calls per second
- Cache validation results for same source/target combination

---

## 8. Development Timeline Estimate

- **Phase 1** (Setup & Architecture): 2-3 hours
- **Phase 2** (Cards & Piles): 3-4 hours
- **Phase 3** (Game Logic): 5-6 hours (includes stock/waste specification)
- **Phase 4** (Drag & Drop + Mobile + Error Handling): 8-10 hours
- **Phase 5** (Animations): 4-5 hours
- **Phase 6** (Auto-move): 2-3 hours
- **Phase 7** (UI/UX & Accessibility): 3-4 hours
- **Phase 8** (Testing & Edge Cases): 4-6 hours

**Total Estimated Time**: 31-41 hours

**Rationale**: Increased from original estimate due to:
- Comprehensive error handling (+ 4 hours)
- Mobile touch support with fallback (+ 4 hours)
- State management architecture (+ 2 hours)
- Animation coordination system (+ 2 hours)
- Extensive testing requirements (+ 1-3 hours)

---

## 9. Risk Mitigation

### Risk: Complex drag-and-drop behavior across browsers
**Mitigation**:
- Use HTML5 Drag and Drop API with comprehensive error handling
- Implement touch event fallback for mobile devices
- Feature detection to switch between modes automatically
- Extensive cross-browser testing
- Timeout and escape key for stuck drags

### Risk: Touch device support inconsistency
**Mitigation**:
- Implement separate touch event handlers (touchstart, touchmove, touchend)
- Automatic detection of input method (touch vs mouse)
- Test on real devices (iOS Safari, Chrome Mobile)
- Touch-friendly hit areas (min 44×44px)
- Prevent default scroll behavior during card drag

### Risk: State synchronization bugs across modules
**Mitigation**:
- Centralized StateManager as single source of truth
- Event-driven updates (subscribe pattern)
- No duplicate state in modules
- Transaction support for atomic multi-step updates
- State validation checks
- Deep freeze in development mode to catch mutations

### Risk: Animation conflicts and timing issues
**Mitigation**:
- Animation queue system prevents simultaneous conflicting animations
- Clear responsibility boundaries (CSS vs JS animations)
- Use `gamePhase: 'animating'` to block user input
- All animations return promises for coordination
- Animations can be canceled on reset
- Rollback mechanism if animation fails

### Risk: Invalid game states and edge cases
**Mitigation**:
- Comprehensive error codes for all failure types
- State validation after every move
- Rollback mechanism for failed moves
- Extensive edge case testing
- Error boundary in game.js catches all errors
- Always restore valid state on error

### Risk: Performance issues on mobile/tablet
**Mitigation**:
- Throttle drag events to 60fps using RequestAnimationFrame
- Use GPU-accelerated CSS transforms
- Minimize DOM manipulations (batch updates)
- Lightweight validation during drag
- Profile performance on real devices
- Optimize for 60fps animations

### Risk: Z-index conflicts during drag
**Mitigation**:
- Defined z-index layer system with CSS variables
- Dragged cards always z-index: 1000
- Position-based z-index for tableau cascades
- Reset z-index after drop completes
- Document z-index system in code comments

### Risk: Drag validation performance (multi-card sequences)
**Mitigation**:
- Two-tier validation: lightweight during drag, full on drop
- Pre-calculate valid targets on drag start
- Cache validation results
- Throttle validation to 60fps max
- Only check first and last card during drag movement

### Risk: Stock/waste display complexity
**Mitigation**:
- Clear specification: 30px overlap, last 3 cards visible
- Only attach events to top card
- Z-index layering for visual stacking
- Explicit render logic in WastePile class
- Test draw-3 and draw-1 modes thoroughly

---

## 10. Future Enhancements (Post-MVP)

1. **Keyboard Navigation**: Full arrow key navigation, enter to select, space to auto-move
2. **Undo/Redo**: Full move history with keyboard shortcuts (Ctrl+Z / Ctrl+Y)
3. **Statistics**: Track games played, won, win rate, best time, average moves
4. **Hint System**: Highlight valid moves, multi-level hints (next move, all moves, best move)
5. **Auto-Complete**: When all cards revealed, offer to auto-complete game
6. **Sound Effects**: Subtle card sounds (flip, place, win) with volume control
7. **Themes**: Multiple visual themes (classic, dark mode, high contrast, seasonal)
8. **Daily Challenge**: Seeded games with leaderboards
9. **Game Modes**: Spider, FreeCell, Pyramid variations
10. **Progressive Web App**: Offline support, installable, push notifications
11. **Save/Restore**: LocalStorage persistence for game in progress
12. **Analytics**: Track common mistakes, suggest improvements
13. **Achievements**: Unlock badges for milestones (win in < 100 moves, etc.)
14. **Customization**: Card back designs, table colors, animation speeds

---

## 11. Dependencies & Tooling

### Runtime Dependencies
**None** - Pure vanilla JavaScript, HTML, CSS

### Development Dependencies (Optional)
```json
{
  "devDependencies": {
    "vite": "^5.0.0",           // Fast dev server with ES modules support
    "eslint": "^8.56.0",        // Code linting (optional)
    "prettier": "^3.2.0"        // Code formatting (optional)
  },
  "scripts": {
    "dev": "vite",              // Start dev server
    "build": "vite build",      // Production build (optional)
    "preview": "vite preview",  // Preview production build
    "lint": "eslint js/**/*.js" // Run linter
  }
}
```

**Note**: Development server recommended for ES6 module support during development. Alternative: Use VS Code Live Server or Python's `http.server`.

---

## 12. Module API Specifications

### StateManager API
```javascript
class StateManager {
  constructor()
  getState(): GameState
  updateState(path: string, value: any): void
  resetState(): void
  subscribe(event: string, callback: Function): void
  unsubscribe(event: string, callback: Function): void
  beginTransaction(): void
  commitTransaction(): void
  rollbackTransaction(): void
}
```

### GameLogic API
```javascript
class GameLogic {
  constructor(stateManager: StateManager)
  validateMove(sourceCards: Card[], targetPile: Pile): ValidationResult
  validateDuringDrag(sourceCards: Card[], targetPile: Pile): boolean
  executeMove(move: Move): void
  rollbackMove(move: Move): void
  detectAutoMoves(): Move[]
  checkWinCondition(): boolean
}

type ValidationResult = {
  valid: boolean
  errorCode?: string
  message?: string
}
```

### AnimationController API
```javascript
class AnimationController {
  constructor(stateManager: StateManager)
  animateCardMove(card: Card, fromPos: Position, toPos: Position): Promise<void>
  animateCardFlip(card: Card, toFaceUp: boolean): Promise<void>
  animateDeal(cards: Card[], piles: Pile[]): Promise<void>
  animateWin(): Promise<void>
  cancelAllAnimations(): void
  isAnimating(): boolean
}
```

### DragDropController API
```javascript
class DragDropController {
  constructor(stateManager: StateManager, gameLogic: GameLogic, animations: AnimationController)
  initialize(): void
  destroy(): void
  handleDragStart(event: DragEvent | TouchEvent): void
  handleDragMove(event: DragEvent | TouchEvent): void
  handleDragEnd(event: DragEvent | TouchEvent): void
  cancelDrag(): void
}
```

---

*This revised plan addresses all critical and major issues identified in the review, providing a robust, well-architected foundation for a production-quality solitaire game with comprehensive error handling, mobile support, and clear separation of concerns.*
