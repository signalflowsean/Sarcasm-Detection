# Shared Mocks

Centralized mock data and utilities for testing and development. This folder provides a single source of truth for:

- Test audio fixtures
- API response fixtures
- Test phrases for sarcasm detection
- Browser API mocks (TypeScript)
- Python test mocks

## Structure

```
mocks/
├── fixtures/
│   ├── test-audio.wav        # Shared audio file for all tests
│   ├── generate-audio.js     # Node.js script to regenerate audio
│   └── test-phrases.json     # Sarcastic test phrases
├── api/
│   └── responses.json        # API response fixtures
├── typescript/
│   ├── audio.ts              # Browser API mocks (MediaRecorder, etc.)
│   ├── fetch.ts              # Fetch/Response mocks
│   └── index.ts              # Main exports
└── python/
    ├── __init__.py
    ├── audio.py              # WAV/MP3 generation
    └── models.py             # Model mocks
```

## Usage

### Frontend Tests (Vitest)

```typescript
import {
  mockLexicalResponse,
  createMockFetchResponse,
} from "../../../mocks/typescript";
import testPhrases from "../../../mocks/fixtures/test-phrases.json";
```

### E2E Tests (Playwright)

```typescript
import {
  injectBrowserAudioMocks,
  loadTestAudioBase64,
} from "../../mocks/typescript";
```

### Backend Tests (pytest)

```python
from mocks.python.audio import create_mock_wav
from mocks.python.models import MockLexicalModel
```

### Dev Mode (Frontend)

```typescript
import testPhrases from "../../../mocks/fixtures/test-phrases.json";
```

## Regenerating Audio Fixture

```bash
cd mocks/fixtures
node generate-audio.js
```

## Guidelines

1. **JSON fixtures** are the source of truth for data that crosses language boundaries
2. **TypeScript/Python modules** provide language-specific utilities
3. Keep mocks minimal but valid (e.g., audio files should pass format validation)
4. All tests should use these mocks for consistency
