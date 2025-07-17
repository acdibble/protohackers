import * as fsp from 'fs/promises';
import assert from 'assert';
import { isUtf8 } from 'buffer';

const debug = (...values: any[]) => {
  if (false as boolean) console.log(...values);
};

abstract class Entity {
  static parsePath(path: string) {
    const index = path.indexOf('/', 1);

    if (index === -1) {
      const entityName = path.slice(1);

      return { entityName, rest: null };
    }

    return { entityName: path.slice(1, index + 1), rest: path.slice(index) };
  }

  constructor(readonly name: string) {}

  abstract write(filename: string, contents: string): number;

  abstract info(): `${string} ${string}`;

  asDirectory(): Directory | null {
    if (this instanceof Directory) return this;
    return null;
  }

  asFile(): File | null {
    if (this instanceof File) return this;
    return null;
  }
}

class Directory extends Entity {
  private readonly contents = new Map<string, Entity>();

  write(path: string, contents: string): number {
    const { entityName, rest } = Entity.parsePath(path);

    if (rest === null) {
      let entity = this.contents.get(entityName);
      if (!entity) {
        entity = new File(entityName);
        this.contents.set(entityName, entity);
      }
      return entity.write(entityName, contents);
    }

    let dir = this.contents.get(entityName);
    if (!dir) {
      dir = new Directory(entityName);
      this.contents.set(entityName, dir);
    }
    return dir.write(rest, contents);
  }

  info(): `${string} DIR` {
    return `${this.name} DIR`;
  }

  get(path: string): Entity | undefined {
    const { entityName, rest } = Entity.parsePath(path);

    if (rest === null) {
      if (entityName === '') {
        assert(this instanceof Directory);
        return this;
      }
      return this.contents.get(entityName);
    }

    const dir = this.contents.get(entityName)?.asDirectory();
    assert(dir != null);
    return dir.get(rest);
  }

  list(): Entity[] {
    return this.contents
      .values()
      .toArray()
      .sort((a, b) => (a.name < b.name ? -1 : 1));
  }
}

class File extends Entity {
  private readonly revisions: string[] = [];

  write(_filename: string, contents: string): number {
    const index = this.revisions.findIndex((el) => el === contents);
    if (index !== -1) return index + 1;
    this.revisions.push(contents);
    return this.revisions.length;
  }

  info(): `${string} ${string}` {
    return `${this.name} r${this.revisions.length}`;
  }

  at(revision = 0) {
    return this.revisions.at(revision - 1);
  }
}

const fs = new Directory('root');

const READY = 'READY';

type Command =
  | { cmd: 'HELP' }
  | { cmd: 'PUT'; filename: string; length: number }
  | { cmd: 'GET'; filename: string; revision?: number }
  | { cmd: 'LIST'; dirname: string };

const PATH_REGEX = /^\/[\w\d.\/\-_]*$/i;

const isValidName = (name: string, type: 'dir' | 'file') =>
  PATH_REGEX.test(name) && !name.includes('//') && (type === 'dir' || !name.endsWith('/'));

const ok = <T>(value: T) => ({ ok: true as const, value });
const err = <T>(error: T) => ({ ok: false as const, error });

const parseCommand = (
  line: string,
): { ok: true; value: Command } | { ok: false; error: string } => {
  let [command, ...args] = line.split(' ');
  command = command.toUpperCase();

  if (command === 'PUT') {
    if (args.length !== 2) {
      return err('ERR usage: PUT file length newline data');
    }

    const [filename, lengthStr] = args;

    if (!isValidName(filename, 'file')) {
      return err('ERR illegal file name');
    }

    const length = Number.parseInt(lengthStr, 10);
    if (Number.isNaN(length) || length <= 0) {
      return err('ERR invalid length');
    }

    return ok({ cmd: 'PUT', filename, length });
  }

  if (command === 'GET') {
    if (args.length === 0 || args.length > 2) {
      return err('ERR usage: GET file [revision]');
    }

    const [filename] = args;

    if (!isValidName(filename, 'file')) {
      return err('ERR illegal file name');
    }

    let revision = undefined;
    if (args.length === 2) {
      const digits = args[1].match(/r(\d+)/i)?.[1];
      if (!digits) {
        return err('ERR invalid revision');
      }
      revision = Number.parseInt(digits, 10);
      if (Number.isNaN(revision) || revision < 1) {
        return err('ERR invalid revision');
      }
    }

    return ok({ cmd: 'GET', filename, revision });
  }

  if (command === 'LIST') {
    if (args.length !== 1) {
      return err('ERR usage: LIST dir');
    }

    const [dir] = args;

    if (!isValidName(dir, 'dir')) {
      return err('ERR illegal dir name');
    }

    return ok({ cmd: 'LIST', dirname: dir.endsWith('/') ? dir : `${dir}/` });
  }

  if (command === 'HELP') {
    return ok({ cmd: 'HELP' });
  }

  return err(`ERR illegal method: ${command}`);
};

async function* readData(
  socket: NodeJS.ReadableStream,
  logMessage: (arrow: '<--' | '-->', msg: string) => void,
) {
  const it = socket[Symbol.asyncIterator]();

  let expectedBytes: number | undefined;

  let buffer = Buffer.alloc(0);

  const readChunk = async () => {
    const { value: chunk, done } = await it.next();

    if (done) return false;

    assert(Buffer.isBuffer(chunk));

    buffer = Buffer.concat([buffer, chunk], buffer.byteLength + chunk.byteLength);
    return true;
  };

  while (true) {
    debug('here2');
    debug(expectedBytes, buffer.byteLength);

    if (expectedBytes) {
      if (buffer.byteLength >= expectedBytes) {
        debug('here3');
        yield ok(buffer.subarray(0, expectedBytes));
        buffer = buffer.subarray(expectedBytes);
        expectedBytes = undefined;
      } else if (!(await readChunk())) {
        return;
      }
      continue;
    }

    const newlineIndex = buffer.indexOf('\n');

    if (newlineIndex === -1) {
      debug('no newlines found');
      if (!(await readChunk())) return;

      continue;
    }

    const line = buffer.subarray(0, newlineIndex).toString('utf8');
    logMessage('-->', line);
    const result = parseCommand(line);
    buffer = buffer.subarray(newlineIndex + 1);
    if (!result.ok) {
      yield result;
    } else {
      if (result.value.cmd === 'PUT') {
        expectedBytes = result.value.length;
      }
      yield result;
    }

    debug('looping');
  }
}

export default async function* handleConnection(
  socket: NodeJS.ReadableStream,
  logMessage: (arrow: '<--' | '-->', msg: string) => void,
): AsyncGenerator<{ message: string; raw?: true }> {
  yield { message: READY };

  const it = readData(socket, logMessage);

  for (let { value: result } = await it.next(); result; { value: result } = await it.next()) {
    debug(result);
    if (!result.ok) {
      yield { message: result.error };
      continue;
    }

    const cmd = result.value;
    assert(!Buffer.isBuffer(cmd));

    switch (cmd.cmd) {
      case 'PUT': {
        const { filename } = cmd;

        debug('here1');
        const { value: data } = await it.next();
        debug('here4', data);

        assert(data?.ok && Buffer.isBuffer(data.value));
        const text = data.value.toString('ascii');

        if (!/^[\p{L}\p{P}\p{S}\s\p{N}]+$/u.test(text) || !isUtf8(data.value)) {
          yield { message: 'ERR invalid data' };
        } else {
          const revision = fs.write(filename, text);
          await fsp.writeFile('last.bin', data.value);
          yield { message: 'OK r' + revision };
        }
        break;
      }
      case 'GET': {
        const { filename, revision } = cmd;

        if (filename.endsWith('/')) {
          yield { message: 'ERR illegal file name' };
        } else {
          const contents = fs.get(filename)?.asFile()?.at(revision);

          if (contents == null) {
            yield { message: 'ERR no such file' };
          } else {
            yield { message: `OK ${contents.length}` };
            yield { message: contents, raw: true };
          }
        }
        break;
      }
      case 'LIST': {
        const { dirname } = cmd;
        const entries = fs.get(dirname)?.asDirectory()?.list() ?? [];
        yield { message: `OK ${entries.length}` };
        for (const entry of entries) {
          yield { message: entry.info() };
        }
        break;
      }
      case 'HELP':
        yield { message: 'OK usage: HELP|GET|PUT|LIST' };
        break;
      default: {
        const _: never = cmd;
        throw new Error(JSON.stringify(_));
      }
    }

    yield { message: READY };
  }
}
