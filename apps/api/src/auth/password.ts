import * as bcrypt from 'bcrypt';

/** Same cost as demo seed hashes (README / prisma seed). */
const BCRYPT_COST = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}
