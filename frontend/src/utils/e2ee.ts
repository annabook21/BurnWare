/**
 * E2EE Module
 * ECDH P-256 key agreement + AES-256-GCM encryption using Web Crypto API.
 * No external dependencies.
 *
 * Ciphertext format (binary, then base64-encoded):
 *   0x01 || ephemeralPublicKey[65] || iv[12] || aes-gcm-ciphertext+tag[...]
 *
 * File size: ~190 lines
 */

const ECDH_ALGO: EcKeyGenParams = { name: 'ECDH', namedCurve: 'P-256' };
const AES_ALGO: AesKeyGenParams = { name: 'AES-GCM', length: 256 };
const VERSION = 0x01;
const EPK_LENGTH = 65; // P-256 uncompressed raw public key
const IV_LENGTH = 12;
const PBKDF2_ITERATIONS = 600_000;

function bufferToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/**
 * Generate an ECDH P-256 key pair.
 * Returns the public key as base64 (raw format) and the private key as JWK.
 */
export async function generateKeyPair(): Promise<{
  publicKeyBase64: string;
  privateKeyJwk: JsonWebKey;
}> {
  const keyPair = await crypto.subtle.generateKey(ECDH_ALGO, true, ['deriveKey']);
  const publicKeyRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
  return { publicKeyBase64: bufferToBase64(publicKeyRaw), privateKeyJwk };
}

/**
 * Encrypt plaintext for a recipient.
 * Generates a fresh ephemeral key pair; ECDH(ephemeral, recipientPub) → AES key → encrypt.
 * Returns ciphertext blob (base64) and the ephemeral public key + private key.
 */
export async function encrypt(
  plaintext: string,
  recipientPublicKeyBase64: string,
): Promise<{
  ciphertext: string;
  ephemeralPublicKeyBase64: string;
  ephemeralPrivateKeyJwk: JsonWebKey;
}> {
  // Generate ephemeral key pair
  const ephemeral = await crypto.subtle.generateKey(ECDH_ALGO, true, ['deriveKey']);

  // Import recipient public key
  const recipientPubRaw = base64ToBuffer(recipientPublicKeyBase64);
  const recipientPubKey = await crypto.subtle.importKey('raw', recipientPubRaw, ECDH_ALGO, false, []);

  // Derive AES-256-GCM key via ECDH
  const aesKey = await crypto.subtle.deriveKey(
    { name: 'ECDH', public: recipientPubKey },
    ephemeral.privateKey,
    AES_ALGO,
    false,
    ['encrypt'],
  );

  // Encrypt
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ptBytes = new TextEncoder().encode(plaintext);
  const ctBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, ptBytes);

  // Export ephemeral public key (raw)
  const epkRaw = new Uint8Array(await crypto.subtle.exportKey('raw', ephemeral.publicKey));
  const epkJwk = await crypto.subtle.exportKey('jwk', ephemeral.privateKey);

  // Build blob: version || epk || iv || ct+tag
  const blob = new Uint8Array(1 + EPK_LENGTH + IV_LENGTH + ctBuf.byteLength);
  blob[0] = VERSION;
  blob.set(epkRaw, 1);
  blob.set(iv, 1 + EPK_LENGTH);
  blob.set(new Uint8Array(ctBuf), 1 + EPK_LENGTH + IV_LENGTH);

  return {
    ciphertext: bufferToBase64(blob.buffer),
    ephemeralPublicKeyBase64: bufferToBase64(epkRaw.buffer),
    ephemeralPrivateKeyJwk: epkJwk,
  };
}

/**
 * Decrypt a ciphertext blob using the recipient's private key.
 * Parses ephemeral public key from the blob; ECDH(myPriv, ephemeralPub) → AES key → decrypt.
 */
export async function decrypt(
  ciphertextBase64: string,
  privateKeyJwk: JsonWebKey,
): Promise<string> {
  const blob = new Uint8Array(base64ToBuffer(ciphertextBase64));

  if (blob[0] !== VERSION) throw new Error('Unknown E2EE version');
  if (blob.length < 1 + EPK_LENGTH + IV_LENGTH + 1) throw new Error('Ciphertext too short');

  const epkRaw = blob.slice(1, 1 + EPK_LENGTH);
  const iv = blob.slice(1 + EPK_LENGTH, 1 + EPK_LENGTH + IV_LENGTH);
  const ct = blob.slice(1 + EPK_LENGTH + IV_LENGTH);

  // Import keys
  const epk = await crypto.subtle.importKey('raw', epkRaw, ECDH_ALGO, false, []);
  const myPriv = await crypto.subtle.importKey('jwk', privateKeyJwk, ECDH_ALGO, false, ['deriveKey']);

  // Derive same AES key
  const aesKey = await crypto.subtle.deriveKey(
    { name: 'ECDH', public: epk },
    myPriv,
    AES_ALGO,
    false,
    ['decrypt'],
  );

  const ptBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ct);
  return new TextDecoder().decode(ptBuf);
}

// ── Key backup: passphrase-based wrapping (PBKDF2 + AES-256-GCM) ──

function hexToBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  return bytes.buffer;
}

function bufferToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function deriveWrappingKey(
  passphrase: string,
  salt: Uint8Array,
  usage: KeyUsage[],
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    AES_ALGO,
    false,
    usage,
  );
}

/**
 * Wrap (encrypt) an ECDH private key with a user passphrase.
 * PBKDF2(passphrase, salt, 600k iter) → AES-256-GCM wrapKey.
 * Returns base64(wrappedKey), hex(salt), hex(iv).
 */
export async function wrapPrivateKey(
  privateKeyJwk: JsonWebKey,
  passphrase: string,
): Promise<{ wrappedKey: string; salt: string; iv: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const wrappingKey = await deriveWrappingKey(passphrase, salt, ['wrapKey']);

  const ecPriv = await crypto.subtle.importKey('jwk', privateKeyJwk, ECDH_ALGO, true, ['deriveKey']);
  const wrapped = await crypto.subtle.wrapKey('jwk', ecPriv, wrappingKey, { name: 'AES-GCM', iv });

  return {
    wrappedKey: bufferToBase64(wrapped),
    salt: bufferToHex(salt.buffer),
    iv: bufferToHex(iv.buffer),
  };
}

/**
 * Unwrap (decrypt) an ECDH private key using a user passphrase.
 * Returns the private key as JWK.
 */
export async function unwrapPrivateKey(
  wrappedKeyBase64: string,
  passphrase: string,
  saltHex: string,
  ivHex: string,
): Promise<JsonWebKey> {
  const salt = new Uint8Array(hexToBuffer(saltHex));
  const iv = new Uint8Array(hexToBuffer(ivHex));
  const wrappingKey = await deriveWrappingKey(passphrase, salt, ['unwrapKey']);

  const ecPriv = await crypto.subtle.unwrapKey(
    'jwk',
    base64ToBuffer(wrappedKeyBase64),
    wrappingKey,
    { name: 'AES-GCM', iv },
    ECDH_ALGO,
    true,
    ['deriveKey'],
  );

  return crypto.subtle.exportKey('jwk', ecPriv);
}
