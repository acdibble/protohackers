import assert from 'assert';
import dbg from 'debug';

const debug = dbg('handleConnection');

enum State {
  Cipher,
  SecondCipherByte,
  Toys,
}

const NEWLINE = '\n'.charCodeAt(0);

type Op =
  | { type: 'reversebits' }
  | { type: 'xor'; n: number }
  | { type: 'xorpos' }
  | { type: 'add'; n: number }
  | { type: 'addpos' };

const reverseBits = (byte: number) =>
  Number.parseInt(byte.toString(2).padStart(8, '0').split('').reverse().join(''), 2);

const findToy = (buffer: number[]): string => {
  const list = Buffer.from(buffer).toString('ascii').split(',');

  let max = 0;
  let result = '';

  for (const wish of list) {
    const amount = Number.parseInt(wish, 10);
    if (amount > max) {
      max = amount;
      result = wish;
    }
  }

  assert(result !== '', 'No toys found in the list');
  debug('found toy: "%O"', result);
  return result;
};

async function* iterateBytes(iterator: AsyncIterable<Buffer>) {
  for await (const data of iterator) {
    yield* data;
  }
}

class Cipher {
  private inPos = 0;
  private outPos = 0;

  readonly ops: Op[] = [];

  constructor() {}

  addOp(op: Op) {
    this.ops.push(op);
  }

  decodeByte(byte: number): number {
    const output = this.ops.reduceRight((acc, op) => {
      switch (op.type) {
        case 'xor':
          return (acc ^ op.n) & 255;
        case 'reversebits':
          return reverseBits(acc);
        case 'addpos':
          return (acc - this.inPos) & 255;
        case 'xorpos':
          return (acc ^ this.inPos) & 255;
        case 'add':
          return (acc - op.n) & 255;
        default:
          const _: never = op;
          throw new Error(`Unknown operation type: ${op}`);
      }
    }, byte);

    this.inPos += 1;

    return output;
  }

  private encodeByte(byte: number): number {
    const result = this.ops.reduce((acc, op) => {
      switch (op.type) {
        case 'xor':
          return (acc ^ op.n) & 255;
        case 'reversebits':
          return reverseBits(acc);
        case 'addpos':
          return (acc + this.outPos) & 255;
        case 'xorpos':
          return (acc ^ this.outPos) & 255;
        case 'add':
          return (acc + op.n) & 255;
        default:
          const _: never = op;
          throw new Error(`Unknown operation type: ${op}`);
      }
    }, byte);

    this.outPos += 1;

    return result;
  }

  encodeBytes(bytes: string): number[] | null {
    let hasChange = false;

    const result = bytes
      .split('')
      .map((byte) => {
        const newByte = this.encodeByte(byte.charCodeAt(0));
        hasChange ||= newByte !== byte.charCodeAt(0);
        return newByte;
      })
      .concat(this.encodeByte(NEWLINE));

    if (!hasChange) {
      debug('No change in encoding, returning null');
      return null; // No change in encoding
    }

    return result;
  }
}

export async function* handleConnection(socket: AsyncIterable<Buffer>) {
  let state = State.Cipher;

  let opType: Extract<Op, { n: number }>['type'] | null = null;

  const it = iterateBytes(socket);

  const buffer: number[] = [];

  const cipher = new Cipher();

  for (let value = await it.next(); !value.done; value = await it.next()) {
    const byte = value.value;

    switch (state) {
      case State.Cipher:
        switch (byte) {
          case 0:
            state = State.Toys;
            debug('got ops', cipher.ops);
            break;
          case 1:
            cipher.addOp({ type: 'reversebits' });
            break;
          case 2:
            state = State.SecondCipherByte;
            opType = 'xor';
            break;
          case 3:
            cipher.addOp({ type: 'xorpos' });
            break;
          case 4:
            state = State.SecondCipherByte;
            opType = 'add';
            break;
          case 5:
            cipher.addOp({ type: 'addpos' });
            break;
          default:
            throw new Error(`Unknown cipher byte: ${byte}`);
        }
        break;
      case State.SecondCipherByte:
        assert(opType !== null, 'Expected opType to be set');
        cipher.addOp({ type: opType, n: byte });
        opType = null;
        state = State.Cipher;
        break;
      case State.Toys:
        const parsedByte = cipher.decodeByte(byte);

        if (parsedByte === NEWLINE) {
          debug(
            'End of toys input, processing buffer: "%O"',
            Buffer.from(buffer).toString('ascii'),
          );
          const toy = findToy(buffer);
          const bytes = cipher.encodeBytes(toy);
          if (bytes === null) return;
          yield bytes;
          buffer.length = 0;
        } else {
          buffer.push(parsedByte);
        }
        break;
      default:
        throw new Error(`Unknown state: ${state}`);
    }
  }
}
