/** FNV-1a 64-bit, split into two unsigned 32-bit limbs. ASCII talk ids only. */

const OFFSET = BigInt("0xcbf29ce484222325");
const PRIME = BigInt("0x100000001b3");
const MASK = BigInt("0xffffffffffffffff");
const U32 = BigInt("0xffffffff");
const SHIFT = BigInt(32);

export function fnv1a64(value: string): [number, number] {
  let hash = OFFSET;
  for (let i = 0; i < value.length; i++) {
    hash ^= BigInt(value.charCodeAt(i));
    hash = (hash * PRIME) & MASK;
  }
  return [Number((hash >> SHIFT) & U32), Number(hash & U32)];
}
