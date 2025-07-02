import { describe, expect, it } from 'vitest';
import { handleConnection } from './handleConnection';

async function* yieldBytes(bytes: number[]) {
  yield Buffer.from(bytes);
}

const collect = async (iterator: AsyncIterable<number[]>): Promise<string[]> => {
  const results: string[] = [];

  for await (const item of iterator) {
    results.push(
      Array.from(item)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' '),
    );
  }

  return results;
};

describe(handleConnection, () => {
  it('handles this', async () => {
    await expect(
      collect(
        handleConnection(
          yieldBytes([
            0x02, 0x7b, 0x05, 0x01, 0x00, 0xf2, 0x20, 0xba, 0x44, 0x18, 0x84, 0xba, 0xaa, 0xd0,
            0x26, 0x44, 0xa4, 0xa8, 0x7e, 0x6a, 0x48, 0xd6, 0x58, 0x34, 0x44, 0xd6, 0x7a, 0x98,
            0x4e, 0x0c, 0xcc, 0x94, 0x31,
          ]),
        ),
      ),
    ).resolves.toEqual(['72 20 ba d8 78 70 ee', 'f2 d0 26 c8 a4 d8 7e']);
  });
});
