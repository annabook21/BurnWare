/**
 * Watermark Utility
 * Invisible per-user watermarking for anti-leak protection.
 * Uses zero-width characters to embed a unique watermark based on user's seed.
 */

// Zero-width characters for steganographic watermarking
const ZW_CHARS = [
  '\u200B', // Zero Width Space
  '\u200C', // Zero Width Non-Joiner
  '\u200D', // Zero Width Joiner
  '\uFEFF', // Zero Width No-Break Space
];

/**
 * Generate a deterministic watermark sequence from a seed.
 * Returns a sequence of zero-width characters that uniquely identifies the user.
 */
function generateWatermarkSequence(seed: string, length: number = 16): string {
  // Simple deterministic hash-based sequence
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }

  let sequence = '';
  for (let i = 0; i < length; i++) {
    // Use different parts of hash for each character
    const idx = Math.abs((hash >> (i % 32)) ^ (hash >> ((i + 7) % 32))) % ZW_CHARS.length;
    sequence += ZW_CHARS[idx];
    // Rotate hash for next iteration
    hash = ((hash << 7) | (hash >>> 25)) ^ (i * 31);
  }

  return sequence;
}

/**
 * Embed an invisible watermark into text.
 * Inserts zero-width characters between regular characters.
 *
 * @param text - The visible text to watermark
 * @param watermarkSeed - The per-user seed to generate watermark
 * @returns Text with embedded watermark
 */
export function embedWatermark(text: string, watermarkSeed: string): string {
  const watermark = generateWatermarkSequence(watermarkSeed);

  // Insert watermark characters periodically throughout the text
  let result = '';
  let wmIdx = 0;

  for (let i = 0; i < text.length; i++) {
    result += text[i];
    // Insert watermark character every 8-12 characters (varies based on position)
    const interval = 8 + (i % 5);
    if ((i + 1) % interval === 0 && wmIdx < watermark.length) {
      result += watermark[wmIdx];
      wmIdx++;
    }
  }

  // Append remaining watermark at end if text is short
  if (wmIdx < watermark.length) {
    result += watermark.slice(wmIdx);
  }

  return result;
}

/**
 * Remove watermark characters from text.
 * Strips all zero-width characters.
 *
 * @param text - Text potentially containing watermark
 * @returns Clean text without watermark
 */
export function stripWatermark(text: string): string {
  const zwRegex = new RegExp(`[${ZW_CHARS.join('')}]`, 'g');
  return text.replace(zwRegex, '');
}

/**
 * Extract watermark sequence from text for analysis/tracing.
 *
 * @param text - Text containing watermark
 * @returns The extracted zero-width character sequence
 */
export function extractWatermark(text: string): string {
  const zwRegex = new RegExp(`[${ZW_CHARS.join('')}]`, 'g');
  return (text.match(zwRegex) || []).join('');
}

/**
 * Check if a watermark matches a given seed.
 * Useful for leak tracing - if leaked text surfaces, can identify source.
 *
 * @param extractedWatermark - Watermark extracted from leaked text
 * @param seed - The seed to check against
 * @returns True if the watermark matches the seed
 */
export function matchWatermark(extractedWatermark: string, seed: string): boolean {
  const expected = generateWatermarkSequence(seed, extractedWatermark.length);
  return extractedWatermark === expected;
}
