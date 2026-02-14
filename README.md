# Zen Solitaire

A beautifully crafted, zen-inspired Klondike solitaire game with minimalist design and smooth animations.

## Features

✨ **Zen Aesthetic**
- Minimalist design with muted sage green and cream colors
- Clean, clutter-free interface
- Smooth animations and transitions
- Generous whitespace for a calming experience

🎮 **Complete Klondike Solitaire**
- Standard Klondike rules
- Draw-1 and Draw-3 modes
- Full drag-and-drop support (desktop and mobile)
- Auto-move on double-click
- Undo functionality
- Win detection and celebration

📱 **Responsive & Accessible**
- Works on desktop, tablet, and mobile
- Touch-friendly on mobile devices
- ARIA labels for screen readers
- Keyboard support (Escape to cancel drag)

🏗️ **Clean Architecture**
- Vanilla JavaScript (ES6 modules)
- No external runtime dependencies
- Centralized state management
- Comprehensive error handling
- Animation queue system

## Getting Started

### Prerequisites

- Node.js and npm (for development server only)

### Installation

```bash
# Install development dependencies
npm install

# Start development server
npm run dev

# Build for production (optional)
npm run build
```

### Playing the Game

1. **Objective**: Move all cards to the four foundation piles (one per suit, Ace through King)

2. **Rules**:
   - Tableau piles: Descending rank, alternating colors
   - Foundation piles: Same suit, ascending from Ace
   - Only Kings can be placed on empty tableau piles
   - Click stock to draw cards (1 or 3 at a time)

3. **Controls**:
   - **Drag & Drop**: Click and drag cards to move them
   - **Double-click**: Auto-move card to foundation
   - **Click Stock**: Draw cards from stock pile
   - **Escape**: Cancel current drag
   - **New Game**: Start a new game
   - **Undo**: Undo last move
   - **Settings**: Toggle between Draw-1 and Draw-3 modes

## Project Structure

```
solitaire/
├── index.html          # Main HTML structure
├── styles.css          # All styling and animations
├── js/
│   ├── game.js         # Main game controller
│   ├── stateManager.js # Centralized state management
│   ├── card.js         # Card entity and deck utilities
│   ├── piles.js        # Pile management classes
│   ├── gameLogic.js    # Klondike rules and validation
│   ├── animations.js   # Animation controller
│   └── dragDrop.js     # Drag-and-drop with touch support
├── package.json
└── README.md
```

## Architecture

### Module Dependencies

```
game.js (orchestrator)
  ├─ stateManager.js (state management)
  ├─ card.js (card entities)
  ├─ piles.js (pile management)
  ├─ gameLogic.js (rules validation)
  ├─ animations.js (animation control)
  └─ dragDrop.js (interaction handling)
```

### Key Features

- **State Management**: Single source of truth with event-driven updates
- **Error Handling**: Comprehensive error codes and rollback mechanism
- **Touch Support**: Automatic detection and fallback for mobile devices
- **Animation Queue**: Prevents conflicting animations
- **Validation**: Two-tier validation (lightweight during drag, full on drop)

## Development

### Code Quality

- ES6+ JavaScript with modules
- No circular dependencies
- Proper error boundaries
- Consistent code style
- Comprehensive inline documentation

### Browser Support

- Chrome/Edge (Chromium) - Desktop & Mobile
- Firefox - Desktop & Mobile
- Safari - Desktop & iOS
- Modern browsers with ES6 module support

## License

MIT

## Credits

Designed and developed with ❤️ using vanilla JavaScript.
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
