/**
 * Key Store
 * IndexedDB for persistent link private keys; sessionStorage for sender ephemeral keys.
 * Also stores owner reply plaintexts so the owner can read their own replies.
 *
 * File size: ~120 lines
 */

const DB_NAME = 'burnware-keys';
const DB_VERSION = 1;
const LINK_KEYS_STORE = 'linkKeys';
const REPLY_CACHE_STORE = 'replyCache';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(LINK_KEYS_STORE)) {
        db.createObjectStore(LINK_KEYS_STORE);
      }
      if (!db.objectStoreNames.contains(REPLY_CACHE_STORE)) {
        db.createObjectStore(REPLY_CACHE_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet<T>(store: string, key: string): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).get(key);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error);
      }),
  );
}

function idbPut(store: string, key: string, value: unknown): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite', { durability: 'strict' });
        tx.objectStore(store).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

// ── Link private keys (IndexedDB, persistent) ──

export async function saveLinkKey(linkId: string, privateKeyJwk: JsonWebKey): Promise<void> {
  await idbPut(LINK_KEYS_STORE, linkId, privateKeyJwk);
}

export async function getLinkKey(linkId: string): Promise<JsonWebKey | undefined> {
  return idbGet<JsonWebKey>(LINK_KEYS_STORE, linkId);
}

// ── Sender ephemeral keys (sessionStorage, per-tab lifetime) ──

export interface SenderThreadData {
  privateKeyJwk: JsonWebKey;
  sentMessages: string[];
}

export function saveSenderKey(threadId: string, data: SenderThreadData): void {
  sessionStorage.setItem(`bw:thread:${threadId}`, JSON.stringify(data));
}

export function addSentMessage(threadId: string, plaintext: string): void {
  const existing = getSenderKey(threadId);
  if (existing) {
    existing.sentMessages.push(plaintext);
    saveSenderKey(threadId, existing);
  }
}

export function getSenderKey(threadId: string): SenderThreadData | null {
  const raw = sessionStorage.getItem(`bw:thread:${threadId}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    // Migrate legacy format (sentMessage → sentMessages)
    if (parsed.sentMessage && !parsed.sentMessages) {
      return { privateKeyJwk: parsed.privateKeyJwk, sentMessages: [parsed.sentMessage] };
    }
    return parsed as SenderThreadData;
  } catch {
    return null;
  }
}

// ── OPSEC access tokens ──

export function saveAccessToken(threadId: string, token: string, mode: 'device_bound' | 'single_use'): void {
  const key = `bw:access:${threadId}`;
  if (mode === 'device_bound') {
    localStorage.setItem(key, token);
  } else {
    sessionStorage.setItem(key, token);
  }
}

export function getAccessToken(threadId: string): string | null {
  const key = `bw:access:${threadId}`;
  return sessionStorage.getItem(key) || localStorage.getItem(key);
}

export function saveUnlockToken(threadId: string, token: string): void {
  sessionStorage.setItem(`bw:unlock:${threadId}`, token);
}

export function getUnlockToken(threadId: string): string | null {
  return sessionStorage.getItem(`bw:unlock:${threadId}`);
}

// ── Owner reply plaintext cache (IndexedDB, persistent) ──

type ReplyMap = Record<string, string>; // message_id → plaintext

export async function saveReplyPlaintext(
  threadId: string,
  messageId: string,
  plaintext: string,
): Promise<void> {
  const existing = (await idbGet<ReplyMap>(REPLY_CACHE_STORE, threadId)) || {};
  existing[messageId] = plaintext;
  await idbPut(REPLY_CACHE_STORE, threadId, existing);
}

export async function getReplyPlaintexts(threadId: string): Promise<ReplyMap> {
  return (await idbGet<ReplyMap>(REPLY_CACHE_STORE, threadId)) || {};
}

// ── Storage persistence (Safari ITP 7-day eviction prevention) ──

export async function requestPersistentStorage(): Promise<boolean> {
  if (navigator.storage?.persist) {
    return navigator.storage.persist();
  }
  return false;
}

// ── Bulk key access (for backup operations) ──

export async function getAllLinkKeys(): Promise<Map<string, JsonWebKey>> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LINK_KEYS_STORE, 'readonly');
    const store = tx.objectStore(LINK_KEYS_STORE);
    const req = store.openCursor();
    const keys = new Map<string, JsonWebKey>();
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        keys.set(cursor.key as string, cursor.value as JsonWebKey);
        cursor.continue();
      } else {
        resolve(keys);
      }
    };
    req.onerror = () => reject(req.error);
  });
}
