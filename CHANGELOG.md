# Changelog - Recent Updates

## Latest Session Updates (Post-commit: 4e1474d)

### 🎨 **Draggable & Resizable Chat Component**
Complete rebuild of the Chatbase chat integration with custom controls:

- **Custom Chat Bubble**: Replaced default Chatbase bubble with themed Savonie orangutan icon
  - Background adapts to light/dark mode using CSS variables
  - Radial gradient ring overlay to frame icon
  - Fixed positioning (bottom-right, 24px offset)

- **Draggable Panel**: Chat window can be freely dragged across viewport
  - Drag via header bar with pointer capture for smooth interaction
  - Viewport constraints prevent panel from going off-screen
  - Position persisted in localStorage

- **Proportional Resizing**: Corner handles maintain aspect ratio during resize
  - Four corner handles (◤ ◥ ◣ ◢) for intuitive resizing
  - Size constraints: 320-600px width, 400-700px height
  - Pointer Events API with `setPointerCapture()` prevents sticky drag behavior
  - Works reliably over iframes and during fast mouse movement
  - Dimensions persisted in localStorage

- **State Persistence**: 
  - Open/closed state
  - Panel position (left, top)
  - Panel dimensions (width, height)
  - All stored in localStorage with keys: `chatPanelOpen`, `chatPanelLeft`, `chatPanelTop`, `chatPanelWidth`, `chatPanelHeight`

- **Theme Integration**: 
  - Dynamic iframe URL updates based on `data-theme` attribute
  - Bubble background color inverts between light/dark modes
  - MutationObserver watches for theme changes

- **Simplified Controls**: Single minimize button (—) in header to toggle panel visibility

### 🌍 **Internationalization Improvements**

- **Theme Toggle Addition**: Added dark/light mode toggle to Arabic (`ar/index.html`) and Spanish (`es/index.html`) pages
  - Previously only available on English pages
  - Same sun/moon icon slider design
  - Properly positioned in navigation header

### 🎨 **Form Styling & Accessibility**

- **Contact Form Inputs**: Theme-aware background colors
  - Light mode: `var(--color-bg-secondary)` (rgba(255,255,255,0.5))
  - Dark mode: `rgba(33,40,66,0.4)` with proper text/border contrast
  - Applies to: text, email, url, file inputs, textareas, selects

- **Helper Text Visibility**: Fixed dark mode readability
  - File upload instructions: "Accepted: CSV, DOC..." 
  - URL validation hint: "Only full links starting with..."
  - Privacy notice: "By submitting this form..."
  - All now use `var(--color-text)` with 70% opacity (beige in dark mode, chocolate in light)

- **Footer Email Update**: Changed mailto link to plain text display
  - From: `<a href="mailto:...">Email Me</a>`
  - To: `<span>hello@estivanayramia.com</span>`
  - Resolves non-functional mailto behavior

### 🛠️ **Technical Architecture**

**JavaScript Modules** (`assets/js/site.js`):
- `initDraggableResizableChat()`: Replaces previous `initChatbotBubble()`
- Pointer Events API implementation for drag/resize
- Listener cleanup on interaction end to prevent memory leaks
- Touch and mouse input support

**CSS Updates** (`assets/css/theme.css`):
- `.draggable-chat-panel`: Main panel container styles
- `.draggable-chat-header`: Drag handle area
- `.chat-corner-handle`: Resize handle styling (tl, tr, bl, br)
- `.resizing`: Active resize state with enhanced shadow
- Form input theme variables
- Original Chatbase bubble hidden via `display: none !important`

**Asset Addition**:
- `assets/img/savonie-icon.jpg`: Custom orangutan chatbot avatar

### 🐛 **Bug Fixes**

1. **Sticky Drag Issue**: Prevented element from continuing to drag after mouse release
   - Root cause: Global listeners never removed
   - Solution: Attach/remove listeners per interaction cycle

2. **Resize Over Iframe**: Fixed resize handles not capturing pointer over iframe content
   - Root cause: Iframe captures pointer events
   - Solution: `setPointerCapture(e.pointerId)` on handle elements

3. **Fast Movement Loss**: Panel lost tracking during rapid mouse movement
   - Root cause: Mouse events don't capture pointer outside element
   - Solution: Switched from Mouse Events to Pointer Events API

4. **Theme Inconsistency**: AR/ES pages lacked theme toggle
   - Added identical toggle button markup to both localized pages

5. **Dark Mode Form Contrast**: White input backgrounds and black helper text unreadable
   - Implemented CSS variable-based theming for all form elements

### 📝 **Code Quality**

- Removed duplicate/conflicting event listeners
- Consolidated resize logic into single pointer-based system
- Proper cleanup on component destruction
- Consistent naming conventions across drag/resize handlers
- Prevented duplicate initialization with `window.__chatPanelInit` flag

---

## Previous Commit
**4e1474d** - hamburger menu issue on iOS devices
