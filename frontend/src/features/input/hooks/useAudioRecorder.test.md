# useAudioRecorder Test Coverage

## Overview

Comprehensive test suite for the `useAudioRecorder` hook, covering critical auto-stop countdown and silence detection features.

## Test Coverage (15 tests total)

### Silence Detection and Auto-Stop (6 tests)
✅ Initialization with no countdown
✅ No countdown display on recording start
✅ Countdown appears when silence reaches threshold
✅ Auto-stop triggers after silence threshold exceeded
✅ Silence timer resets on transcript updates
✅ Countdown clears when speech resumes

### speechStatus Integration (3 tests)
✅ Silence timer pauses when `speechStatus='loading'`
✅ Timer resets and resumes when transitioning from loading to listening
✅ Countdown display clears during loading status

### Countdown Display Logic (3 tests)
✅ No countdown before countdown threshold
✅ Countdown shows decreasing values
✅ Countdown stops when recording ends

### Edge Cases (3 tests)
✅ Handles rapid transcript updates without breaking timer
✅ Handles component unmount during silence detection
✅ Handles status transitions (loading → error)

## Key Features Tested

### Auto-Stop Countdown Logic
- **Countdown Threshold**: `AUTO_STOP_COUNTDOWN_START_MS` (3 seconds before auto-stop)
- **Silence Threshold**: `AUTO_STOP_SILENCE_THRESHOLD_MS` (4 seconds of silence)
- **Display Behavior**: Countdown appears in last 3 seconds, showing decreasing time

### Silence Detection Timer
- Tracks time since last transcript update
- Resets on every transcript update (interim or final)
- Triggers auto-stop when threshold exceeded
- Runs on 100ms interval for smooth countdown

### speechStatus='loading' Behavior
- **Critical Feature**: Timer pauses during `speechStatus='loading'`
- **Rationale**: Prevents premature auto-stop while speech recognition initializes
- **Implementation**: Continuously resets `lastTranscriptUpdateRef` during loading
- **Effect**: Recording can wait indefinitely for model/VAD initialization

### Timer Reset on Status Transitions
- When transitioning from `loading` to any other status, timer resets
- Prevents accumulated "silence" time during loading from triggering auto-stop
- Ensures fair countdown starts only after speech recognition is ready

## Test Infrastructure

### Mocking Strategy
- **MediaRecorder**: Full mock with event handlers
- **MediaStream**: Mock with audio tracks
- **getUserMedia**: Mock promise resolution
- **performance.now()**: Controllable mock for precise timing tests
- **Timers**: Fake timers (vitest) for deterministic behavior

### Timing Control
Tests use `vi.useFakeTimers()` and custom `mockPerformanceNow()` to:
- Control elapsed time precisely
- Test countdown thresholds
- Verify auto-stop triggers
- Simulate various timing scenarios

## Running Tests

```bash
# Run useAudioRecorder tests only
npm test -- useAudioRecorder.test.ts

# Run with coverage
npm test -- useAudioRecorder.test.ts --coverage

# Run in watch mode during development
npm test -- useAudioRecorder.test.ts --watch
```

## Maintenance Notes

### When to Update Tests

1. **Constant Changes**: If `AUTO_STOP_SILENCE_THRESHOLD_MS` or `AUTO_STOP_COUNTDOWN_START_MS` change, update test timing values
2. **New speechStatus Values**: Add tests for new status values if added to the `SpeechStatus` type
3. **Timer Logic Changes**: If silence detection or countdown logic changes, review timing test assertions
4. **New Auto-Stop Behaviors**: Add tests for any new auto-stop triggers or conditions

### Known Limitations

- Tests don't verify audio recording quality (mocked MediaRecorder)
- Waveform visualization not tested (requires canvas mocking)
- Speech recognition integration tested via mocks (not actual engines)
- Timer precision limited to 100ms intervals (matches production behavior)

## Related Files

- **Implementation**: `useAudioRecorder.ts`
- **Constants**: `constants.ts` (AUTO_STOP_* values)
- **Types**: Defined in `useAudioRecorder.ts`
- **E2E Tests**: See `e2e/tests/audio-recording.spec.ts` for integration tests
