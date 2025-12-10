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
│   ├── audio.ts              # Browser-compatible audio mocks
│   ├── audio-node.ts         # Node.js-only audio utilities
│   ├── fetch.ts              # Fetch/Response mocks
│   ├── index.ts              # Main exports
│   ├── package.json          # Dependencies (@types/node)
│   └── tsconfig.json         # TypeScript configuration
└── python/
    ├── __init__.py
    ├── audio.py              # WAV/MP3 generation
    └── models.py             # Model mocks
```

## Usage

### Frontend Tests (Vitest)

Browser-compatible mocks that work in any JavaScript environment:

```typescript
import {
  createWavBlob,
  generateWavBase64,
  createMockMediaRecorder,
  mockResponses,
  createMockFetch,
} from "../../../mocks/typescript";
import testPhrases from "../../../mocks/fixtures/test-phrases.json";
```

### E2E Tests (Playwright)

For E2E tests running in Node.js that need file system access:

```typescript
// Browser-compatible mocks
import {
  generateWavBase64,
  createMockMediaRecorder,
} from "../../mocks/typescript";

// Node.js-only utilities (for loading test fixtures from disk)
import { loadTestAudioBase64 } from "../../mocks/typescript/audio-node";
```

### Backend Tests (pytest)

The backend test suite has a convenience module that re-exports shared mocks:

```python
# Recommended: Import from backend's test mocks (cleaner paths)
from tests.mocks import create_mock_wav, MockLexicalModel, load_test_audio_fixture

# Alternative: Import directly from shared mocks (requires project root in sys.path)
from mocks.python import create_mock_wav, MockLexicalModel
```

**Note**: The `mocks.python` package requires the project root to be in `sys.path`. For backend tests, this is handled automatically by `backend/tests/conftest.py`. If using mocks outside of pytest, you may need to add the project root to your path manually.

### Dev Mode (Frontend)

```typescript
import testPhrases from "../../../mocks/fixtures/test-phrases.json";
```

## TypeScript Module Organization

The TypeScript mocks are split into browser-compatible and Node.js-only modules:

| File            | Environment       | Contents                                            |
| --------------- | ----------------- | --------------------------------------------------- |
| `audio.ts`      | Browser + Node.js | WAV generation, MediaRecorder/AudioContext mocks    |
| `audio-node.ts` | Node.js only      | File system utilities (`loadTestAudioBase64`, etc.) |
| `fetch.ts`      | Browser + Node.js | Fetch API mocks                                     |
| `index.ts`      | Mixed             | Re-exports from all modules                         |

**Important**: If you're bundling for a browser, do not import from `audio-node.ts` or the Node.js exports from `index.ts`.

**Requirements**:

- TypeScript 5.0+ (uses `"moduleResolution": "bundler"`)
- For `audio-node.ts`: Node.js 18+

**Setup**: The mocks/typescript directory has its own `package.json` with `@types/node`. Run `npm install` in `mocks/typescript/` if you see type errors for Node.js APIs.

## Python Module Organization

| File          | Contents                                                   |
| ------------- | ---------------------------------------------------------- |
| `audio.py`    | WAV/MP3 generation, test fixture loading                   |
| `models.py`   | Mock ML models (MockLexicalModel, MockProsodicModel, etc.) |
| `fixtures.py` | JSON fixture loaders (test_phrases, api_responses)         |

**Path Setup**: The `mocks.python` package is not installed via pip. Instead, `backend/tests/conftest.py` adds the project root to `sys.path` before tests run. This approach was chosen over:

- `pip install -e .`: Would require restructuring as installable packages
- `PYTHONPATH` env var: Less portable across dev environments

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
5. **Browser vs Node.js**: Use `audio.ts` for browser environments, `audio-node.ts` for Node.js-only utilities
