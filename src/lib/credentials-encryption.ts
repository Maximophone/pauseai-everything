import { encrypt, decrypt } from "./encryption";

/**
 * Encrypt a credentials object for storage.
 * Serializes to JSON and encrypts using AES-256-GCM (same key as email tokens).
 *
 * Returns an object with a single `_encrypted` key containing the ciphertext.
 * This marker key lets us distinguish encrypted vs plaintext credentials at read time.
 */
export function encryptCredentials(
  credentials: Record<string, unknown>
): Record<string, unknown> {
  const plaintext = JSON.stringify(credentials);
  return { _encrypted: encrypt(plaintext) };
}

/**
 * Decrypt a credentials object retrieved from the database.
 * If the object has an `_encrypted` key, decrypts and parses it.
 * Otherwise returns as-is (backward compat for any pre-encryption rows).
 */
export function decryptCredentials(
  credentials: Record<string, unknown>
): Record<string, unknown> {
  if (typeof credentials._encrypted === "string") {
    const plaintext = decrypt(credentials._encrypted);
    return JSON.parse(plaintext);
  }
  // Backward compat: unencrypted credentials
  return credentials;
}
