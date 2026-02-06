# BurnWare Sound Effects

Place fire-themed sound effect files here.

## Required Sounds

1. **fire-ignite.mp3** - New message notification
   - Sound of fire igniting or crackling
   - ~1-2 seconds
   - Similar to AIM "door open" sound

2. **fire-extinguish.mp3** - Thread burned notification
   - Sound of fire being extinguished (whoosh)
   - ~1-2 seconds
   - Similar to AIM "door close" sound

3. **match-strike.mp3** - New thread created
   - Sound of match being struck
   - ~0.5-1 seconds
   - Similar to AIM "buddy sign on" sound

## Where to Find

**Royalty-Free Sources:**
- Freesound.org
- Pixabay (Audio)
- Zapsplat.com
- YouTube Audio Library

**Search Terms:**
- "fire ignite sound effect"
- "fire extinguish sound"
- "match strike sound"
- "fire crackle"
- "whoosh sound effect"

## Format

- Format: MP3 (best browser support)
- Quality: 128kbps (good balance of quality/size)
- Length: 0.5-2 seconds
- Size: < 100KB per file

## Testing

Test sounds work in the app:
```typescript
import { useAIMSounds } from './hooks/useAIMSounds';

const { playFireIgnite } = useAIMSounds();
playFireIgnite(); // Should play sound
```

## Notes

- Sounds are preloaded on app init for instant playback
- Volume is set to 0.4-0.5 to avoid being jarring
- Users can mute sounds via the sound manager toggle
- On mobile, sounds may require user interaction first
