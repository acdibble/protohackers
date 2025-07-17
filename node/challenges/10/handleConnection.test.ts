import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Readable } from 'stream';

describe('handleConnection', () => {
  let handleConnection: typeof import('./handleConnection.js').default;

  beforeEach(async () => {
    vi.resetModules();
    handleConnection = (await import('./handleConnection.js')).default;
  });

  const collectResponses = async (lines: (string | Buffer)[]) => {
    const iterable = handleConnection(
      Readable.from(lines.values().map((l) => (typeof l === 'string' ? Buffer.from(l + '\n') : l))),
      vi.fn(),
    );

    const responses: { message: string; raw?: true }[] = [];
    for await (const line of iterable) {
      responses.push(line);
    }
    return responses;
  };

  it('works', async () => {
    const responses = await collectResponses([
      //
      'PUT /test.txt 14',
      'Hello, world!',
      'GET /test.txt',
      'GET /test.txt',
      'PUT /test2.txt 27',
      'This is another text file.',
      'PUT /test3.txt 19',
      'A third text file.',
      'PUT /a.txt 2',
      'a',
      'LIST /',
      'GET /test.txt r1',
    ]);

    expect(responses).toMatchInlineSnapshot(`
      [
        {
          "message": "READY",
        },
        {
          "message": "OK r1",
        },
        {
          "message": "READY",
        },
        {
          "message": "OK 14",
        },
        {
          "message": "Hello, world!
      ",
          "raw": true,
        },
        {
          "message": "READY",
        },
        {
          "message": "OK 14",
        },
        {
          "message": "Hello, world!
      ",
          "raw": true,
        },
        {
          "message": "READY",
        },
        {
          "message": "OK r1",
        },
        {
          "message": "READY",
        },
        {
          "message": "OK r1",
        },
        {
          "message": "READY",
        },
        {
          "message": "OK r1",
        },
        {
          "message": "READY",
        },
        {
          "message": "OK 4",
        },
        {
          "message": "a.txt r1",
        },
        {
          "message": "test.txt r1",
        },
        {
          "message": "test2.txt r1",
        },
        {
          "message": "test3.txt r1",
        },
        {
          "message": "READY",
        },
        {
          "message": "OK 14",
        },
        {
          "message": "Hello, world!
      ",
          "raw": true,
        },
        {
          "message": "READY",
        },
      ]
    `);
  });

  it('handles multiple revisions', async () => {
    const responses = await collectResponses([
      'PUT /nested/test.txt 16',
      'Hello, world! 1',
      'PUT /nested/test.txt 16',
      'Hello, world! 2',
      'PUT /nested/test.txt 16',
      'Hello, world! 3',
      'PUT /nested/test.txt 16',
      'Hello, world! 4',
      'PUT /nested/test.txt 16',
      'Hello, world! 5',
      'GET /nested/test.txt r3',
      'LIST /',
    ]);

    expect(responses).toMatchInlineSnapshot(`
      [
        {
          "message": "READY",
        },
        {
          "message": "OK r1",
        },
        {
          "message": "READY",
        },
        {
          "message": "OK r2",
        },
        {
          "message": "READY",
        },
        {
          "message": "OK r3",
        },
        {
          "message": "READY",
        },
        {
          "message": "OK r4",
        },
        {
          "message": "READY",
        },
        {
          "message": "OK r5",
        },
        {
          "message": "READY",
        },
        {
          "message": "OK 16",
        },
        {
          "message": "Hello, world! 3
      ",
          "raw": true,
        },
        {
          "message": "READY",
        },
        {
          "message": "OK 1",
        },
        {
          "message": "nested/ DIR",
        },
        {
          "message": "READY",
        },
      ]
    `);
  });

  it('rejects invalid filenames', async () => {
    expect(await collectResponses(['PUT /OjQ!}bu 2', 'a'])).toMatchInlineSnapshot(`
      [
        {
          "message": "READY",
        },
        {
          "message": "ERR illegal file name",
        },
        {
          "message": "ERR illegal method: A",
        },
      ]
    `);
  });

  it.each([
    [
      1,
      [
        103, 79, 72, 103, 98, 110, 122, 97, 110, 73, 86, 102, 73, 117, 102, 46, 105, 74, 90, 115,
        79, 46, 103, 97, 45, 75, 97, 100, 57, 119, 88, 106, 65, 77, 87, 117, 102, 73, 107, 90, 95,
        47, 95, 100, 109, 67, 78, 68, 106, 97, 66, 79, 119, 104, 83, 73, 102, 75, 76, 104, 109, 119,
        117, 73, 77, 106, 100, 73, 48, 71, 77, 66, 85, 102, 97, 109, 75, 117, 68, 90, 85, 115, 113,
        47, 153, 117, 68, 83, 66, 116, 90, 66, 103, 116, 80, 88, 78, 113, 112, 120, 117, 103, 79,
        95, 122, 102, 85, 120, 116, 71, 85, 46,
      ],
    ],
    [
      2,
      [
        68, 115, 113, 90, 47, 47, 115, 57, 82, 76, 66, 115, 122, 84, 115, 86, 101, 89, 101, 116, 69,
        114, 48, 69, 102, 69, 73, 104, 81, 89, 101, 121, 79, 108, 108, 110, 45, 76, 45, 107, 84, 79,
        88, 120, 48, 109, 116, 104, 110, 101, 120, 66, 98, 71, 121, 24, 65, 75, 97, 45, 108, 103,
        100, 98, 95, 118, 77, 86, 45, 86, 118, 106, 115, 78, 97, 81, 82, 112, 86, 71, 47, 87, 78,
        112, 99, 45, 88, 86, 97, 69, 102, 117, 107, 80, 48, 115, 77, 104, 57, 72, 88, 103, 65, 100,
      ],
    ],
    [
      3,
      [
        76, 65, 57, 101, 89, 110, 110, 114, 75, 74, 90, 83, 100, 83, 75, 104, 102, 99, 75, 77, 97,
        48, 68, 120, 78, 75, 111, 88, 102, 116, 95, 116, 120, 83, 68, 76, 109, 70, 109, 110, 97, 95,
        105, 77, 48, 88, 81, 57, 86, 97, 110, 87, 70, 99, 118, 75, 99, 71, 112, 89, 67, 81, 57, 95,
        115, 66, 108, 46, 79, 71, 47, 104, 120, 48, 120, 113, 67, 100, 87, 110, 115, 4, 122, 67,
        109, 70, 122, 72, 86, 86, 85, 82, 116,
      ],
    ],
  ])('rejects invalid contents %d', async (_id, bytes) => {
    const contents = Buffer.from(bytes);

    expect(
      await collectResponses([`PUT /some/file.txt ${contents.byteLength}`, contents]),
    ).toStrictEqual([
      {
        message: 'READY',
      },
      {
        message: 'ERR invalid data',
      },
      {
        message: 'READY',
      },
    ]);
  });
});
