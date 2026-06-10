/**
 * Utility for managing browser localStorage with AES encryption.
 * All data stored is encrypted transparently on set and decrypted on get.
 */
import CryptoJS from "crypto-js";

// Derive a stable encryption key from a static app secret combined with origin
const ENCRYPTION_KEY = `sc_${window.location.origin}_8f3a2b9c4d7e1f6a`;

const encrypt = (value: string): string => {
  return CryptoJS.AES.encrypt(value, ENCRYPTION_KEY).toString();
};

const decrypt = (cipherText: string): string | null => {
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, ENCRYPTION_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted || null;
  } catch {
    return null;
  }
};

export const setCookie = (name: string, value: any) => {
  const stringValue = typeof value === "object" ? JSON.stringify(value) : String(value);
  try {
    const encrypted = encrypt(stringValue);
    localStorage.setItem(name, encrypted);
  } catch (e) {
    console.error("Failed to save to localStorage:", e);
  }
};

export const getCookie = (name: string) => {
  const raw = localStorage.getItem(name);
  if (!raw) return null;

  // Attempt decryption first (new encrypted format)
  const decrypted = decrypt(raw);

  // If decryption succeeded, parse; otherwise fall back to reading raw
  // (handles legacy unencrypted values gracefully)
  const value = decrypted !== null ? decrypted : raw;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export const deleteCookie = (name: string) => {
  localStorage.removeItem(name);
};
