# BurnWare Frontend Assets

## Logo Files

**Main Logo:** `public/burnware-logo.png`
- Your custom BurnWare flame logo
- Used throughout the AIM-styled interface
- Replaces the classic AIM "yellow running man"

**Usage:**
- Buddy list header (32x32px)
- Login screen (128x128px)
- Favicon (16x16px, 32x32px)
- Window icons (16x16px)

## Sound Effects Needed

Location: `public/sounds/`

**Required Sounds:**
1. `fire-ignite.mp3` - New message arrives (fire crackle sound)
2. `fire-extinguish.mp3` - Thread burned (whoosh/extinguish sound)
3. `match-strike.mp3` - New thread created (match lighting)
4. `message-ding.mp3` - Optional classic IM notification

**Where to Find:**
- Freesound.org (royalty-free)
- Pixabay (royalty-free sounds)
- Create custom with audio editing software
- Keep files under 100KB each

**Format:** MP3 or OGG (browser compatible)

## Icons & Emojis

**Status Indicators:**
- 🔥 Active link (fire emoji)
- 💨 Expired/burned (smoke emoji)
- 🔔 New messages badge
- ⚠️ Warning (burn confirmation)

**Action Icons:**
- 🔥 Burn button
- ✨ Create new link
- 📋 Copy link
- 📱 Show QR code

## Desktop Background

**Classic AIM Style:**
- Teal color: #008080 (Windows 98 default desktop)
- Or custom: Gradient with fire theme
- Keep it subtle so windows stand out

## Future Assets (Optional)

- Custom cursor (pointer with fire trail on hover)
- Loading spinner (flame animation)
- Error icon (🔥 with X)
- Success icon (🔥 with checkmark)

## Asset Optimization

All assets should be:
- Compressed for web delivery
- Lazy loaded where possible
- Cached appropriately (CloudFront)
- Sized correctly for usage

**CloudFront Cache Headers:**
- Logo: `Cache-Control: public, max-age=31536000` (1 year)
- Sounds: `Cache-Control: public, max-age=2592000` (30 days)
