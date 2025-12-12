# Sarcasm Detector Frontend

A React + TypeScript + Vite application featuring a retro VU meter-style interface for sarcasm detection.

## Features

- **Retro Meter Display** — Animated VU meter with needle response and level indicators
- **Dual Input Modes** — Text (lexical) and audio (prosodic) analysis
- **Audio Recording** — Browser-based microphone recording with waveform visualization
- **Responsive Design** — Mobile-friendly with adaptive layouts
- **Smooth Animations** — Power-on effects, loading states, and needle transitions

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The development server runs at `http://localhost:5173`

### Production Build

```bash
npm run build
npm run preview  # Preview the production build locally
```

## Project Structure

```
src/
├── features/
│   ├── input/                    # Input handling
│   │   ├── components/
│   │   │   ├── CableOverlay.tsx  # Decorative cable connection
│   │   │   ├── Controls.tsx      # Recording controls
│   │   │   ├── MicButton.tsx     # Microphone button
│   │   │   ├── SharedTextArea.tsx # Text input area
│   │   │   ├── Status.tsx        # Status indicators
│   │   │   ├── Transcript.tsx    # Audio transcript display
│   │   │   └── Waveform.tsx      # Audio waveform visualization
│   │   ├── apiService.ts         # Backend API communication
│   │   ├── AudioRecorder.tsx     # Audio recording component
│   │   ├── GettingStarted.tsx    # Onboarding screen
│   │   ├── InputContainer.tsx    # Main input container
│   │   ├── TextInput.tsx         # Text input component
│   │   ├── hooks.ts              # Custom React hooks
│   │   └── utils.ts              # Input utilities
│   │
│   └── meter/                    # Meter display
│       ├── components/
│       │   ├── FirstTimeOverlay.tsx  # First-time user overlay
│       │   ├── icons.tsx             # SVG icons
│       │   ├── LevelIndicators.tsx   # LED-style level bars
│       │   └── RotarySwitch.tsx      # Mode selector switch
│       ├── constants.ts          # Meter configuration
│       ├── DetectionProvider.tsx # Detection state management
│       ├── index.tsx             # Main meter component
│       ├── meterConstants.ts     # Animation timings
│       ├── RouteSync.tsx         # Route synchronization
│       ├── types.ts              # TypeScript types
│       ├── useDetection.ts       # Detection hook
│       ├── useWhichInput.ts      # Input mode hook
│       ├── utils.ts              # Meter utilities
│       └── WhichInputProvider.tsx # Input mode context
│
├── App.tsx                       # Main application component
├── index.css                     # Global styles
└── main.tsx                      # Application entry point
```

## Available Scripts

| Command           | Description                              |
| ----------------- | ---------------------------------------- |
| `npm run dev`     | Start development server with hot reload |
| `npm run build`   | TypeScript check + production build      |
| `npm run lint`    | Run ESLint for code quality              |
| `npm run preview` | Preview production build locally         |

## Routing

| Path               | Description                     |
| ------------------ | ------------------------------- |
| `/`                | Redirects to `/getting-started` |
| `/getting-started` | Onboarding / welcome screen     |
| `/text`            | Text (lexical) input mode       |
| `/audio`           | Audio (prosodic) input mode     |

## Key Components

### MeterSection

The main VU meter display featuring:

- Animated needle responding to sarcasm scores
- Dual level indicators (lexical and prosodic)
- Power state management with on/off transitions
- Rotary switch for mode selection

### InputContainer

Routes to the appropriate input component based on the current mode:

- **Text Mode**: Text area for typing input
- **Audio Mode**: Microphone recording with waveform

### DetectionProvider

Global state management for detection results:

- Manages lexical and prosodic sarcasm scores
- Handles loading states
- Coordinates between input and display components

## API Integration

The frontend communicates with the backend via REST APIs:

```typescript
// Text analysis
POST /api/lexical
{ "text": "string" }
→ { "id": "uuid", "value": 0.0-1.0 }

// Audio analysis
POST /api/prosodic
FormData: { audio: File }
→ { "id": "uuid", "value": 0.0-1.0 }
```

## Configuration

### Vite Configuration

The app uses Vite with the React plugin. Configuration is in `vite.config.ts`.

### TypeScript Configuration

- `tsconfig.json` — Base TypeScript config
- `tsconfig.app.json` — Application-specific config
- `tsconfig.node.json` — Node/Vite tooling config

## Docker Deployment

The frontend is containerized with Nginx for production:

```bash
docker build -t sarcasm-frontend .
docker run -p 80:80 sarcasm-frontend
```

The Nginx configuration (`nginx.conf`) handles:

- Static file serving
- SPA routing (redirects to index.html)
- API proxying to backend service

## Technologies

- **React 19** — UI library with concurrent features
- **TypeScript 5.8** — Type safety
- **Vite 6** — Build tool with HMR
- **React Router 7** — Client-side routing
- **React Compiler** — Automatic memoization (experimental)

## Browser Support

- Chrome/Edge 90+
- Firefox 90+
- Safari 15+

Audio recording requires browser support for the MediaRecorder API.
