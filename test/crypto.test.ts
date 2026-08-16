import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { decryptJson, encryptJson } from "../src/security/crypto.js";

beforeAll(() => {
  process.env.CREDENTIALS_KEY = randomBytes(32).toString("base64");
});

describe("encryptJson / decryptJson", () => {
  it("faz o round-trip preservando o conteúdo original", () => {
    const original = { user: "nalisa", password: "s3nh4-forte", cartaoPostagem: "0078662362" };
    const encrypted = encryptJson(original);
    const decrypted = decryptJson<typeof original>(encrypted);
    expect(decrypted).toEqual(original);
  });

  it("gera IVs diferentes a cada chamada (não repete nonce)", () => {
    const a = encryptJson({ x: 1 });
    const b = encryptJson({ x: 1 });
    expect(a.iv.equals(b.iv)).toBe(false);
  });

  it("falha ao decifrar se o ciphertext for adulterado", () => {
    const encrypted = encryptJson({ secret: "valor" });
    encrypted.ciphertext[0] = (encrypted.ciphertext[0] ?? 0) ^ 0xff;
    expect(() => decryptJson(encrypted)).toThrow();
  });
});
