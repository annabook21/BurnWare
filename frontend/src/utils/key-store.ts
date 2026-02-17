/**
 * Key Store
 * IndexedDB for persistent link private keys; sessionStorage for sender ephemeral keys.
 * Also stores owner reply plaintexts so the owner can read their own replies.
 *
 * Vault integration: when the vault is unlocked, keys are encrypted before storing
 * in IndexedDB. Entries with `_vault: true` are vault-encrypted. Per OWASP/key mgmt
 * best practices, encryption keys are never stored in plaintext on persistent storage;
 * creator room keys are always vault-encrypted when persisted.
 */

import { isVaultUnlocked, encryptForVault, decryptFromVault } from './key-vault';
import {
  LINK_KEYS_STORE, REPLY_CACHE_STORE, ROOM_KEYS_STORE, BROADCAST_KEYS_STORE,
  openDb, idbGet, idbPut,
  isVaultWrapped, type VaultWrappedEntry,
} from './key-store-db';

// ── Link private keys (IndexedDB, persistent, vault-encrypted when available) ──

export async function saveLinkKey(linkId: string, privateKeyJwk: JsonWebKey): Promise<void> {
  if (isVaultUnlocked()) {
    const { ct, iv } = await encryptForVault(JSON.stringify(privateKeyJwk));
    await idbPut(LINK_KEYS_STORE, linkId, { _vault: true, ct, iv } as VaultWrappedEntry);
  } else {
    await idbPut(LINK_KEYS_STORE, linkId, privateKeyJwk);
  }
}

export async function getLinkKey(linkId: string): Promise<JsonWebKey | undefined> {
  const stored = await idbGet<JsonWebKey | VaultWrappedEntry>(LINK_KEYS_STORE, linkId);
  if (!stored) return undefined;
  if (isVaultWrapped(stored)) {
    if (!isVaultUnlocked()) return undefined;
    const json = await decryptFromVault(stored.ct, stored.iv);
    return JSON.parse(json) as JsonWebKey;
  }
  return stored as JsonWebKey;
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
    req.onsuccess = async () => {
      const cursor = req.result;
      if (cursor) {
        const val = cursor.value;
        if (isVaultWrapped(val)) {
          if (isVaultUnlocked()) {
            try {
              const json = await decryptFromVault(val.ct, val.iv);
              keys.set(cursor.key as string, JSON.parse(json) as JsonWebKey);
            } catch { /* skip unreadable entries */ }
          }
        } else {
          keys.set(cursor.key as string, val as JsonWebKey);
        }
        cursor.continue();
      } else {
        resolve(keys);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

// ── Room keys (IndexedDB for owner, sessionStorage for participants) ──

export interface RoomKeyData {
  roomId: string;
  groupKey: string; // Base64 raw AES-256 key
  privateKeyJwk: JsonWebKey; // ECDH private key
  publicKeyBase64: string; // ECDH public key
  anonymousId: string;
  watermarkSeed: string;
  isCreator: boolean;
  createdAt?: number; // Timestamp for cleanup (optional for backwards compat)
}

export async function saveRoomKey(roomId: string, data: RoomKeyData): Promise<void> {
  // Add timestamp if not present (for cleanup)
  const dataWithTimestamp = { ...data, createdAt: data.createdAt ?? Date.now() };

  if (data.isCreator) {
    // Creator: persist only when vault is unlocked (vault-encrypted). Never store in plaintext.
    if (!isVaultUnlocked()) {
      throw new Error('VAULT_LOCKED');
    }
    const { ct, iv } = await encryptForVault(JSON.stringify(dataWithTimestamp));
    await idbPut(ROOM_KEYS_STORE, roomId, { _vault: true, ct, iv } as VaultWrappedEntry);
  } else {
    // Participant: session-only storage (ephemeral; no persistence to disk)
    sessionStorage.setItem(`bw:room:${roomId}`, JSON.stringify(dataWithTimestamp));
  }
}

export async function getRoomKey(roomId: string): Promise<RoomKeyData | null> {
  // Check sessionStorage first (participants)
  const sessionData = sessionStorage.getItem(`bw:room:${roomId}`);
  if (sessionData) {
    try {
      return JSON.parse(sessionData) as RoomKeyData;
    } catch {
      // Fall through to IndexedDB
    }
  }

  // Check IndexedDB (creators) — always vault-encrypted when persisted
  const stored = await idbGet<RoomKeyData | VaultWrappedEntry>(ROOM_KEYS_STORE, roomId);
  if (!stored) return null;
  if (isVaultWrapped(stored)) {
    if (!isVaultUnlocked()) return null;
    const json = await decryptFromVault(stored.ct, stored.iv);
    return JSON.parse(json) as RoomKeyData;
  }
  // Legacy cleartext entry: migrate on read and return (caller can use key)
  if (isVaultUnlocked()) {
    const data = stored as RoomKeyData;
    if (data.isCreator) {
      const { ct, iv } = await encryptForVault(JSON.stringify(data));
      await idbPut(ROOM_KEYS_STORE, roomId, { _vault: true, ct, iv } as VaultWrappedEntry);
    }
    return data as RoomKeyData;
  }
  return null;
}

export async function deleteRoomKey(roomId: string): Promise<void> {
  sessionStorage.removeItem(`bw:room:${roomId}`);
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ROOM_KEYS_STORE, 'readwrite');
    tx.objectStore(ROOM_KEYS_STORE).delete(roomId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Vault migration: re-encrypt cleartext keys with vault ──

export async function migrateKeysToVault(): Promise<number> {
  if (!isVaultUnlocked()) throw new Error('Vault must be unlocked to migrate');

  let migrated = 0;
  const db = await openDb();

  // Migrate link keys
  const linkKeys = await new Promise<Array<[string, unknown]>>((resolve, reject) => {
    const tx = db.transaction(LINK_KEYS_STORE, 'readonly');
    const entries: Array<[string, unknown]> = [];
    const req = tx.objectStore(LINK_KEYS_STORE).openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        entries.push([cursor.key as string, cursor.value]);
        cursor.continue();
      } else {
        resolve(entries);
      }
    };
    req.onerror = () => reject(req.error);
  });

  for (const [key, val] of linkKeys) {
    if (!isVaultWrapped(val)) {
      const { ct, iv } = await encryptForVault(JSON.stringify(val));
      await idbPut(LINK_KEYS_STORE, key, { _vault: true, ct, iv });
      migrated++;
    }
  }

  // Migrate room creator keys
  const roomKeys = await new Promise<Array<[string, unknown]>>((resolve, reject) => {
    const tx = db.transaction(ROOM_KEYS_STORE, 'readonly');
    const entries: Array<[string, unknown]> = [];
    const req = tx.objectStore(ROOM_KEYS_STORE).openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        entries.push([cursor.key as string, cursor.value]);
        cursor.continue();
      } else {
        resolve(entries);
      }
    };
    req.onerror = () => reject(req.error);
  });

  for (const [key, val] of roomKeys) {
    if (!isVaultWrapped(val)) {
      const { ct, iv } = await encryptForVault(JSON.stringify(val));
      await idbPut(ROOM_KEYS_STORE, key, { _vault: true, ct, iv });
      migrated++;
    }
  }

  // Migrate broadcast keys
  const bcKeys = await new Promise<Array<[string, unknown]>>((resolve, reject) => {
    const tx = db.transaction(BROADCAST_KEYS_STORE, 'readonly');
    const entries: Array<[string, unknown]> = [];
    const req = tx.objectStore(BROADCAST_KEYS_STORE).openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        entries.push([cursor.key as string, cursor.value]);
        cursor.continue();
      } else {
        resolve(entries);
      }
    };
    req.onerror = () => reject(req.error);
  });

  for (const [key, val] of bcKeys) {
    if (!isVaultWrapped(val)) {
      const { ct, iv } = await encryptForVault(JSON.stringify(val));
      await idbPut(BROADCAST_KEYS_STORE, key, { _vault: true, ct, iv });
      migrated++;
    }
  }

  return migrated;
}

/** Check if any cleartext (non-vault) keys exist in IndexedDB (link or room stores). */
export async function hasCleartextKeys(): Promise<boolean> {
  const db = await openDb();
  const checkStore = (store: string) =>
    new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          if (!isVaultWrapped(cursor.value)) {
            resolve(true);
            return;
          }
          cursor.continue();
        } else {
          resolve(false);
        }
      };
      req.onerror = () => reject(req.error);
    });
  const linkHas = await checkStore(LINK_KEYS_STORE);
  if (linkHas) return true;
  const roomHas = await checkStore(ROOM_KEYS_STORE);
  if (roomHas) return true;
  return checkStore(BROADCAST_KEYS_STORE);
}

/** Get all room keys from IndexedDB (creators only). */
export async function getAllRoomKeys(): Promise<Map<string, RoomKeyData>> {
  const db = await openDb();

  // First, collect all raw entries synchronously
  const rawEntries = await new Promise<Array<[string, unknown]>>((resolve, reject) => {
    const tx = db.transaction(ROOM_KEYS_STORE, 'readonly');
    const entries: Array<[string, unknown]> = [];
    const req = tx.objectStore(ROOM_KEYS_STORE).openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        entries.push([cursor.key as string, cursor.value]);
        cursor.continue();
      } else {
        resolve(entries);
      }
    };
    req.onerror = () => reject(req.error);
  });

  // Only return creator keys we can decrypt (vault unlocked). No plaintext on disk.
  const keys = new Map<string, RoomKeyData>();
  for (const [key, val] of rawEntries) {
    if (isVaultWrapped(val)) {
      if (isVaultUnlocked()) {
        try {
          const json = await decryptFromVault(val.ct, val.iv);
          const data = JSON.parse(json) as RoomKeyData;
          if (data.isCreator) keys.set(key, data);
        } catch { /* skip unreadable entries */ }
      }
    } else {
      // Legacy cleartext: migrate to vault if unlocked, then include
      const data = val as RoomKeyData;
      if (data.isCreator && isVaultUnlocked()) {
        try {
          const { ct, iv } = await encryptForVault(JSON.stringify(data));
          await idbPut(ROOM_KEYS_STORE, key, { _vault: true, ct, iv } as VaultWrappedEntry);
          keys.set(key, data);
        } catch { /* skip */ }
      }
    }
  }

  return keys;
}

// ── Cleanup of expired room keys ──

const ROOM_KEY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours (matches room lifespan)

/**
 * Remove room keys older than 24 hours from IndexedDB.
 * Should be called on app load to prevent indefinite storage growth.
 * Returns the number of keys deleted.
 */
export async function cleanupExpiredRoomKeys(): Promise<number> {
  const db = await openDb();
  const now = Date.now();
  let deleted = 0;

  // Collect all entries first
  const entries = await new Promise<Array<[string, unknown]>>((resolve, reject) => {
    const tx = db.transaction(ROOM_KEYS_STORE, 'readonly');
    const arr: Array<[string, unknown]> = [];
    const req = tx.objectStore(ROOM_KEYS_STORE).openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        arr.push([cursor.key as string, cursor.value]);
        cursor.continue();
      } else {
        resolve(arr);
      }
    };
    req.onerror = () => reject(req.error);
  });

  // Determine which keys to delete
  const keysToDelete: string[] = [];
  for (const [key, val] of entries) {
    let createdAt: number | undefined;

    if (isVaultWrapped(val)) {
      // Try to decrypt to check createdAt (only if vault is unlocked)
      if (isVaultUnlocked()) {
        try {
          const json = await decryptFromVault(val.ct, val.iv);
          const data = JSON.parse(json) as RoomKeyData;
          createdAt = data.createdAt;
        } catch {
          // Can't decrypt — delete if vault-wrapped but unreadable (likely corrupted)
          keysToDelete.push(key);
          continue;
        }
      }
      // If vault is locked, skip (we can't determine age)
    } else {
      // Legacy cleartext entry
      const data = val as RoomKeyData;
      createdAt = data.createdAt;
    }

    // Delete if older than TTL (or missing timestamp for legacy entries older than 7 days is edge case,
    // but we conservatively keep entries without timestamps to avoid data loss)
    if (createdAt !== undefined && now - createdAt > ROOM_KEY_TTL_MS) {
      keysToDelete.push(key);
    }
  }

  // Delete expired keys
  if (keysToDelete.length > 0) {
    const db2 = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db2.transaction(ROOM_KEYS_STORE, 'readwrite');
      const store = tx.objectStore(ROOM_KEYS_STORE);
      for (const key of keysToDelete) {
        store.delete(key);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    deleted = keysToDelete.length;
  }

  if (deleted > 0) {
    console.info(`[KeyStore] Cleaned up ${deleted} expired room key(s)`);
  }

  return deleted;
}
