import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";

const SALT_ROUNDS = 12;

export function hashPassword(value: string): Promise<string> {
  return bcrypt.hash(value, SALT_ROUNDS);
}

export function comparePassword(value: string, hash: string): Promise<boolean> {
  return bcrypt.compare(value, hash);
}

export function generateRandomToken(size = 32): string {
  return randomBytes(size).toString("hex");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
