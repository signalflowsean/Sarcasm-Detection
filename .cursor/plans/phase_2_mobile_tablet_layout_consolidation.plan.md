# Phase 2: Mobile/Tablet Layout Consolidation

## Goal

Replace the modal-based input system on mobile/tablet with a single-page layout where all controls are always visible. Remove routing on mobile/tablet and integrate the new DetectionModeSwitch component.

## Overview

This phase transforms the mobile/tablet experience from a multi-step modal flow to a consolidated single-screen interface. The user should be able to see and interact with all detection controls directly on the meter without opening modals or scrolling.

---

## Phase Split

This phase is split into two sub-phases:

### Phase 2A: Build New UI (Steps 1-4)
Build the new consolidated input controls alongside the existing system.
- Create MobileInputControls component
- Integrate DetectionModeSwitch into meter
- Add disabled states
- CSS for new layout

### Phase 2B: Remove Old System (Steps 5-10)
Remove the modal system and clean up once new UI is proven.
- Remove Modal Launcher and MobileInputOverlay
- Disable routing on mobile/tablet
- Update WhichInputProvider
- Update FirstTimeOverlay
- CSS cleanup
- E2E test updates

---

## Changes

# PHASE 2A

### 1. Replace RotarySwitch with DetectionModeSwitch (Mobile/Tablet Only)

**Files:**

- `frontend/src/features/meter/index.tsx`
- `frontend/src/features/meter/components/RotarySwitch.tsx` (keep for desktop)

**Current behavior:**

- RotarySwitch has 3 positions: Off, Text, Audio
- Controls routing via `useWhichInput` hook
- Mobile/tablet uses this to determine which modal content to show

**New behavior (mobile/tablet only):**

- DetectionModeSwitch replaces RotarySwitch visually
- Two positions: Lexical (left) and Prosodic (right)
- Default to Lexical on page load
- Desktop continues using RotarySwitch unchanged

**Implementation:**

```tsx
// In MeterSection component
const isMobile = useMediaQuery(MEDIA_QUERIES.isTablet)

// In render, conditionally show switch
<div className="meter__controls">
  {isMobile ? (
    <DetectionModeSwitch 
      value={detectionMode} 
      onChange={setDetectionMode} 
    />
  ) : (
    <RotarySwitch />
  )}
</div>
```

**State management:**

- Create new state `detectionMode: 'lexical' | 'prosodic'` in MeterSection
- This state only matters for mobile/tablet
- Pass down to the new MobileInputControls component

---

### 2. Create MobileInputControls Component

**New file:** `frontend/src/features/input/components/MobileInputControls.tsx`This component contains all input controls in a grid layout, always visible on mobile/tablet.**Props:**

```typescript
interface MobileInputControlsProps {
  detectionMode: 'lexical' | 'prosodic'
  onDetect: (text: string) => void
  onDetectAudio: (audio: Blob) => void
}
```

**Contains:**

1. **Shared text input** (`SharedTextarea`) - always visible

- Enabled in both modes
- Used for text input in lexical mode
- Shows transcription in prosodic mode

2. **Audio recorder button** - always visible

- Enabled only in prosodic mode
- Disabled (grayed out) in lexical mode
- Shows recording state when active

3. **Audio preview/controls** - visible when audio recorded

- Play/pause button
- Trash (delete) button
- Only functional in prosodic mode

4. **Transcriber button** - visible when audio recorded

- Triggers whisper transcription
- Only functional in prosodic mode

5. **Send to detector button** - always visible

- In lexical mode: sends text
- In prosodic mode: sends audio + text (if transcribed)

**Layout (Grid):**

```javascript
+----------------------------------+
|        [Shared Text Input]       |
|         (spans full width)       |
+----------------------------------+
|  [Record]  |  [Play] [Trash]     |
+------------+---------------------+
|  [Transcribe]  |  [Send Button]  |
+----------------+-----------------+
```

**CSS Grid structure:**

```css
.mobile-input-controls {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: auto auto auto;
  gap: 0.75rem;
  padding: 1rem;
  background: inherit; /* Match meter background */
}

.mobile-input-controls__textarea {
  grid-column: 1 / -1; /* Span full width */
}

.mobile-input-controls__record {
  grid-column: 1;
}

.mobile-input-controls__audio-controls {
  grid-column: 2;
  display: flex;
  gap: 0.5rem;
}

.mobile-input-controls__transcribe {
  grid-column: 1;
}

.mobile-input-controls__send {
  grid-column: 2;
}
```

---

### 3. Add Disabled States to Components

**Files to modify:**

- `frontend/src/features/input/components/RecordButton.tsx` (or create)
- `frontend/src/features/input/AudioRecorder.tsx`
- Existing button components

**Disabled state styling:**

```css
.mobile-input-controls__record:disabled,
.mobile-input-controls__transcribe:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  filter: grayscale(50%);
}

/* Visual indicator that audio features are disabled in lexical mode */
.mobile-input-controls[data-mode="lexical"] .audio-only {
  opacity: 0.4;
  pointer-events: none;
}
```

**Behavior:**

- In lexical mode:
- Record button: disabled
- Play/Trash: disabled (hidden if no audio)
- Transcribe: disabled
- Text input: enabled
- Send: enabled (sends text)
- In prosodic mode:
- Record button: enabled
- Play/Trash: enabled when audio exists
- Transcribe: enabled when audio exists
- Text input: shows transcription (can be edited)
- Send: enabled when audio OR text exists

---

### 4. Integrate MobileInputControls into Meter

**File:** `frontend/src/features/meter/index.tsx`**Current structure:**

```tsx
<section className="meter">
  <div className="meter__title-container">...</div>
  <div className="meter__display-wrapper">...</div>
  <div className="meter__controls">
    <RotarySwitch />
  </div>
</section>
```

**New structure (mobile/tablet):**

```tsx
<section className="meter">
  <div className="meter__title-container">...</div>
  <div className="meter__display-wrapper">...</div>
  <div className="meter__controls">
    <DetectionModeSwitch value={mode} onChange={setMode} />
    <MobileInputControls 
      detectionMode={mode}
      // ... other props
    />
  </div>
</section>
```

**CSS updates:**

```css
/* Mobile/tablet meter controls */
@media (max-width: 1439px) {
  .meter__controls {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }
}
```

---

# PHASE 2B

### 5. Remove Modal Launcher and MobileInputOverlay

**Files to modify:**

- `frontend/src/features/input/InputContainer.tsx`
- `frontend/src/features/input/components/MobileInputOverlay.tsx` (delete or deprecate)

**Changes to InputContainer:**

- Remove the `MobileInputOverlay` wrapper for mobile
- On mobile/tablet, InputContainer should return `null` or minimal markup
- All input functionality moves to MobileInputControls in the meter
```tsx
// InputContainer.tsx - simplified
const InputContainer = () => {
  const isTablet = useMediaQuery(MEDIA_QUERIES.isTablet)
  
  // On mobile/tablet, input is handled by MobileInputControls in meter
  if (isTablet) {
    return null // Or return just the cable anchor if needed
  }
  
  // Desktop behavior unchanged
  return (
    <section className="input-container">
      {/* ... existing desktop content ... */}
    </section>
  )
}
```


**Dead code removal:**

- Remove `mobile-launcher-portal` div from meter if no longer needed
- Remove or deprecate `MobileInputOverlay.tsx`
- Clean up unused CSS classes (`.audio-recorder__launcher`, etc.)

---

### 6. Remove Routing on Mobile/Tablet

**Files:**

- `frontend/src/features/meter/RouteSync.tsx`
- `frontend/src/App.tsx`

**Current behavior:**

- URL routes control which input mode is shown
- `/getting-started`, `/text`, `/audio` routes

**New behavior:**

- On mobile/tablet: no routing, single page
- On desktop: keep existing routing (unchanged)

**Implementation:**

```tsx
// RouteSync.tsx - make it desktop-only
export function RouteSync() {
  const isTablet = useMediaQuery(MEDIA_QUERIES.isTablet)
  
  // Skip route sync on mobile/tablet
  if (isTablet) return null
  
  // ... existing desktop logic
}
```

**App.tsx updates:**

- Desktop: Routes work as before
- Mobile/tablet: Routes are ignored, meter handles everything

---

### 7. Update WhichInputProvider for Mobile/Tablet

**File:** `frontend/src/features/meter/WhichInputProvider.tsx`The provider needs to work differently on mobile/tablet since there's no routing.**Option A: Separate mobile state**

- Create a new context for mobile detection mode
- Keep WhichInputProvider for desktop compatibility

**Option B: Adapt WhichInputProvider**

- Add a mode that doesn't sync with routes
- Mobile/tablet sets state directly via DetectionModeSwitch

Recommend **Option B** for less code duplication:

```typescript
// Add to WhichInputProvider
const isTablet = useMediaQuery(MEDIA_QUERIES.isTablet)

// In mobile/tablet mode, don't sync with routes
// Just use local state controlled by DetectionModeSwitch
```

---

### 8. Update First Time Overlay

**File:** `frontend/src/features/meter/components/FirstTimeOverlay.tsx`**Current behavior:**

- Points to rotary knob
- Says "Turn the Knob to Start Detecting Sarcasm"

**New behavior (mobile/tablet):**

- Points to detection mode switch
- Updated text: "Flip the Switch to Choose Detection Mode"
- Or could point to text input: "Type something to detect sarcasm"

**Implementation:**

```tsx
const FirstTimeOverlay = () => {
  const isTablet = useMediaQuery(MEDIA_QUERIES.isTablet)
  
  // Different selector for mobile vs desktop
  const targetSelector = isTablet 
    ? '.detection-switch' 
    : '.rotary__knob'
  
  const message = isTablet
    ? 'Flip the Switch to Choose Detection Mode'
    : 'Turn the Knob to Start Detecting Sarcasm'
  
  // ... rest of component
}
```

---

### 9. CSS Updates for Consolidated Layout

**File:** `frontend/src/index.css`Key additions for mobile/tablet:

```css
/* ============================================
   MOBILE INPUT CONTROLS
   ============================================ */
@media (max-width: 1439px) {
  .meter__controls {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem;
    width: 100%;
  }
  
  .mobile-input-controls {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    width: 100%;
    max-width: 400px;
    padding: 0.75rem;
    /* Match meter background */
    background: transparent;
  }
  
  /* Textarea spans full width */
  .mobile-input-controls__textarea {
    grid-column: 1 / -1;
  }
  
  /* Button styling to match meter aesthetic */
  .mobile-input-controls button {
    background: radial-gradient(circle at 35% 35%, #3d3632, #2a2520);
    border: 2px solid rgba(212, 175, 55, 0.3);
    border-radius: 0.5rem;
    color: #d4af37;
    padding: 0.75rem 1rem;
    font-family: 'Playfair Display', Georgia, serif;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .mobile-input-controls button:hover:not(:disabled) {
    filter: brightness(1.1);
    border-color: rgba(212, 175, 55, 0.5);
  }
  
  .mobile-input-controls button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}
```

---

### 10. E2E Test Updates

**Files:**

- `e2e/tests/mobile-audio.spec.ts` - major updates
- `e2e/tests/navigation.spec.ts` - add mobile skip conditions
- Create: `e2e/tests/mobile-detection.spec.ts`

**Test scenarios for mobile/tablet:**

1. **Detection mode switch:**

- Switch defaults to lexical
- Click toggles to prosodic
- Keyboard (Space/Enter) toggles
- Arrow keys work

2. **Lexical mode flow:**

- Text input is enabled
- Audio controls are disabled
- Can type and send text
- Detection result shows on meter

3. **Prosodic mode flow:**

- Audio record button is enabled
- Can record audio
- Can transcribe audio
- Can play/delete audio
- Can send for detection

4. **Info button:**

- Clicking opens getting started modal
- Modal can be closed
- Focus trap works

5. **No routing on mobile:**

- Direct URL navigation doesn't change mode
- Refresh maintains state (or resets to default)

**Example test:**

```typescript
test.describe('Mobile Detection Flow', () => {
  test.use({ viewport: { width: 390, height: 844 } })
  
  test('should switch detection modes', async ({ page }) => {
    await page.goto('/')
    
    // Default is lexical
    const switchEl = page.getByTestId('detection-mode-switch')
    await expect(switchEl).toHaveAttribute('aria-checked', 'false')
    
    // Click to switch to prosodic
    await switchEl.click()
    await expect(switchEl).toHaveAttribute('aria-checked', 'true')
    
    // Audio controls should now be enabled
    const recordBtn = page.getByTestId('record-button')
    await expect(recordBtn).toBeEnabled()
  })
  
  test('lexical mode should disable audio controls', async ({ page }) => {
    await page.goto('/')
    
    const recordBtn = page.getByTestId('record-button')
    await expect(recordBtn).toBeDisabled()
  })
})
```

---

## Implementation Order

1. **Create MobileInputControls component** (new file)

- Build the grid layout
- Add all control buttons with disabled states
- Style to match meter aesthetic

2. **Integrate DetectionModeSwitch into meter**

- Add media query check
- Add detection mode state
- Conditionally render switch vs rotary

3. **Integrate MobileInputControls into meter**

- Add below the switch
- Wire up detection mode
- Test layout

4. **Update InputContainer for mobile**

- Return null on mobile/tablet
- Remove MobileInputOverlay usage

5. **Disable routing on mobile/tablet**

- Update RouteSync
- Test that routes don't affect mobile

6. **Update FirstTimeOverlay**

- New selector for mobile
- Updated message

7. **Clean up dead code**

- Remove unused modal launcher code
- Remove unused CSS

8. **Update E2E tests**

- Update mobile-audio tests
- Add new mobile detection tests
- Verify desktop tests unchanged

---

## Success Criteria

- [ ] DetectionModeSwitch renders on mobile/tablet in meter controls
- [ ] RotarySwitch still renders on desktop (unchanged)
- [ ] MobileInputControls shows all inputs in grid layout
- [ ] Text input always enabled
- [ ] Audio controls disabled in lexical mode, enabled in prosodic
- [ ] Send button works in both modes
- [ ] No modals needed for input on mobile/tablet
- [ ] Info button still opens getting started modal
- [ ] No URL routing on mobile/tablet
- [ ] Desktop routing unchanged
- [ ] All desktop e2e tests pass unchanged
- [ ] New mobile e2e tests pass
- [ ] No horizontal scroll on mobile
- [ ] Everything fits on one screen without scrolling

---

## Risk Areas

1. **State management complexity** - Detection mode needs to coordinate between switch and input controls
2. **Audio recording** - Need to ensure MediaRecorder works when controls are always visible
3. **Layout fitting** - All controls must fit without scrolling on small screens
4. **Transcription flow** - WhisperWorker integration in new component structure

---

## Next Phase Preview

Phase 3 will handle:

- Full-screen meter layout on mobile
- Further layout refinements