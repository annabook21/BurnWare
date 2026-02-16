/**
 * Key Vault
 * Encrypts private keys at rest in IndexedDB using a PBKDF2-derived vault key.
 * The vault passphrase is the same as the backup recovery passphrase.
 *
 * Session persistence: After unlock, the vault key is split (XOR) and stored
 * in sessionStorage + window.name so it survives page refresh but not tab close.
 * Pattern follows ProtonMail-style key splitting (see e.g. francoisbest.com/posts/2019
 * how-to-store-e2ee-keys-in-the-browser). No re-prompt on refresh.
 */

const AES_ALGO: AesKeyGenParams = { name: 'AES-GCM', length: 256 };
const VAULT_ITERATIONS = 600_000;
const IV_LENGTH = 12;
const VERIFICATION_PLAINTEXT = 'burnware-vault-ok';

const DB_NAME = 'burnware-keys';
const VAULT_META_STORE = 'vaultMeta';
const VAULT_SALT_KEY = 'salt';
const VAULT_VERIFY_KEY = 'verifyToken';

const SESSION_PART_A_KEY = 'bw:vault-session-a';
const WINDOW_NAME_PREFIX = 'bw_vault|';

/** In-memory vault key. Restored from session split on load when possible. */
let vaultKey: CryptoKey | null = null;

// ── IndexedDB helpers (minimal, vault-specific) ──

function openVaultDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 4);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('linkKeys')) db.createObjectStore('linkKeys');
      if (!db.objectStoreNames.contains('replyCache')) db.createObjectStore('replyCache');
      if (!db.objectStoreNames.contains('roomKeys')) db.createObjectStore('roomKeys');
      if (!db.objectStoreNames.contains(VAULT_META_STORE)) db.createObjectStore(VAULT_META_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function vaultMetaGet<T>(key: string): Promise<T | undefined> {
  const db = await openVaultDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_META_STORE, 'readonly');
    const req = tx.objectStore(VAULT_META_STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function vaultMetaPut(key: string, value: unknown): Promise<void> {
  const db = await openVaultDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_META_STORE, 'readwrite');
    tx.objectStore(VAULT_META_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Key derivation ──

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

/** Extractable so we can export for session split (survive refresh). */
async function deriveVaultKey(passphrase: string, salt: Uint8Array, usages: KeyUsage[]): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: VAULT_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    AES_ALGO,
    true,
    usages,
  );
}

// ── Public API ──

/** Check if a vault has been configured (salt exists in IndexedDB). */
export async function isVaultConfigured(): Promise<boolean> {
  const salt = await vaultMetaGet<string>(VAULT_SALT_KEY);
  return salt !== undefined;
}

/** Check if the vault is currently unlocked (key in memory). */
export function isVaultUnlocked(): boolean {
  return vaultKey !== null;
}

/** Clear the in-memory vault key and session persistence. */
export function lockVault(): void {
  vaultKey = null;
  try {
    sessionStorage.removeItem(SESSION_PART_A_KEY);
    if (typeof window !== 'undefined' && window.name.startsWith(WINDOW_NAME_PREFIX)) {
      window.name = '';
    }
  } catch {
    // ignore
  }
}

/** Restore vault key from session split (sessionStorage + window.name). Survives refresh, not tab close. */
export async function tryRestoreVaultFromSession(): Promise<boolean> {
  if (vaultKey !== null) return true;
  try {
    const partAEnc = sessionStorage.getItem(SESSION_PART_A_KEY);
    const wn = typeof window !== 'undefined' ? window.name : '';
    if (!partAEnc || !wn.startsWith(WINDOW_NAME_PREFIX)) return false;
    const partBEnc = wn.slice(WINDOW_NAME_PREFIX.length);
    const partA = base64ToBytes(partAEnc);
    const partB = base64ToBytes(partBEnc);
    if (partA.length !== 32 || partB.length !== 32) return false;
    const keyBytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) keyBytes[i] = partA[i]! ^ partB[i]!;
    const key = await crypto.subtle.importKey(
      'raw',
      keyBytes.buffer,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
    vaultKey = key;
    return true;
  } catch {
    return false;
  }
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

async function persistSessionSplit(key: CryptoKey): Promise<void> {
  const raw = await crypto.subtle.exportKey('raw', key);
  const keyBytes = new Uint8Array(raw);
  const partA = crypto.getRandomValues(new Uint8Array(32));
  const partB = new Uint8Array(32);
  for (let i = 0; i < 32; i++) partB[i] = keyBytes[i]! ^ partA[i]!;
  sessionStorage.setItem(SESSION_PART_A_KEY, bytesToBase64(partA));
  if (typeof window !== 'undefined') {
    window.name = WINDOW_NAME_PREFIX + bytesToBase64(partB);
  }
}

/**
 * First-time vault setup. Generates a salt, derives the vault key,
 * and stores a verification token so we can validate the passphrase on unlock.
 */
export async function setupVault(passphrase: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const key = await deriveVaultKey(passphrase, salt, ['encrypt', 'decrypt']);

  // Create verification token
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ptBytes = new TextEncoder().encode(VERIFICATION_PLAINTEXT);
  const ctBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, ptBytes);

  await vaultMetaPut(VAULT_SALT_KEY, bufferToHex(salt.buffer));
  await vaultMetaPut(VAULT_VERIFY_KEY, {
    ct: bufferToBase64(ctBuf),
    iv: bufferToHex(iv.buffer),
  });

  vaultKey = key;
  await persistSessionSplit(key);
}

/**
 * Unlock the vault with a passphrase. Derives the key and verifies
 * it against the stored verification token. Throws on wrong passphrase.
 */
export async function initializeVault(passphrase: string): Promise<void> {
  const saltHex = await vaultMetaGet<string>(VAULT_SALT_KEY);
  if (!saltHex) throw new Error('Vault not configured');

  const salt = new Uint8Array(hexToBuffer(saltHex));
  const key = await deriveVaultKey(passphrase, salt, ['encrypt', 'decrypt']);

  // Verify passphrase by decrypting the verification token
  const token = await vaultMetaGet<{ ct: string; iv: string }>(VAULT_VERIFY_KEY);
  if (!token) throw new Error('Vault verification token missing');

  try {
    const iv = new Uint8Array(hexToBuffer(token.iv));
    const ct = base64ToBuffer(token.ct);
    const ptBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    const pt = new TextDecoder().decode(ptBuf);
    if (pt !== VERIFICATION_PLAINTEXT) throw new Error('Verification mismatch');
  } catch {
    throw new Error('Incorrect passphrase');
  }

  vaultKey = key;
  await persistSessionSplit(key);
}

/** Encrypt a string with the vault key. Throws if vault is locked. */
export async function encryptForVault(data: string): Promise<{ ct: string; iv: string }> {
  if (!vaultKey) throw new Error('Vault is locked');
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ptBytes = new TextEncoder().encode(data);
  const ctBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, vaultKey, ptBytes);
  return { ct: bufferToBase64(ctBuf), iv: bufferToHex(iv.buffer) };
}

/** Decrypt a string with the vault key. Throws if vault is locked. */
export async function decryptFromVault(ct: string, iv: string): Promise<string> {
  if (!vaultKey) throw new Error('Vault is locked');
  const ivBuf = new Uint8Array(hexToBuffer(iv));
  const ctBuf = base64ToBuffer(ct);
  const ptBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBuf }, vaultKey, ctBuf);
  return new TextDecoder().decode(ptBuf);
}
