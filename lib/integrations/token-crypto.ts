import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const TOKEN_VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const SERVER_MANAGED_TOKEN_REFERENCES = new Map<string, string>([
  ["env.KIT_API_KEY", "KIT_API_KEY"],
]);

function decodeKey(raw: string) {
  if (/^[a-f0-9]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
  if (/^[A-Za-z0-9+/]{43}=$/.test(raw) || /^[A-Za-z0-9_-]{43}$/.test(raw)) {
    const normalized = raw.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(normalized, "base64");
  }
  throw new Error("ARTISTOS_TOKEN_ENCRYPTION_KEY must be a 32-byte hex or base64 value");
}

function encryptionKey() {
  const raw = process.env.ARTISTOS_TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("missing_token_encryption_key");
  const key = decodeKey(raw.trim());
  if (key.length !== 32) throw new Error("invalid_token_encryption_key_length");
  return key;
}

export function isCurrentTokenEnvelope(value: string | null | undefined) {
  return Boolean(value?.startsWith(`${TOKEN_VERSION}.`) || (value && SERVER_MANAGED_TOKEN_REFERENCES.has(value)));
}

export function encryptIntegrationToken(value: string) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [TOKEN_VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptIntegrationToken(envelope: string) {
  const environmentVariable = SERVER_MANAGED_TOKEN_REFERENCES.get(envelope);
  if (environmentVariable) {
    const value = process.env[environmentVariable]?.trim();
    if (!value) throw new Error(`missing_server_managed_credential:${environmentVariable}`);
    return value;
  }

  const [version, ivValue, tagValue, ciphertextValue, extra] = envelope.split(".");
  if (version !== TOKEN_VERSION || !ivValue || !tagValue || !ciphertextValue || extra) {
    throw new Error("legacy_token_reconnect_required");
  }

  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
