import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const OPTIONS = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, OPTIONS, (error, key) => error ? reject(error) : resolve(key));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return ["scrypt", "131072", "8", "1", salt.toString("hex"), key.toString("hex")].join("$");
}

export async function checkPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, n, r, p, salt, hash] = encoded.split("$");
  if (algorithm !== "scrypt" || n !== "131072" || r !== "8" || p !== "1" ||
      !/^[a-f0-9]{32}$/.test(salt ?? "") || !/^[a-f0-9]{128}$/.test(hash ?? "")) return false;
  const actual = await derive(password, Buffer.from(salt, "hex"));
  return timingSafeEqual(actual, Buffer.from(hash, "hex"));
}

export function opaqueToken() {
  return randomBytes(32).toString("base64url");
}

export function secretHash(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function equalHash(left: string, right: string) {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
