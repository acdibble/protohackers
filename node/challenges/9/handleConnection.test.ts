import { describe, expect, it } from 'vitest';
import { handleConnection } from './handleConnection.js';
import { Readable } from 'stream';

async function* yieldLines(lines: any[]) {
  yield* lines.map((l) => JSON.stringify(l) + '\n');
}

const collect = async (iterator: AsyncIterable<any>): Promise<any[]> => {
  const results: any[] = [];

  for await (const item of iterator) {
    results.push(item);
  }

  return results;
};

describe(handleConnection, () => {
  it('handles this', async () => {
    await expect(
      collect(
        handleConnection(
          Readable.from(
            yieldLines([
              { queues: ['q-UV79xFga'], request: 'get' },
              { pri: 100, request: 'put', job: { title: 'j-DRZwJlOf' }, queue: 'q-UV79xFga' },
              { queues: ['q-UV79xFga'], request: 'get' },
            ]),
          ),
        ),
      ),
    ).resolves.toEqual([
      { status: 'no-job' },
      { id: 0, job: { title: 'j-DRZwJlOf' }, pri: 100, queue: 'q-UV79xFga', status: 'ok' },
    ]);
  });
});
