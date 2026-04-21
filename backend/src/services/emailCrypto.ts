import crypto from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 16;
const KEY_SALT = "projecthub-email-v1";

function getKey(): Buffer {
  const raw = process.env.EMAIL_ENCRYPTION_KEY?.trim();
  if (raw) {
    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
      return Buffer.from(raw, "hex");
    }
    return crypto.createHash("sha256").update(raw, "utf8").digest();
  }
  const jwt = process.env.JWT_SECRET || "";
  return crypto.createHash("sha256").update(`email:${jwt}:${KEY_SALT}`, "utf8").digest();
}

/** AES-256-GCM。形式: iv:tag:ciphertext（いずれも base64） */
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(IV_LEN);
  const key = getKey();
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptSecret(stored: string): string {
  const parts = stored.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted secret format");
  }
  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
