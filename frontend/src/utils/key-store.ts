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
        const tx = db.transaction(store, 'readwrite');
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

interface SenderThreadData {
  privateKeyJwk: JsonWebKey;
  sentMessage: string;
}

export function saveSenderKey(threadId: string, data: SenderThreadData): void {
  sessionStorage.setItem(`bw:thread:${threadId}`, JSON.stringify(data));
}

export function getSenderKey(threadId: string): SenderThreadData | null {
  const raw = sessionStorage.getItem(`bw:thread:${threadId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SenderThreadData;
  } catch {
    return null;
  }
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
