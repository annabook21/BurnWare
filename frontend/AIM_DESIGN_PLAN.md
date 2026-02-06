# Classic AIM (2000s) Design Implementation Plan

## Design Research Summary

### Classic AIM Visual Elements (Adapted for BurnWare)

**Iconic Features:**
- **BurnWare Flame Logo** - Your custom logo replaces the running man icon
- **Buddy List Window** - Adapted to "Links List" with active/expired status
- **Chat Windows** - Individual draggable, resizable windows for viewing threads
- **Away Messages** - Adapted to link descriptions
- **Door Opening/Closing Sounds** - Iconic notification sounds (burn sounds fit the theme!)
- **Beveled Borders** - 3D raised/sunken effects (Windows 98-style)
- **Blue/Gray Color Scheme** - Classic Windows application palette
- **Orange/Fire Accents** - From your BurnWare logo (complements AIM colors)
- **Title Bars** - Draggable windows with minimize/maximize/close buttons

**Design Philosophy:**
- Keep classic AIM interaction patterns (buddy list, chat windows)
- Use BurnWare branding (flame logo, orange/fire theme)
- Maintain 2000s nostalgic aesthetic
- Make "burning" visually satisfying with fire theme

References:
- AIM Archive: https://web.archive.org/web/20020119232831/http://aim.aol.com/
- Color Library: https://colourlibrary.dev/brand/aim

### Color Palette (AIM + BurnWare)

```css
/* BurnWare Brand Colors (from your logo) */
--burnware-orange: #FF6B35      /* Primary brand color */
--burnware-fire-red: #FF4500    /* Burn action, fire theme */
--burnware-dark-blue: #003366   /* From logo */
--burnware-flame-yellow: #FFB84D /* Flame highlights */

/* Classic AIM Base Colors */
--aim-blue: #0066CC             /* Links and accents */
--aim-gray: #C0C0C0             /* Window backgrounds */
--aim-dark-gray: #808080        /* Borders and dividers */
--aim-white: #FFFFFF            /* Content areas */
--aim-black: #000000            /* Text */

/* Status Colors (adapted to BurnWare theme) */
--status-active: #00FF00        /* Green - active link */
--status-expiring: #FFB84D      /* Orange - expiring soon */
--status-expired: #808080       /* Gray - expired/burned */

/* Accent Colors */
--burn-warning: #FF4500         /* Burn button and warnings */
--new-message: #FFD700          /* New message indicator */
```

**Design Strategy:** Use AIM's window styling (gray, beveled borders) but incorporate BurnWare's fire/orange theme for actions, logos, and burn-related features.

---

## Implementation Strategy

### Technology Stack

**UI Component Library: 98.css**
- Pure CSS design system for Windows 98 aesthetic
- Perfect for AIM's 2000s look (AIM ran on Windows 98/2000/XP)
- Framework-agnostic, works with React
- TypeScript compatible
- npm package: `98.css`
- Reference: https://jdan.github.io/98.css/

**Window Management: react-draggable**
- Draggable windows (implementation uses react-draggable; resizing can be added later)
- TypeScript support, widely used
- Lightweight; works well for multi-window AIM interface
- Plan originally cited react-flexi-window; current choice is react-draggable per implementation

**Styling Approach: CSS Modules + styled-components**
- Modular CSS for components
- TypeScript type safety
- Scoped styles
- Dynamic theming

**Sound Effects: Howler.js**
- Door open/close sounds
- Message received sounds
- Classic AIM notification sounds

---

## Component Architecture (All < 500 Lines)

### File Structure

```
frontend/src/
├── types/                        # Shared types (Link, Message, Thread, StatusType)
│   ├── index.ts
│   ├── link.ts
│   ├── message.ts
│   ├── thread.ts
│   └── status.ts
│
├── theme/
│   ├── aim-theme.ts              # AIM color palette & constants
│   ├── global-styles.ts          # Global CSS for 98.css integration
│   └── fonts.ts                  # Classic fonts (Tahoma, MS Sans Serif)
│
├── components/aim-ui/
│   ├── BuddyList.tsx             # Main buddy list window
│   ├── BuddyListItem.tsx         # Individual buddy item
│   ├── ChatWindow.tsx            # Individual chat window
│   ├── WindowFrame.tsx           # Reusable window frame (react-draggable)
│   ├── TitleBar.tsx              # Window title bar with controls
│   ├── StatusIndicator.tsx       # Active/expiring/expired indicator
│   ├── AwayMessageDialog.tsx     # Away message / link description editor
│   ├── WindowManager.tsx         # Manages multiple chat windows
│   ├── SoundManager.tsx          # AIM sounds (door open/close)
│   ├── LoadingScreen.tsx         # Loading state
│   └── ConfirmDialog.tsx         # Confirm (e.g. burn) dialog
│
├── components/dashboard/
│   ├── LinksPanel.tsx            # Links management (AIM-styled)
│   ├── ThreadsPanel.tsx          # Threads view; messages in ChatWindow
│   ├── CreateLinkDialog.tsx      # Create link dialog
│   └── QRCodeDialog.tsx          # QR code display window
│
├── hooks/
│   ├── useWindowPosition.ts      # Track window positions (cascade)
│   └── useAIMSounds.ts           # Sound effects hook (Howler)
│
└── utils/
    └── window-utils.ts           # Window positioning helpers
```

**Implementation note:** `useDraggable` and `useBuddyStatus` are not separate hooks—drag logic is in WindowFrame (react-draggable); status is derived in BuddyList via `getStatus(link)`. `MessagesView` is inlined in ChatWindow. `sound-utils.ts` is optional (future preload). Shared types live in `src/types/` (Link, Message, Thread, StatusType). All files under 500 lines.

---

## Key Design Patterns

### 1. AIM Buddy List → BurnWare Links List

**Classic AIM:**
```
┌─ Buddy List ──────────────┐
│ □ Online (3)              │
│   ● John123               │
│   ● Sarah456              │
│   ● Mike789               │
│ □ Away (1)                │
│   ◐ Tom222                │
│ □ Offline (5)             │
│   ○ ...                   │
└───────────────────────────┘
```

**BurnWare Adaptation:**
```
┌─ My Anonymous Links ──────┐
│ □ Active Links (5)        │
│   ● Work Inbox (12 msgs)  │
│   ● Personal (3 msgs)     │
│   ● Feedback (0 msgs)     │
│ □ Expired (2)             │
│   ○ Old Link 1            │
│   ○ Old Link 2            │
└───────────────────────────┘
```

### 2. AIM Chat Window → BurnWare Thread View

**Classic AIM:**
```
┌─ Instant Message from John123 ─┬─□─X─┐
│ ┌─────────────────────────────┐│     │
│ │ John123: Hey what's up?     ││     │
│ │ You: Not much, you?         ││     │
│ │ John123: Same here          ││     │
│ └─────────────────────────────┘│     │
│ ┌─────────────────────────────┐│     │
│ │ Type message here...        ││     │
│ └─────────────────────────────┘│     │
│ [Send] [Font] [Emoji]          │     │
└─────────────────────────────────┴─────┘
```

**BurnWare Adaptation:**
```
┌─ Thread: Anonymous User #abc123 ─┬─□─X─┐
│ ┌─────────────────────────────────┐│   │
│ │ 🕐 2:30 PM - Anonymous          ││   │
│ │ Hey, I have a question...       ││   │
│ │                                  ││   │
│ │ 🕐 2:35 PM - You (Owner)        ││   │
│ │ Sure, what's up?                ││   │
│ └─────────────────────────────────┘│   │
│ ┌─────────────────────────────────┐│   │
│ │ Type reply...                   ││   │
│ └─────────────────────────────────┘│   │
│ [Reply] [Burn Thread] [⚠️]        │   │
└───────────────────────────────────┴───┘
```

### 3. AIM Login Screen → BurnWare Auth

**Classic AIM style with Cognito integration:**
- BurnWare flame logo (your branding)
- Simple email/password fields
- "Sign On" button with beveled border (classic style)
- "Remember Me" checkbox
- Nostalgic loading animation with flame theme

---

## CSS Implementation (98.css)

### Installation

```bash
cd frontend
npm install 98.css
npm install react-flexi-window
npm install howler  # For sounds
npm install @types/howler
```

### Global Styles

```typescript
// theme/global-styles.ts (~120 lines)
import '98.css';

export const AIMGlobalStyles = `
  /* Override 98.css with AIM-specific colors */
  :root {
    --surface: #C0C0C0;
    --button-highlight: #FFFFFF;
    --button-shadow: #808080;
    --window-frame: #0831D9;
    --dialog-blue: #0831D9;
    --aim-yellow: #FFD700;
  }

  body {
    background: #008080; /* Classic teal desktop background */
    font-family: 'Tahoma', 'MS Sans Serif', sans-serif;
    font-size: 11px;
  }

  /* AIM-style window */
  .aim-window {
    border: 2px outset #C0C0C0;
    background: #C0C0C0;
    box-shadow: 2px 2px 8px rgba(0, 0, 0, 0.3);
  }

  /* Title bar */
  .aim-title-bar {
    background: linear-gradient(to right, #0831D9, #1084D0);
    color: white;
    font-weight: bold;
    padding: 3px 5px;
    cursor: move;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  /* Buddy list styling */
  .aim-buddy-list {
    background: white;
    border: 2px inset #C0C0C0;
    overflow-y: auto;
  }

  /* Status indicators */
  .status-online::before {
    content: '●';
    color: #00FF00;
    margin-right: 5px;
  }

  .status-away::before {
    content: '◐';
    color: #FFA500;
    margin-right: 5px;
  }

  .status-offline::before {
    content: '○';
    color: #808080;
    margin-right: 5px;
  }
`;
```

---

## Component Implementation

### BuddyList.tsx (~240 lines)

```typescript
import React, { useState } from 'react';
import styled from 'styled-components';
import { WindowFrame } from './WindowFrame';
import { BuddyListItem } from './BuddyListItem';

interface Link {
  link_id: string;
  display_name: string;
  message_count: number;
  expires_at?: Date;
}

interface BuddyListProps {
  links: Link[];
  onLinkClick: (linkId: string) => void;
  onCreateLink: () => void;
}

// Styled components for AIM aesthetic
const BuddyContainer = styled.div`
  width: 240px;
  height: 400px;
  font-family: 'Tahoma', sans-serif;
  font-size: 11px;
`;

const Header = styled.div`
  background: linear-gradient(to bottom, #FFFFFF, #E0E0E0);
  border-bottom: 1px solid #808080;
  padding: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const BrandLogo = styled.img`
  width: 32px;
  height: 32px;
  object-fit: contain;
  filter: drop-shadow(1px 1px 2px rgba(0, 0, 0, 0.3));
`;

const GroupHeader = styled.div`
  background: #C0C0C0;
  border: 1px solid #808080;
  padding: 2px 5px;
  font-weight: bold;
  cursor: pointer;
  user-select: none;

  &:hover {
    background: #D0D0D0;
  }
`;

const ScrollArea = styled.div`
  background: white;
  border: 2px inset #C0C0C0;
  height: 280px;
  overflow-y: auto;
  padding: 4px;
`;

const ActionButtons = styled.div`
  padding: 4px;
  display: flex;
  gap: 4px;
  border-top: 1px solid #808080;
`;

export const BuddyList: React.FC<BuddyListProps> = ({
  links,
  onLinkClick,
  onCreateLink,
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(['active'])
  );

  const activeLinks = links.filter((l) => !l.expires_at || new Date(l.expires_at) > new Date());
  const expiredLinks = links.filter((l) => l.expires_at && new Date(l.expires_at) <= new Date());

  const toggleGroup = (group: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(group)) {
      newExpanded.delete(group);
    } else {
      newExpanded.add(group);
    }
    setExpandedGroups(newExpanded);
  };

  return (
    <WindowFrame title="BurnWare - My Anonymous Links" width={240} height={400}>
      <BuddyContainer>
        <Header>
          <BrandLogo src="/burnware-logo.png" alt="BurnWare" />
          <div>
            <div style={{ fontWeight: 'bold' }}>Your Inbox</div>
            <div style={{ fontSize: '9px', color: '#666' }}>
              {activeLinks.length} active
            </div>
          </div>
        </Header>

        <ScrollArea>
          <GroupHeader onClick={() => toggleGroup('active')}>
            {expandedGroups.has('active') ? '▼' : '▶'} Active Links ({activeLinks.length})
          </GroupHeader>
          {expandedGroups.has('active') && activeLinks.map((link) => (
            <BuddyListItem
              key={link.link_id}
              name={link.display_name}
              status="online"
              messageCount={link.message_count}
              onClick={() => onLinkClick(link.link_id)}
            />
          ))}

          <GroupHeader onClick={() => toggleGroup('expired')}>
            {expandedGroups.has('expired') ? '▼' : '▶'} Expired ({expiredLinks.length})
          </GroupHeader>
          {expandedGroups.has('expired') && expiredLinks.map((link) => (
            <BuddyListItem
              key={link.link_id}
              name={link.display_name}
              status="offline"
              messageCount={0}
              onClick={() => onLinkClick(link.link_id)}
            />
          ))}
        </ScrollArea>

        <ActionButtons>
          <button className="btn-98" onClick={onCreateLink}>
            New Link
          </button>
          <button className="btn-98">Settings</button>
        </ActionButtons>
      </BuddyContainer>
    </WindowFrame>
  );
};
```

### ChatWindow.tsx (~280 lines)

```typescript
import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { WindowFrame } from './WindowFrame';
import { useSounds } from '../hooks/useAIMSounds';

interface Message {
  id: string;
  content: string;
  sender_type: 'anonymous' | 'owner';
  created_at: Date;
}

interface ChatWindowProps {
  threadId: string;
  linkName: string;
  messages: Message[];
  onSendMessage: (message: string) => void;
  onBurn: () => void;
  onClose: () => void;
}

const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  font-family: 'Tahoma', sans-serif;
  font-size: 11px;
`;

const MessageArea = styled.div`
  flex: 1;
  background: white;
  border: 2px inset #C0C0C0;
  padding: 8px;
  overflow-y: auto;
  margin: 4px;
`;

const MessageBubble = styled.div<{ isOwner: boolean }>`
  margin: 4px 0;
  padding: 4px 0;
  color: ${(props) => (props.isOwner ? '#0000FF' : '#FF0000')};

  .timestamp {
    font-size: 9px;
    color: #666;
  }

  .sender {
    font-weight: bold;
  }

  .content {
    color: #000;
    word-wrap: break-word;
  }
`;

const InputArea = styled.div`
  border-top: 1px solid #808080;
  padding: 4px;
`;

const TextInput = styled.textarea`
  width: calc(100% - 8px);
  height: 60px;
  border: 2px inset #C0C0C0;
  padding: 4px;
  font-family: 'Tahoma', sans-serif;
  font-size: 11px;
  resize: none;
  margin: 4px;
`;

const ButtonBar = styled.div`
  display: flex;
  gap: 4px;
  padding: 4px;
  background: #C0C0C0;
`;

export const ChatWindow: React.FC<ChatWindowProps> = ({
  threadId,
  linkName,
  messages,
  onSendMessage,
  onBurn,
  onClose,
}) => {
  const [inputValue, setInputValue] = useState('');
  const messageEndRef = useRef<HTMLDivElement>(null);
  const { playMessageReceived } = useSounds();

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (inputValue.trim()) {
      onSendMessage(inputValue);
      setInputValue('');
      playMessageReceived();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <WindowFrame
      title={`Thread - ${linkName}`}
      width={450}
      height={400}
      onClose={onClose}
    >
      <ChatContainer>
        <MessageArea>
          {messages.map((msg) => (
            <MessageBubble key={msg.id} isOwner={msg.sender_type === 'owner'}>
              <div className="timestamp">
                {new Date(msg.created_at).toLocaleTimeString()}
              </div>
              <div className="sender">
                {msg.sender_type === 'owner' ? 'You' : 'Anonymous'}:
              </div>
              <div className="content">{msg.content}</div>
            </MessageBubble>
          ))}
          <div ref={messageEndRef} />
        </MessageArea>

        <InputArea>
          <TextInput
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your reply..."
            maxLength={5000}
          />
          <ButtonBar>
            <button className="btn-98" onClick={handleSend}>
              Send
            </button>
            <button className="btn-98" onClick={onBurn}>
              🔥 Burn Thread
            </button>
            <button className="btn-98" onClick={onClose}>
              Close
            </button>
          </ButtonBar>
        </InputArea>
      </ChatContainer>
    </WindowFrame>
  );
};
```

### WindowFrame.tsx (~180 lines)

**Reusable draggable window component with AIM styling**

Uses `react-flexi-window` for drag/resize functionality, styled to match classic AIM windows.

---

## Sound Effects

### Classic AIM Sounds

**Required Sounds:**
1. **Door Opening** - When new message arrives
2. **Door Closing** - When thread is burned/closed
3. **Buddy Sign On** - When new thread created
4. **Buddy Sign Off** - Optional

**Implementation:**

```typescript
// hooks/useAIMSounds.ts (~90 lines)
import { Howl } from 'howler';

const sounds = {
  doorOpen: new Howl({ src: ['/sounds/door-open.mp3'], volume: 0.5 }),
  doorClose: new Howl({ src: ['/sounds/door-close.mp3'], volume: 0.5 }),
  messageReceived: new Howl({ src: ['/sounds/message.mp3'], volume: 0.4 }),
};

export const useAIMSounds = () => {
  return {
    playDoorOpen: () => sounds.doorOpen.play(),
    playDoorClose: () => sounds.doorClose.play(),
    playMessageReceived: () => sounds.messageReceived.play(),
  };
};
```

**Sound Files:**
- Host in `frontend/public/sounds/`
- Use royalty-free recreations or similar sounds
- Keep file sizes small (<100KB each)

---

## Responsive Design Strategy

**Desktop-First Approach:**
- AIM was a desktop application
- Primary experience is desktop (draggable windows work best)
- Mobile: Simplified single-window view (non-draggable)

**Breakpoints:**
```css
/* Desktop: Full AIM experience */
@media (min-width: 1024px) {
  /* Multi-window, draggable interface */
}

/* Tablet/Mobile: Simplified view */
@media (max-width: 1023px) {
  /* Single-window, stack-based navigation */
  /* No dragging, standard mobile UX */
}
```

---

## Anonymous Send Page Design

**Classic AIM-style public page:**

```
┌─ Send Anonymous Message ─────────┬─□─X─┐
│                                   │     │
│  📨 Send to: Work Inbox           │     │
│                                    │     │
│  ┌───────────────────────────────┐│     │
│  │ Type your message here...     ││     │
│  │                                ││     │
│  │                                ││     │
│  │                                ││     │
│  └───────────────────────────────┘│     │
│                                    │     │
│  [Send Message]                   │     │
│                                    │     │
│  Your message is anonymous and    │     │
│  private. The recipient can burn  │     │
│  the thread at any time.          │     │
│                                    │     │
└────────────────────────────────────┴─────┘
```

Styled like an AIM chat window but for anonymous sending.

---

## Implementation Plan (Modular, <500 Lines Per File)

### Phase 1: Theme & Base Components (5 files)

1. **`theme/aim-theme.ts`** (80 lines)
   - Color palette constants
   - Typography settings
   - Spacing/sizing constants

2. **`theme/global-styles.ts`** (120 lines)
   - Import 98.css
   - AIM-specific overrides
   - Global CSS-in-JS

3. **`components/aim-ui/WindowFrame.tsx`** (180 lines)
   - Reusable window component
   - Uses react-flexi-window
   - Title bar with controls
   - AIM styling applied

4. **`components/aim-ui/TitleBar.tsx`** (120 lines)
   - Window title bar
   - Minimize/maximize/close buttons
   - Draggable handle

5. **`components/aim-ui/StatusIndicator.tsx`** (70 lines)
   - Online/away/offline status dots
   - Color-coded indicators

### Phase 2: Buddy List Components (4 files)

6. **`components/aim-ui/BuddyList.tsx`** (240 lines)
   - Main links list window
   - Collapsible groups
   - Action buttons

7. **`components/aim-ui/BuddyListItem.tsx`** (90 lines)
   - Individual link item
   - Status indicator
   - Message count badge
   - Click handlers

8. **`components/aim-ui/AwayMessageDialog.tsx`** (160 lines)
   - Edit link description (like away message)
   - Modal dialog with AIM styling

9. **`components/dashboard/LinksPanel.tsx`** (250 lines)
   - Links management in AIM style
   - CRUD operations with AIM UI

### Phase 3: Chat/Thread Components (4 files)

10. **`components/aim-ui/ChatWindow.tsx`** (280 lines)
    - Thread view as chat window
    - Message history display
    - Reply input area
    - Burn button

11. **`components/aim-ui/WindowManager.tsx`** (220 lines)
    - Manages multiple open chat windows
    - Window positioning logic
    - Z-index management

12. **`components/dashboard/ThreadsPanel.tsx`** (240 lines)
    - Threads list view
    - Opens threads in chat windows

13. **`components/dashboard/MessagesView.tsx`** (200 lines)
    - Messages formatted AIM-style
    - Timestamp display
    - Sender indicators

### Phase 4: Anonymous Send Page (3 files)

14. **`components/public/SendMessageWindow.tsx`** (220 lines)
    - Anonymous send interface
    - AIM chat window style
    - CAPTCHA integration
    - Form validation

15. **`components/public/LinkMetadataDisplay.tsx`** (140 lines)
    - Display link info
    - QR code in AIM dialog style

16. **`components/aim-ui/QRCodeDialog.tsx`** (140 lines)
    - QR code display in popup window
    - Print/download buttons

### Phase 5: Sounds & Interactions (4 files)

17. **`components/aim-ui/SoundManager.tsx`** (100 lines)
    - Sound effect management
    - Volume controls
    - Mute option

18. **`hooks/useAIMSounds.ts`** (90 lines)
    - Sound playback hooks
    - Door open/close/message sounds

19. **`hooks/useWindowPosition.ts`** (80 lines)
    - Window position tracking
    - Cascade positioning logic

20. **`hooks/useDraggable.ts`** (120 lines)
    - Draggable window logic
    - Touch support

### Phase 6: Utilities (2 files)

21. **`utils/window-utils.ts`** (90 lines)
    - Window positioning helpers
    - Cascade algorithm
    - Screen bounds checking

22. **`utils/sound-utils.ts`** (70 lines)
    - Sound loading utilities
    - Preload management

### Phase 7: Main App Components (3 files)

23. **`App.tsx`** (180 lines)
    - Main application component
    - Window state management
    - AIM desktop background

24. **`pages/Dashboard.tsx`** (240 lines)
    - Dashboard with AIM aesthetic
    - Multiple windows management

25. **`pages/SendPage.tsx`** (200 lines)
    - Public anonymous send page
    - AIM-styled interface

**Total: 25 new files, all under 300 lines**

---

## Package Dependencies

Current implementation (see `package.json`):

- **98.css** – Windows 98 aesthetic
- **react-draggable** – draggable windows (not react-flexi-window)
- **howler** – sound effects
- **styled-components** (v6) – dynamic styling + theme
- **react-router-dom** (v6) – SPA routing
- **amazon-cognito-identity-js** – Cognito auth (AWS recommends Amplify Auth for new apps; migration optional)
- **axios** – API calls
- **qrcode.react** – QR display
- **Vite** – build tool; **TypeScript** – type safety

---

## CSS-in-JS vs CSS Modules

**Recommendation: Styled-Components + 98.css**

**Rationale:**
- styled-components for dynamic AIM components
- 98.css for base Windows 98 aesthetic
- Type-safe props for theme values
- Scoped styles prevent conflicts
- Easy to maintain under 500-line limit

**Alternative:** CSS Modules if you prefer separate CSS files

---

## Design Tokens

```typescript
// theme/aim-theme.ts (~80 lines)

export const aimTheme = {
  colors: {
    // BurnWare brand colors (from your logo)
    brandOrange: '#FF6B35',      // Primary brand color
    fireRed: '#FF4500',          // Burn actions, fire theme
    darkBlue: '#003366',         // From logo
    flameYellow: '#FFB84D',      // Flame highlights
    
    // Classic AIM base colors
    blue: '#0066CC',             // Links and accents
    blueGradientStart: '#0831D9',
    blueGradientEnd: '#1084D0',
    gray: '#C0C0C0',             // Window background (keep classic)
    darkGray: '#808080',         // Borders
    white: '#FFFFFF',
    black: '#000000',
    
    // Status colors (adapted to BurnWare)
    active: '#00FF00',           // Active links (green)
    expiring: '#FFB84D',         // Expiring soon (flame yellow)
    expired: '#808080',          // Expired/burned (gray)
    newMessage: '#FF6B35',       // New message indicator (brand orange)
  },
  
  fonts: {
    primary: "'Tahoma', 'MS Sans Serif', sans-serif",
    size: {
      small: '9px',
      normal: '11px',
      large: '13px',
    },
  },
  
  spacing: {
    xs: '2px',
    sm: '4px',
    md: '8px',
    lg: '12px',
  },
  
  borders: {
    outset: '2px outset #C0C0C0',
    inset: '2px inset #C0C0C0',
    solid: '1px solid #808080',
  },
  
  shadows: {
    window: '2px 2px 8px rgba(0, 0, 0, 0.3)',
    button: '1px 1px 2px rgba(0, 0, 0, 0.2)',
  },
};

export type AIMTheme = typeof aimTheme;
```

---

## Features Mapping

### AIM Feature → BurnWare Equivalent

| AIM Feature | BurnWare Implementation |
|-------------|-------------------------|
| Yellow Running Man | **BurnWare Flame Logo** (your branding!) |
| Buddy List | Links List (active/expired groups) |
| Chat Window | Thread View (messages) |
| Away Message | Link Description |
| Door Open Sound | New Thread Notification (🔥 fire crackle?) |
| Door Close Sound | Thread Burned Notification (🔥 whoosh sound) |
| Online/Away/Offline Status | Active/Expiring/Expired Link Status |
| Green Dot (Online) | 🔥 Fire icon for active links |
| Send IM | Send Reply to Thread |
| IM Tabs | Multiple Thread Windows |
| Warning Dialog | Burn Confirmation Dialog (🔥 themed) |
| Yellow Buddy Icon | BurnWare logo in header |

**Key Adaptation:** The "burn" theme from your logo fits PERFECTLY with the concept - use fire/flame emojis and orange accents throughout!

---

## Technical Considerations

### Performance

- **Window Virtualization**: Only render visible windows
- **Message Virtualization**: Use react-window for long message lists
- **Sound Preloading**: Preload sounds on app init
- **styled-components (see below)**: Prefer theme CSS variables or `attrs` for dynamic values to reduce style recalc

#### Styled-Components Performance (Best Practice)

To keep styled-components fast and avoid unnecessary re-renders:

- **Theme for static values:** Use `${aimTheme.colors.x}` etc. so styles stay stable.
- **Dynamic props:** For components that change often (e.g. message bubbles with `isOwner`), prefer one of:
  - **CSS variables:** Set a data attribute or inline style with `--owner: 0/1` and use `color: ${props => props.theme.colors[props.isOwner ? 'owner' : 'anon']}` or a single class that reads a CSS variable, so the styled component doesn’t get a new class per prop change.
  - **`attrs`:** Use `.attrs(props => ({ ... }))` for static or rarely changing props so the class isn’t regenerated every render.
- **Reuse with `css`:** Use the `css` helper for shared style fragments instead of duplicating template literals.
- **React.memo:** Wrap list item components (e.g. BuddyListItem, message rows) in `React.memo` when they receive stable props to cut down re-renders.

Reference: [styled-components FAQ](https://styled-components.com/docs/faqs), [Josh W. Comeau – styled-components](https://www.joshwcomeau.com/css/styled-components/).

### Accessibility

- **Semantic HTML first**: Use `<button>`, `<dialog>`, `<nav>`, etc.; add ARIA only when necessary ([ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)).
- **Keyboard Navigation**: Full keyboard support for window management
- **Screen Readers**: Proper ARIA labels despite retro styling
- **Color Contrast**: Ensure text readable despite nostalgic colors (WCAG)
- **Focus Management**: Proper focus handling for multiple windows; visible focus indicators

### Mobile Adaptation

**Desktop (>= 1024px):**
- Full multi-window draggable experience
- Classic AIM aesthetic

**Mobile (< 1024px):**
- Single window view
- Stack-based navigation
- Touch-friendly controls
- Still maintains AIM color scheme and typography

---

## Implementation Steps

### Step 1: Install Dependencies

```bash
cd frontend
npm install 98.css react-flexi-window howler styled-components
npm install -D @types/howler @types/styled-components
```

### Step 2: Create Theme Files

- `theme/aim-theme.ts`
- `theme/global-styles.ts`
- `theme/fonts.ts`

### Step 3: Implement Base Components

- `WindowFrame.tsx`
- `TitleBar.tsx`
- `StatusIndicator.tsx`

### Step 4: Implement Buddy List

- `BuddyList.tsx`
- `BuddyListItem.tsx`

### Step 5: Implement Chat Windows

- `ChatWindow.tsx`
- `WindowManager.tsx`

### Step 6: Add Sounds

- Download/create AIM-style sounds
- Implement sound hooks
- Add sound controls

### Step 7: Build Dashboard

- Integrate components into dashboard
- Multi-window management
- AIM desktop background

### Step 8: Style Anonymous Send Page

- AIM-styled send interface
- Maintains retro aesthetic

---

## Visual Mockup (ASCII)

### Desktop Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Desktop Background (Teal #008080)                           │
│                                                               │
│  ┌─ My Anonymous Links ─┬─□─X─┐                             │
│  │ 🔥 Your Inbox         │     │  (BurnWare logo here)       │
│  │      3 active         │     │                             │
│  ├───────────────────────┤     │                             │
│  │ ▼ Active Links (3)    │     │                             │
│  │   🔥 Work (12 msgs)   │     │  (Fire = active)            │
│  │   🔥 Personal (3)     │     │                             │
│  │   🔥 Feedback (0)     │     │                             │
│  │ ▶ Expired (2)         │     │                             │
│  │   💨 Old Link 1       │     │  (Smoke = expired)          │
│  ├───────────────────────┤     │  ┌─ Thread: Work ─┬─□─X─┐  │
│  │ [New Link] [Settings] │     │  │ Messages        │     │  │
│  └───────────────────────┴─────┘  │ ┌─────────────┐│     │  │
│                                     │ │ 👤 Anon:    ││     │  │
│                                     │ │ Question... ││     │  │
│                                     │ │             ││     │  │
│                                     │ │ 🔥 You:     ││     │  │
│                                     │ │ Answer...   ││     │  │
│                                     │ └─────────────┘│     │  │
│                                     │ ┌─────────────┐│     │  │
│                                     │ │ Type reply  ││     │  │
│                                     │ └─────────────┘│     │  │
│                                     │ [Send] [🔥Burn]│     │  │
│                                     └────────────────┴─────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Note:** Your flame logo appears in the buddy list header, and fire emojis/icons are used throughout to maintain your branding while keeping the AIM aesthetic.

---

## File Size Guarantee

All new files will be under 500 lines:
- Theme files: < 120 lines
- Component files: < 280 lines
- Hook files: < 120 lines
- Utility files: < 90 lines

**Enforced by same ESLint rules and pre-commit hooks.**

---

## Estimated Implementation Time

- Theme setup: 1 hour
- Base components: 3 hours
- Buddy List: 2 hours
- Chat Windows: 3 hours
- Sounds: 1 hour
- Integration: 2 hours
- Testing & refinement: 2 hours

**Total: ~14 hours of development**

---

## Deployment & Environment (Best Practices)

- **SPA routing**: CloudFront is configured (in CDK) to serve `index.html` for all paths (404/403 → 200 + index.html).
- **API base URL**: Set `VITE_API_BASE_URL` to the **API endpoint** (e.g. ALB URL), not the CloudFront domain. Variables are baked in at build time (S3 is static).
- **Build**: `npm run build` then `aws s3 sync dist/ s3://bucket/`; inject env vars in CI/CD before build; do not commit `.env`.

## References

- 98.css: https://jdan.github.io/98.css/
- AIM Design Archive: https://web.archive.org/web/20020119232831/http://aim.aol.com/
- react-draggable: https://github.com/react-grid-layout/react-draggable
- AIM Color Palette: https://colourlibrary.dev/brand/aim
- Howler.js: https://howlerjs.com/
- W3C ARIA APG: https://www.w3.org/WAI/ARIA/apg/

---

## Next Steps

Would you like me to:
1. Implement the full AIM aesthetic frontend now?
2. Start with just the theme and base components?
3. Create a visual prototype/demo first?

All implementation will follow the 500-line-per-file constraint and maintain the professional code organization standards we've established.
