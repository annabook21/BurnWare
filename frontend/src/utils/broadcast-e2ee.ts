/**
 * Broadcast E2EE Module
 * Symmetric AES-256-GCM encryption for broadcast channels.
 * Key is shared via URL fragment (never sent to server).
 *
 * Ciphertext format (binary, then base64-encoded):
 *   version[1] || iv[12] || aes-gcm-ciphertext+tag[...]
 *
 * V1 (0x01): AES-256-GCM with random IV
 */

const VERSION = 0x01;
const IV_LENGTH = 12;
const KEY_LENGTH = 32; // 256 bits

// Base64url encoding (URL-safe, no padding)
function bufferToBase64Url(buf: ArrayBuffer): string {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBuffer(b64url: string): ArrayBuffer {
  // Convert base64url to standard base64
  let base64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  while (base64.length % 4) base64 += '=';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/**
 * Generate a random AES-256 key for a broadcast channel.
 * Returns the key as a base64url string (safe for URL fragments).
 */
export async function generateBroadcastKey(): Promise<string> {
  const keyBytes = crypto.getRandomValues(new Uint8Array(KEY_LENGTH));
  return bufferToBase64Url(keyBytes.buffer);
}

/**
 * Import a base64url key string as a CryptoKey for encryption/decryption.
 */
async function importKey(keyBase64Url: string, usage: KeyUsage[]): Promise<CryptoKey> {
  const keyBytes = base64UrlToBuffer(keyBase64Url);
  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM', length: 256 },
    false,
    usage
  );
}

/**
 * Encrypt plaintext for a broadcast channel.
 * Returns ciphertext as base64 (standard, for JSON storage).
 */
export async function encryptBroadcast(
  plaintext: string,
  keyBase64Url: string
): Promise<string> {
  const aesKey = await importKey(keyBase64Url, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ptBytes = new TextEncoder().encode(plaintext);
  const ctBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, ptBytes);

  // Build blob: version || iv || ct+tag
  const blob = new Uint8Array(1 + IV_LENGTH + ctBuf.byteLength);
  blob[0] = VERSION;
  blob.set(iv, 1);
  blob.set(new Uint8Array(ctBuf), 1 + IV_LENGTH);

  // Return as standard base64 for JSON storage
  return btoa(String.fromCharCode(...blob));
}

/**
 * Decrypt ciphertext from a broadcast channel.
 * Returns plaintext string.
 * Throws on decryption failure.
 */
export async function decryptBroadcast(
  ciphertextBase64: string,
  keyBase64Url: string
): Promise<string> {
  const blob = new Uint8Array(
    Uint8Array.from(atob(ciphertextBase64), (c) => c.charCodeAt(0)).buffer
  );

  const version = blob[0];
  if (version !== VERSION) throw new Error('Unknown broadcast encryption version');
  if (blob.length < 1 + IV_LENGTH + 1) throw new Error('Ciphertext too short');

  const iv = blob.slice(1, 1 + IV_LENGTH);
  const ct = blob.slice(1 + IV_LENGTH);

  const aesKey = await importKey(keyBase64Url, ['decrypt']);
  const ptBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ct);
  return new TextDecoder().decode(ptBuf);
}

/**
 * Extract encryption key from URL fragment.
 * Returns null if no fragment or empty fragment.
 */
export function extractKeyFromFragment(): string | null {
  const hash = window.location.hash;
  if (!hash || hash === '#') return null;
  return hash.slice(1); // Remove leading '#'
}
