# Moonshine Speech Recognition Models

This document provides a comprehensive comparison of Moonshine ASR (Automatic Speech Recognition) models, their performance characteristics, and guidance for selecting the optimal model for your use case.

## Overview

Moonshine is an on-device speech recognition system that runs entirely in the browser. Models are downloaded once and cached by the browser for subsequent use. This document helps you understand the trade-offs between model size, accuracy, and performance.

### Why Moonshine?

This app uses Moonshine instead of the Web Speech API for speech-to-text because:

**Cross-Platform Consistency**: The Web Speech API isn't fully implemented across mobile browsers, especially on iOS Safari. Moonshine provides consistent behavior across all platforms:

- ✅ Works identically on Chrome, Firefox, Safari, Edge
- ✅ Same accuracy and features on desktop and mobile
- ✅ No platform-specific fallbacks or workarounds needed

**On-Device Processing**: Models run entirely in the browser using ONNX Runtime Web (WebAssembly):

- Privacy-friendly (no audio sent to servers)
- Works offline after initial model download
- Consistent performance regardless of API availability

**Predictable Accuracy**: Unlike the Web Speech API (which varies by browser and region), Moonshine models have known, documented accuracy metrics that are consistent across all platforms.

## Model Comparison

| Model    | Size   | Parameters | Word Error Rate (WER) | Download Time (50 Mbps) | Use Case                                                   |
| -------- | ------ | ---------- | --------------------- | ----------------------- | ---------------------------------------------------------- |
| **tiny** | ~190MB | 27M        | 15-20%                | ~30 seconds             | Mobile devices, slower connections, real-time requirements |
| **base** | ~400MB | 61M        | 10-12%                | ~64 seconds             | **Default** - Best accuracy for most use cases             |

> **Note**: A "small" model was mentioned in early documentation but does not exist on the Moonshine CDN. Only `tiny` and `base` are available.

### What is Word Error Rate (WER)?

WER measures transcription accuracy. Lower is better:

- **10-12%**: Excellent - suitable for production applications
- **15-20%**: Good - acceptable for many use cases but may miss nuances
- **>20%**: Fair - may require post-processing or user corrections

For sarcasm detection, **accuracy is critical** because prosodic analysis depends on correct transcription. The base model's improved WER directly impacts detection reliability.

## Network Impact Analysis

### Download Times by Connection Speed

| Connection Type    | Speed     | tiny (190MB) | base (400MB) |
| ------------------ | --------- | ------------ | ------------ |
| **3G Mobile**      | 3 Mbps    | ~8 minutes   | ~18 minutes  |
| **4G Mobile**      | 20 Mbps   | ~76 seconds  | ~2.7 minutes |
| **WiFi (Average)** | 50 Mbps   | ~30 seconds  | ~64 seconds  |
| **Fiber**          | 100+ Mbps | ~15 seconds  | ~32 seconds  |

**Important Notes:**

- These are **first-load times only** (or when switching models)
- Models are **cached by the browser** after initial download
- Subsequent visits load instantly from cache (even after app redeployment)
- Models are served from Moonshine CDN, independent of your app deployment
- Re-download is only required when **changing models** (e.g., tiny → base)

### Mobile Considerations

For mobile users (the primary use case for prosodic sarcasm detection):

- **4G+**: base model is acceptable (~2-3 minutes first load)
- **3G**: Longer wait times may impact user experience
- **WiFi**: All models perform well

**Recommendation**: Start with base model. If analytics show significant mobile 3G traffic with high bounce rates, consider adaptive loading in Phase 2.

## Caching Strategy

### Browser Caching

Moonshine models are cached using standard browser cache mechanisms:

1. **First Visit**: Model downloads from CDN
2. **Subsequent Visits**: Model loads from browser cache (instant)
3. **Cache Duration**: Follows CDN cache headers (typically long-lived)
4. **Storage**: Uses browser cache (separate from localStorage)

### CDN Distribution

Models are served from `https://download.moonshine.ai/model/{name}/quantized/`

CDN benefits:

- Geographic distribution (faster downloads)
- High availability
- Automatic edge caching

### Cache Invalidation

Models remain cached unless:

- User clears browser cache
- **Different model is selected** (e.g., switching from tiny to base requires new download)
- CDN cache expires (extremely rare)

**Important:** App redeployments do NOT invalidate the model cache. Models are served from Moonshine's CDN, not from your app's servers.

## Model Selection Guide

### Use tiny when:

- Targeting primarily mobile users on slower connections
- Real-time transcription speed is critical
- Accuracy trade-off is acceptable
- Bandwidth costs are a concern

### Use base when (Recommended Default):

- Accuracy is important (e.g., sarcasm detection)
- Most users have decent connections (4G+/WiFi)
- First-load experience can accommodate ~1-2 minute wait
- Prosodic detection depends on transcript quality

## Technical Details

### URL Structure

Models follow this CDN pattern:

```
https://download.moonshine.ai/model/{modelName}/quantized/{file}
```

Files typically include:

- `encoder_model.onnx` (largest file)
- `decoder_model.onnx`
- `tokenizer.json`

### Model Format

- **Format**: ONNX (Open Neural Network Exchange)
- **Runtime**: ONNX Runtime Web (runs in browser via WebAssembly)
- **Quantization**: Models are quantized for smaller size and faster inference
- **Platform**: Cross-browser compatible (Chrome, Firefox, Safari, Edge)

### Integration

In this app, models are loaded via:

```typescript
import * as Moonshine from '@moonshine-ai/moonshine-js'

const transcriber = new Moonshine.MicrophoneTranscriber(
  'model/base', // or 'model/tiny'
  callbacks
)
```

## Performance Characteristics

### Inference Speed

All models provide **real-time transcription** on modern devices:

- Desktop/Laptop: All models perform well
- High-end Mobile: All models acceptable
- Mid-range Mobile: tiny slightly faster, but difference is minimal
- Low-end Mobile: tiny recommended

**Note**: First-time download is the main performance bottleneck, not inference speed.

### Memory Usage

Approximate runtime memory (during transcription):

- tiny: ~200-300MB
- base: ~450-550MB

Modern mobile devices (2GB+ RAM) handle both models comfortably.

## Accuracy vs Performance Trade-offs

### For Sarcasm Detection (This App)

**Key Insight**: This app uses TWO independent detection methods:

1. **Lexical Detection** - Analyzes WHAT you say (text-based, needs good transcription)
2. **Prosodic Detection** - Analyzes HOW you say it (audio-based, tone/pitch/rhythm)

Both contribute to the overall sarcasm score, but they work independently.

**Impact of WER on Detection Quality**:

| Model | WER    | Transcription Quality | Lexical Detection Impact        | Prosodic Detection Impact |
| ----- | ------ | --------------------- | ------------------------------- | ------------------------- |
| tiny  | 15-20% | Good                  | May miss subtle linguistic cues | ✅ No impact              |
| base  | 10-12% | Excellent             | Best accuracy for text analysis | ✅ No impact              |

**Why Better Transcription Still Matters**:

The base model improves the **lexical detection** component by providing more accurate text:

**Example**:

- Phrase: "Oh great, _another_ meeting"
- **tiny** transcribes: "Oh great another meeting" (misses punctuation/emphasis)
- **base** transcribes: "Oh great, another meeting" (captures structure)

Better transcription = better lexical analysis = better overall sarcasm detection (combining both lexical + prosodic signals).

### Decision Matrix

```
High Accuracy Required? ──Yes──> base model
         │
         No
         │
         ▼
      tiny model
```

## Switching Models

### Development

Use the dev-only model selector (visible only in development mode):

1. Start app in dev mode: `npm run dev`
2. Model selector appears in bottom-left corner
3. Select different model from dropdown
4. Page automatically reloads to apply the change

Selection persists in localStorage for testing consistency across sessions.

### Production

Change environment variable in Railway:

1. Navigate to Railway dashboard → Frontend service → Variables
2. Update `VITE_MOONSHINE_MODEL=model/{name}`
3. Redeploy: `railway up -s Frontend`
4. Users will download new model on next visit

**Important Caching Behavior:**

- **Changing models** (tiny → base): Users must re-download new model
- **Regular app updates** (same model): Users keep cached model, no re-download needed
- Models are cached independently from your app code
- Only model changes require re-download, not every deployment

## Future Optimizations (Phase 2)

Potential improvements being considered:

1. **Dynamic Model Selection**: Auto-detect network speed, load appropriate model
2. **Progressive Loading**: Load tiny first, upgrade to base in background
3. **Model Streaming**: Download models in chunks for better perceived performance
4. **Analytics Integration**: Track real-world performance to optimize defaults

See main README TODO section for Phase 2 planning details.

## Testing Different Models

### Dev Mode Testing

1. Start dev server: `npm run dev`
2. Open browser console
3. Use model selector to switch models (page auto-reloads)
4. Record test phrases
5. Run `window.viewMoonshineMetrics()` to see performance data
6. Compare load times and transcription quality

### Mobile Testing

For testing on actual mobile devices:

1. Start with HTTPS tunnel (required for microphone):

   ```bash
   npm run dev
   npx localtunnel --port 5173
   ```

2. Open tunnel URL on phone

3. Test each model with real mobile connection

4. Check metrics in mobile browser console

See `docs/MOBILE_DEV_TESTING.md` for detailed mobile testing guide.

## Recommendations

### Current Default: base model

**Rationale**:

- Better transcription improves **lexical detection** accuracy (text analysis)
- Most users have 4G+/WiFi (acceptable load times)
- 2x accuracy improvement (10-12% vs 15-20% WER) justifies 210MB size increase
- Prosodic detection works independently on audio (unaffected by transcription quality)
- Overall sarcasm score benefits from better lexical component

### When to Reconsider

Monitor these metrics (Phase 2):

- **High bounce rate** during model load → Consider tiny default with base upgrade
- **Many 3G users** → Implement adaptive loading
- **User feedback** about load times → Add progressive loading

## Additional Resources

- [Moonshine.ai Official Site](https://www.moonshine.ai/)
- [ONNX Runtime Documentation](https://onnxruntime.ai/docs/get-started/with-javascript.html)
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) (not used due to incomplete mobile browser support)

## Changelog

- **2025-01-XX**: Initial documentation (Phase 1)
  - Documented available models (tiny and base only)
  - Set base as default for accuracy
  - Added network impact analysis and caching details
  - Note: Early versions incorrectly mentioned a "small" model that doesn't exist on CDN
