# Mobile Development Testing Guide

This guide explains how to test the Sarcasm Detector app on actual mobile devices during development. Mobile testing is critical because prosodic sarcasm detection is the app's core feature, and mobile browsers have specific requirements for microphone access.

## Why Mobile Testing is Essential

1. **Prosodic Detection is Primary Use Case**: The app analyzes *how* you say things, not just what you say
2. **Real Network Conditions**: Model download performance varies significantly on mobile networks (3G/4G/WiFi)
3. **Mobile-Specific Behavior**: Touch interactions, screen sizes, and performance characteristics differ from desktop
4. **Microphone API Differences**: Mobile browsers have stricter security requirements

## The HTTPS Requirement

**Critical:** Mobile browsers (especially iOS Safari) require HTTPS to access the microphone. The dev server runs on HTTP by default, so you need an HTTPS tunnel.

```
Without HTTPS:
❌ getUserMedia() → NotAllowedError: Microphone access denied

With HTTPS:
✅ getUserMedia() → Success
```

## Testing Options

### Option A: LocalTunnel (Recommended for Quick Testing)

**Best for:** Quick iteration, no setup required

```bash
# Terminal 1: Start dev server
cd frontend
npm run dev

# Terminal 2: Create HTTPS tunnel
npm run tunnel
# Alternative: npx localtunnel --port 5173

# Output example:
# your url is: https://random-name-1234.loca.lt
```

Then open `https://random-name-1234.loca.lt` on your phone.

**Pros:**
- ✅ Zero configuration
- ✅ Works immediately
- ✅ Free
- ✅ No account required

**Cons:**
- ❌ Random URL changes on every restart
- ❌ May show bypass warning on first visit (click "Continue")
- ❌ Potential rate limits during heavy use

**First-time use:**
1. LocalTunnel may show a warning page on first visit
2. Click "Continue" to proceed to your app
3. Grant microphone permissions when prompted

### Option B: ngrok (Recommended for Extended Testing)

**Best for:** Longer testing sessions, consistent URLs, better performance

**Setup (one-time):**

```bash
# Install ngrok
brew install ngrok  # macOS
# or
npm install -g ngrok  # Cross-platform

# (Optional) Sign up for free account at https://ngrok.com
# Free account provides persistent URLs that don't change
ngrok config add-authtoken YOUR_TOKEN
```

**Usage:**

```bash
# Terminal 1: Start dev server
cd frontend
npm run dev

# Terminal 2: Create tunnel
npm run tunnel:ngrok
# Alternative: ngrok http 5173

# Output example:
# Forwarding https://abc123.ngrok-free.app -> http://localhost:5173
```

Open the `https://abc123.ngrok-free.app` URL on your phone.

**Pros:**
- ✅ Stable URLs (with free account)
- ✅ Better performance than LocalTunnel
- ✅ Built-in request inspector UI (http://localhost:4040)
- ✅ Can replay requests for debugging
- ✅ Shows real-time traffic

**Cons:**
- ❌ Requires installation
- ❌ May show interstitial page on ngrok free tier (click "Visit Site")

**ngrok Inspector:**
While testing, visit http://localhost:4040 on your computer to see:
- All HTTP requests/responses
- Request headers and body
- Response times
- Ability to replay requests

### Option C: Local Network (No HTTPS - Limited Testing)

**Best for:** Testing non-microphone features only

```bash
# Start dev server with network access
cd frontend
npm run dev:mobile
# Alternative: npm run dev -- --host

# Find your computer's IP address:
# macOS/Linux: ifconfig | grep "inet "
# Windows: ipconfig

# Example output:
# inet 192.168.1.100 netmask 0xffffff00 broadcast 192.168.1.255

# Access from phone: http://192.168.1.100:5173
```

⚠️ **Warning:** **Microphone will NOT work** on iOS/Safari without HTTPS. Use Option A or B for prosodic detection testing.

**When to use this:**
- Testing visual layout and UI
- Testing text input (lexical detection only)
- Testing touch interactions
- Quick checks that don't require audio

## Testing Workflow

### 1. Setup Tunnel

Choose Option A (LocalTunnel) or Option B (ngrok) and start the tunnel.

### 2. Open App on Mobile

1. Open the tunnel URL in your mobile browser
2. Bookmark it for quick access
3. Grant microphone permissions when prompted

**Permissions Troubleshooting:**
- If permissions dialog doesn't appear, check browser settings
- iOS: Settings → Safari → Microphone → Allow
- Android: Chrome → Settings → Site Settings → Microphone → Allow

### 3. Test Model Selector (Dev Mode Only)

The model selector appears in the bottom-left corner in dev mode:

1. You'll see: "🛠️ Dev: Model Override"
2. Select different models: Tiny or Base
3. Page automatically reloads to apply the change
4. Test each model with real mobile network conditions

**What to test:**
- Model download time on your mobile connection
- Transcription accuracy for sarcastic phrases
- App responsiveness during model loading
- Battery/heat impact (iOS especially)

### 4. Test Prosodic Detection

1. Switch to Audio input mode
2. Press and hold the record button
3. Say something sarcastic (e.g., "Oh great, *another* meeting")
4. Release the button
5. Check the detection result

**Test phrases:**
- "Yeah, *that's* what I needed today" (high sarcasm)
- "Thank you so much for that" (medium sarcasm)
- "The weather is nice" (low sarcasm)

### 5. Check Telemetry

Open browser console on your phone:
- iOS Safari: Settings → Safari → Advanced → Web Inspector (requires Mac)
- Android Chrome: chrome://inspect (requires computer with Chrome)

Or check on desktop:
1. Keep the tunnel running
2. Switch back to desktop browser
3. Open `http://localhost:5173` (or your tunnel URL)
4. Open console: `window.viewMoonshineMetrics()`
5. Review metrics table

**Metrics to review:**
- Model load times across different models
- Cache hit rate (second page load should be instant)
- Network speed estimates
- Transcription success rates

### 6. Test Different Network Conditions

**Simulate different connections:**

On iOS:
- Settings → Developer → Network Link Conditioner
- Enable and select: "3G", "4G", "WiFi", etc.

On Android:
- Developer Options → Networking → Mobile data always active
- Use "Network speed" simulator apps

**Test scenarios:**
- **WiFi → 4G transition**: Switch networks mid-test
- **Slow 3G**: Test tiny vs base model load times
- **Fast WiFi**: Verify base model loads reasonably
- **Airplane mode → Online**: Test offline error handling

## Common Issues and Solutions

### Issue: Microphone Permission Denied

**Symptoms:** Error message "Microphone access denied"

**Solutions:**
1. Ensure you're using HTTPS (tunnel URL, not http://IP)
2. Check browser permissions in phone settings
3. Try in different browser (Safari vs Chrome on iOS)
4. Clear site data and try again

### Issue: "This site can't be reached"

**Symptoms:** Can't access tunnel URL from phone

**Solutions:**
1. Verify tunnel is still running in Terminal
2. Check tunnel URL matches exactly (including https://)
3. Try different WiFi network (some block tunneling services)
4. For LocalTunnel: Wait a moment and refresh (startup delay)

### Issue: Model Never Loads

**Symptoms:** Stuck on "Loading model..." forever

**Solutions:**
1. Check browser console for errors
2. Verify CDN is accessible (try https://download.moonshine.ai/ in browser)
3. Check if your network blocks ONNX files
4. Try different model (tiny loads faster, good for debugging)
5. Clear browser cache and reload

### Issue: Tunnel Shows Warning Page

**Symptoms:** LocalTunnel or ngrok shows interstitial/warning page

**Solutions:**
- **LocalTunnel**: Click "Continue" button
- **ngrok free tier**: Click "Visit Site" button
- Both are normal security features, not errors

### Issue: Poor Transcription Quality

**Symptoms:** Speech not recognized accurately

**Solutions:**
1. Switch to base model (better accuracy)
2. Speak clearly and pause between phrases
3. Reduce background noise
4. Check if microphone is working (test with voice memos app)
5. Try different phrases (avoid very long sentences)

## Performance Benchmarks

Expected model download times on mobile:

| Network | tiny (190MB) | base (400MB) |
|---------|--------------|--------------|
| **3G Mobile** | ~8 minutes | ~18 minutes |
| **4G Mobile** | ~76 seconds | ~2.7 minutes |
| **WiFi (Average)** | ~30 seconds | ~64 seconds |

**After first load:** All models load instantly from cache. Models remain cached across app redeployments - only re-download when switching to a different model.

## Best Practices

1. **Start with WiFi**: Test initial functionality on WiFi before trying mobile networks
2. **Bookmark tunnel URL**: Save time by bookmarking the URL (even if it changes, you can update it)
3. **Keep tunnel running**: Don't restart tunnel unless necessary (lose connection history)
4. **Test incrementally**: Test one feature at a time rather than everything at once
5. **Use base model first**: Get accuracy working before optimizing for speed
6. **Document issues**: Note any mobile-specific bugs for later fixing
7. **Test on multiple devices**: iOS and Android behave differently

## Advanced: Testing with Real Users

For beta testing with real users outside your network:

1. **ngrok with custom subdomain** (requires paid plan):
   ```bash
   ngrok http --subdomain=sarcasm-detector-beta 5173
   # URL: https://sarcasm-detector-beta.ngrok-free.app
   ```

2. **Share URL carefully**: Tunnel exposes your local dev server
3. **Monitor traffic**: Use ngrok inspector to watch requests
4. **Set time limits**: Tunnels shouldn't run indefinitely

## Debugging Tools

### On Device

**iOS Safari Developer Tools:**
1. Connect iPhone to Mac via cable
2. On Mac: Safari → Develop → [Your iPhone] → [Page]
3. Full console access, DOM inspection, network tab

**Android Chrome DevTools:**
1. Connect Android to computer via cable
2. Enable USB debugging in Developer Options
3. On computer: Chrome → chrome://inspect
4. Click "Inspect" under your device

### Network Analysis

Use browser DevTools Network tab to inspect:
- Model file download progress
- CDN response times
- Failed requests
- Caching behavior

### Console Debugging

Useful dev mode commands:
```javascript
// View all collected metrics
window.viewMoonshineMetrics()

// Clear metrics
window.clearMoonshineMetrics()

// Check current model
localStorage.getItem('moonshine_model_override')

// Force different model
localStorage.setItem('moonshine_model_override', 'model/base')
location.reload()
```

## Additional Resources

- [Moonshine Models Documentation](docs/MOONSHINE_MODELS.md)
- [Main README](../README.md)
- [ngrok Documentation](https://ngrok.com/docs)
- [LocalTunnel Documentation](https://github.com/localtunnel/localtunnel)
- [Web Speech API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)

## Need Help?

If you encounter issues not covered here:
1. Check browser console for specific error messages
2. Verify all prerequisites are met (HTTPS, permissions, etc.)
3. Try the simplest option first (LocalTunnel with WiFi)
4. Test on desktop first to isolate mobile-specific issues
5. Document the issue with screenshots and console logs

---

**Remember:** Mobile testing takes more setup than desktop, but it's essential for a prosodic detection app. The extra effort ensures your users have a great experience!
