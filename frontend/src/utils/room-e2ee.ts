/**
 * Room E2EE Module
 * Symmetric group key encryption for multi-party chat rooms.
 * Uses AES-256-GCM for messages and ECDH for key wrapping.
 *
 * Flow:
 * 1. Creator generates AES-256 group key + ECDH key pair
 * 2. Participants generate ECDH key pair, submit public key on join
 * 3. Creator wraps group key with each participant's public key via ECDH
 * 4. All approved participants can decrypt messages using the shared group key
 *
 * Wrapped key format:
 *   V1 (legacy): iv[12] || aes-gcm-ciphertext
 *   V2: version[1] || iv[12] || aes-gcm-ciphertext
 */

import { deriveAESKeyFromECDH } from './crypto-kdf';

const AES_ALGO: AesKeyGenParams = { name: 'AES-GCM', length: 256 };
const ECDH_ALGO: EcKeyGenParams = { name: 'ECDH', namedCurve: 'P-256' };
const IV_LENGTH = 12;
const ROOM_VERSION_V2 = 0x02;
const ROOM_HKDF_INFO = new TextEncoder().encode('burnware-room-e2ee-v2');

function bufferToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function bufferToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  return bytes.buffer;
}

/**
 * Generate a new AES-256 group key for a room.
 * Returns the raw key bytes as base64.
 */
export async function generateGroupKey(): Promise<string> {
  const key = await crypto.subtle.generateKey(AES_ALGO, true, ['encrypt', 'decrypt']);
  const raw = await crypto.subtle.exportKey('raw', key);
  return bufferToBase64(raw);
}

/**
 * Import a raw group key from base64.
 */
export async function importGroupKey(groupKeyBase64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', base64ToBuffer(groupKeyBase64), AES_ALGO, false, [
    'encrypt',
    'decrypt',
  ]);
}

/**
 * Generate an ECDH P-256 key pair for key exchange.
 * Returns public key as base64 (raw format) and private key as JWK.
 */
export async function generateECDHKeyPair(): Promise<{
  publicKeyBase64: string;
  privateKeyJwk: JsonWebKey;
}> {
  const keyPair = await crypto.subtle.generateKey(ECDH_ALGO, true, ['deriveBits', 'deriveKey']);
  const publicKeyRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
  return { publicKeyBase64: bufferToBase64(publicKeyRaw), privateKeyJwk };
}

/**
 * Wrap (encrypt) a group key for a specific recipient using ECDH.
 * Creator uses their private key + recipient's public key to derive an AES key,
 * then encrypts the group key.
 *
 * Returns: base64(version[1] || iv[12] || aes-gcm-ciphertext)
 */
export async function wrapGroupKey(
  groupKeyBase64: string,
  creatorPrivateKeyJwk: JsonWebKey,
  recipientPublicKeyBase64: string,
): Promise<string> {
  // Import keys
  const creatorPriv = await crypto.subtle.importKey('jwk', creatorPrivateKeyJwk, ECDH_ALGO, false, [
    'deriveBits', 'deriveKey',
  ]);
  const recipientPubRaw = base64ToBuffer(recipientPublicKeyBase64);
  const recipientPub = await crypto.subtle.importKey('raw', recipientPubRaw, ECDH_ALGO, false, []);

  // Derive wrapping key via ECDH → HKDF (V2)
  const wrappingKey = await deriveAESKeyFromECDH(
    recipientPub, creatorPriv, ['wrapKey'],
    { useHkdf: true, info: ROOM_HKDF_INFO },
  );

  // Import group key as CryptoKey
  const groupKey = await crypto.subtle.importKey(
    'raw',
    base64ToBuffer(groupKeyBase64),
    AES_ALGO,
    true,
    ['encrypt', 'decrypt'],
  );

  // Wrap with AES-GCM
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const wrapped = await crypto.subtle.wrapKey('raw', groupKey, wrappingKey, { name: 'AES-GCM', iv });

  // Concatenate: version || iv || wrapped
  const result = new Uint8Array(1 + IV_LENGTH + wrapped.byteLength);
  result[0] = ROOM_VERSION_V2;
  result.set(iv, 1);
  result.set(new Uint8Array(wrapped), 1 + IV_LENGTH);

  return bufferToBase64(result.buffer);
}

/**
 * Unwrap (decrypt) a group key using ECDH.
 * Participant uses their private key + room's public key to derive an AES key,
 * then decrypts the wrapped group key.
 */
export async function unwrapGroupKey(
  wrappedKeyBase64: string,
  participantPrivateKeyJwk: JsonWebKey,
  roomPublicKeyBase64: string,
): Promise<string> {
  const wrapped = new Uint8Array(base64ToBuffer(wrappedKeyBase64));

  // Detect version: V2 has version byte prefix, V1 (legacy) starts directly with IV
  const isV2 = wrapped[0] === ROOM_VERSION_V2;
  const offset = isV2 ? 1 : 0;
  const iv = wrapped.slice(offset, offset + IV_LENGTH);
  const ct = wrapped.slice(offset + IV_LENGTH);

  // Import keys
  const participantPriv = await crypto.subtle.importKey(
    'jwk',
    participantPrivateKeyJwk,
    ECDH_ALGO,
    false,
    ['deriveBits', 'deriveKey'],
  );
  const roomPubRaw = base64ToBuffer(roomPublicKeyBase64);
  const roomPub = await crypto.subtle.importKey('raw', roomPubRaw, ECDH_ALGO, false, []);

  // Derive wrapping key: V2 uses HKDF, V1 uses direct ECDH (legacy)
  const wrappingKey = await deriveAESKeyFromECDH(
    roomPub, participantPriv, ['unwrapKey'],
    { useHkdf: isV2, info: ROOM_HKDF_INFO },
  );

  // Unwrap group key
  const groupKey = await crypto.subtle.unwrapKey(
    'raw',
    ct,
    wrappingKey,
    { name: 'AES-GCM', iv },
    AES_ALGO,
    true,
    ['encrypt', 'decrypt'],
  );

  const raw = await crypto.subtle.exportKey('raw', groupKey);
  return bufferToBase64(raw);
}

/**
 * Encrypt a message with the group key (AES-256-GCM).
 * Returns ciphertext (base64) and nonce (hex).
 */
export async function encryptGroupMessage(
  plaintext: string,
  groupKeyBase64: string,
): Promise<{ ciphertext: string; nonce: string }> {
  const groupKey = await importGroupKey(groupKeyBase64);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ptBytes = new TextEncoder().encode(plaintext);

  const ctBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, groupKey, ptBytes);

  return {
    ciphertext: bufferToBase64(ctBuf),
    nonce: bufferToHex(iv.buffer),
  };
}

/**
 * Decrypt a message with the group key (AES-256-GCM).
 */
export async function decryptGroupMessage(
  ciphertextBase64: string,
  nonceHex: string,
  groupKeyBase64: string,
): Promise<string> {
  const groupKey = await importGroupKey(groupKeyBase64);
  const iv = new Uint8Array(hexToBuffer(nonceHex));
  const ct = new Uint8Array(base64ToBuffer(ciphertextBase64));

  const ptBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, groupKey, ct);
  return new TextDecoder().decode(ptBuf);
}
