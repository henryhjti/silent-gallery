const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function generateIpfsHash(): string {
  const random = new Uint8Array(44);
  crypto.getRandomValues(random);
  let hash = "Qm";
  for (let i = 0; i < random.length; i += 1) {
    hash += BASE58_ALPHABET[random[i] % BASE58_ALPHABET.length];
  }
  return hash;
}

async function deriveKey(address: string): Promise<CryptoKey> {
  const normalized = address.toLowerCase();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptIpfsHash(plainHash: string, addressKey: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(addressKey);
  const encoded = new TextEncoder().encode(plainHash);
  const cipherBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  const cipherBytes = new Uint8Array(cipherBuffer);
  return `v1:${toBase64(iv)}:${toBase64(cipherBytes)}`;
}

export async function decryptIpfsHash(encryptedHash: string, addressKey: string): Promise<string> {
  const [version, ivPart, dataPart] = encryptedHash.split(":");
  if (version !== "v1" || !ivPart || !dataPart) {
    throw new Error("Unsupported encrypted hash format");
  }
  const iv = fromBase64(ivPart);
  const data = fromBase64(dataPart);
  const key = await deriveKey(addressKey);
  const clearBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(clearBuffer);
}

export function formatTimestamp(value: bigint): string {
  const date = new Date(Number(value) * 1000);
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
