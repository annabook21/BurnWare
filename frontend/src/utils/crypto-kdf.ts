/**
 * Crypto KDF Utility
 * Shared ECDH-to-AES key derivation with optional HKDF extract-and-expand step.
 * V1 (legacy): direct ECDH → AES key (non-uniform, kept for backward compat)
 * V2: ECDH → HKDF-SHA256 → AES key (uniform, per NIST SP 800-56C / RFC 5869)
 */

const AES_ALGO: AesKeyGenParams = { name: 'AES-GCM', length: 256 };

/**
 * Derive an AES-256-GCM key from an ECDH key agreement.
 *
 * @param publicKey  - The other party's public key (CryptoKey)
 * @param privateKey - Our private key (CryptoKey, must have 'deriveBits' usage for HKDF path)
 * @param usages    - AES key usages (['encrypt'], ['decrypt'], ['wrapKey'], ['unwrapKey'])
 * @param options.useHkdf - true for V2 (HKDF), false for V1 (legacy direct derivation)
 * @param options.info    - HKDF info parameter for domain separation (ignored when useHkdf=false)
 */
export async function deriveAESKeyFromECDH(
  publicKey: CryptoKey,
  privateKey: CryptoKey,
  usages: KeyUsage[],
  options: { useHkdf: boolean; info: Uint8Array },
): Promise<CryptoKey> {
  if (!options.useHkdf) {
    // V1 legacy: direct ECDH shared secret → AES key (non-uniform)
    return crypto.subtle.deriveKey(
      { name: 'ECDH', public: publicKey },
      privateKey,
      AES_ALGO,
      false,
      usages,
    );
  }

  // V2: ECDH → raw bits → HKDF extract-and-expand → uniform AES key
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: publicKey },
    privateKey,
    256,
  );

  const hkdfKey = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);

  const salt = new ArrayBuffer(0);
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info: options.info.buffer as ArrayBuffer,
    },
    hkdfKey,
    AES_ALGO,
    false,
    usages,
  );
}
