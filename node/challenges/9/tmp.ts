import { randomInt } from 'crypto';
import { connect, Socket } from 'net';
import { stdout } from 'process';
import { createInterface } from 'readline/promises';

type Command =
  | { cmd: 'PUT'; file: string; size: number } //
  | { cmd: 'GET'; file: string; revision?: number }
  | { cmd: 'LIST'; dir: string };

const lines: Command[] = [
  { cmd: 'PUT', file: '/test.txt', size: 14 },
  { cmd: 'GET', file: '/test.txt' },
  { cmd: 'GET', file: '/test.txt' },
  { cmd: 'PUT', file: '/test2.txt', size: 27 },
  { cmd: 'PUT', file: '/test3.txt', size: 19 },
  { cmd: 'LIST', dir: '/' },
  { cmd: 'LIST', dir: '/' },
  { cmd: 'PUT', file: '/kilo.0001/LICENSE', size: 1330 },
  { cmd: 'PUT', file: '/kilo.0001/Makefile', size: 91 },
  { cmd: 'PUT', file: '/kilo.0001/README.md', size: 735 },
  { cmd: 'PUT', file: '/kilo.0001/TODO', size: 204 },
  { cmd: 'PUT', file: '/kilo.0001/kilo.c', size: 40314 },
  { cmd: 'PUT', file: '/kilo.0001/LICENSE', size: 1330 },
  { cmd: 'PUT', file: '/kilo.0001/Makefile', size: 91 },
  { cmd: 'PUT', file: '/kilo.0001/README.md', size: 735 },
  { cmd: 'PUT', file: '/kilo.0001/TODO', size: 204 },
  { cmd: 'PUT', file: '/kilo.0001/kilo.c', size: 40314 },
  { cmd: 'PUT', file: '/kilo.0001/LICENSE', size: 1330 },
  { cmd: 'PUT', file: '/kilo.0001/Makefile', size: 91 },
  { cmd: 'PUT', file: '/kilo.0001/README.md', size: 818 },
  { cmd: 'PUT', file: '/kilo.0001/TODO', size: 204 },
  { cmd: 'PUT', file: '/kilo.0001/kilo.c', size: 40314 },
  { cmd: 'PUT', file: '/kilo.0001/LICENSE', size: 1330 },
  { cmd: 'PUT', file: '/kilo.0001/Makefile', size: 91 },
  { cmd: 'PUT', file: '/kilo.0001/README.md', size: 820 },
  { cmd: 'PUT', file: '/kilo.0001/TODO', size: 204 },
  { cmd: 'PUT', file: '/kilo.0001/kilo.c', size: 40314 },
  { cmd: 'PUT', file: '/kilo.0001/LICENSE', size: 1330 },
  { cmd: 'PUT', file: '/kilo.0001/Makefile', size: 91 },
  { cmd: 'PUT', file: '/kilo.0001/README.md', size: 828 },
  { cmd: 'PUT', file: '/kilo.0001/TODO', size: 204 },
  { cmd: 'PUT', file: '/kilo.0001/kilo.c', size: 40314 },
  { cmd: 'PUT', file: '/kilo.0001/LICENSE', size: 1330 },
  { cmd: 'PUT', file: '/kilo.0001/Makefile', size: 91 },
  { cmd: 'PUT', file: '/kilo.0001/README.md', size: 828 },
  { cmd: 'PUT', file: '/kilo.0001/TODO', size: 204 },
  { cmd: 'PUT', file: '/kilo.0001/kilo.c', size: 40294 },
  { cmd: 'PUT', file: '/kilo.0001/LICENSE', size: 1330 },
  { cmd: 'PUT', file: '/kilo.0001/Makefile', size: 91 },
  { cmd: 'PUT', file: '/kilo.0001/README.md', size: 828 },
  { cmd: 'PUT', file: '/kilo.0001/TODO', size: 204 },
  { cmd: 'PUT', file: '/kilo.0001/kilo.c', size: 40340 },
  { cmd: 'PUT', file: '/kilo.0001/LICENSE', size: 1330 },
  { cmd: 'PUT', file: '/kilo.0001/Makefile', size: 91 },
  { cmd: 'PUT', file: '/kilo.0001/README.md', size: 828 },
  { cmd: 'PUT', file: '/kilo.0001/TODO', size: 204 },
  { cmd: 'PUT', file: '/kilo.0001/kilo.c', size: 40324 },
  { cmd: 'PUT', file: '/kilo.0001/LICENSE', size: 1330 },
  { cmd: 'PUT', file: '/kilo.0001/Makefile', size: 91 },
  { cmd: 'PUT', file: '/kilo.0001/README.md', size: 828 },
  { cmd: 'PUT', file: '/kilo.0001/TODO', size: 204 },
  { cmd: 'PUT', file: '/kilo.0001/kilo.c', size: 40324 },
  { cmd: 'PUT', file: '/kilo.0001/LICENSE', size: 1330 },
  { cmd: 'PUT', file: '/kilo.0001/Makefile', size: 91 },
  { cmd: 'PUT', file: '/kilo.0001/README.md', size: 828 },
  { cmd: 'PUT', file: '/kilo.0001/TODO', size: 204 },
  { cmd: 'PUT', file: '/kilo.0001/kilo.c', size: 40350 },
  { cmd: 'PUT', file: '/kilo.0001/LICENSE', size: 1330 },
  { cmd: 'PUT', file: '/kilo.0001/Makefile', size: 91 },
  { cmd: 'PUT', file: '/kilo.0001/README.md', size: 828 },
  { cmd: 'PUT', file: '/kilo.0001/TODO', size: 204 },
  { cmd: 'PUT', file: '/kilo.0001/kilo.c', size: 40330 },
  { cmd: 'PUT', file: '/kilo.0001/LICENSE', size: 1330 },
  { cmd: 'PUT', file: '/kilo.0001/Makefile', size: 91 },
  { cmd: 'PUT', file: '/kilo.0001/README.md', size: 828 },
  { cmd: 'PUT', file: '/kilo.0001/TODO', size: 204 },
  { cmd: 'PUT', file: '/kilo.0001/kilo.c', size: 40901 },
  { cmd: 'PUT', file: '/kilo.0001/LICENSE', size: 1330 },
  { cmd: 'PUT', file: '/kilo.0001/Makefile', size: 91 },
  { cmd: 'PUT', file: '/kilo.0001/README.md', size: 828 },
  { cmd: 'PUT', file: '/kilo.0001/TODO', size: 204 },
  { cmd: 'PUT', file: '/kilo.0001/kilo.c', size: 41256 },
  { cmd: 'PUT', file: '/kilo.0001/LICENSE', size: 1330 },
  { cmd: 'PUT', file: '/kilo.0001/Makefile', size: 91 },
  { cmd: 'PUT', file: '/kilo.0001/README.md', size: 828 },
  { cmd: 'PUT', file: '/kilo.0001/TODO', size: 204 },
  { cmd: 'PUT', file: '/kilo.0001/kilo.c', size: 41331 },
  { cmd: 'PUT', file: '/kilo.0001/LICENSE', size: 1330 },
  { cmd: 'PUT', file: '/kilo.0001/Makefile', size: 91 },
  { cmd: 'PUT', file: '/kilo.0001/README.md', size: 828 },
  { cmd: 'PUT', file: '/kilo.0001/TODO', size: 204 },
  { cmd: 'PUT', file: '/kilo.0001/kilo.c', size: 41435 },
  { cmd: 'PUT', file: '/kilo.0001/LICENSE', size: 1330 },
  { cmd: 'PUT', file: '/kilo.0001/Makefile', size: 91 },
  { cmd: 'PUT', file: '/kilo.0001/README.md', size: 828 },
  { cmd: 'PUT', file: '/kilo.0001/TODO', size: 204 },
  { cmd: 'PUT', file: '/kilo.0001/kilo.c', size: 41331 },
  { cmd: 'PUT', file: '/kilo.0001/LICENSE', size: 1330 },
  { cmd: 'PUT', file: '/kilo.0001/Makefile', size: 91 },
  { cmd: 'PUT', file: '/kilo.0001/README.md', size: 828 },
  { cmd: 'PUT', file: '/kilo.0001/TODO', size: 204 },
  { cmd: 'PUT', file: '/kilo.0001/kilo.c', size: 41578 },
  { cmd: 'PUT', file: '/kilo.0001/LICENSE', size: 1330 },
  { cmd: 'PUT', file: '/kilo.0001/Makefile', size: 91 },
  { cmd: 'PUT', file: '/kilo.0001/README.md', size: 828 },
  { cmd: 'PUT', file: '/kilo.0001/TODO', size: 204 },
  { cmd: 'PUT', file: '/kilo.0001/kilo.c', size: 41598 },
  { cmd: 'PUT', file: '/kilo.0001/LICENSE', size: 1330 },
  { cmd: 'PUT', file: '/kilo.0001/Makefile', size: 91 },
  { cmd: 'PUT', file: '/kilo.0001/README.md', size: 828 },
  { cmd: 'PUT', file: '/kilo.0001/TODO', size: 204 },
  { cmd: 'PUT', file: '/kilo.0001/kilo.c', size: 41598 },
  { cmd: 'GET', file: '/kilo.0001/README.md' },
  { cmd: 'GET', file: '/kilo.0001/TODO', revision: 1 },
  { cmd: 'GET', file: '/kilo.0001/LICENSE', revision: 1 },
  { cmd: 'GET', file: '/kilo.0001/LICENSE' },
  { cmd: 'GET', file: '/kilo.0001/TODO' },
  { cmd: 'GET', file: '/kilo.0001/kilo.c', revision: 10 },
  { cmd: 'GET', file: '/kilo.0001/Makefile' },
  { cmd: 'GET', file: '/kilo.0001/kilo.c', revision: 9 },
  { cmd: 'GET', file: '/kilo.0001/kilo.c', revision: 6 },
  { cmd: 'GET', file: '/kilo.0001/kilo.c' },
  { cmd: 'GET', file: '/kilo.0001/kilo.c', revision: 7 },
  { cmd: 'GET', file: '/kilo.0001/kilo.c', revision: 12 },
  { cmd: 'GET', file: '/kilo.0001/README.md', revision: 4 },
  { cmd: 'GET', file: '/kilo.0001/kilo.c', revision: 3 },
  { cmd: 'GET', file: '/kilo.0001/kilo.c', revision: 14 },
  { cmd: 'GET', file: '/kilo.0001/kilo.c', revision: 11 },
  { cmd: 'GET', file: '/kilo.0001/kilo.c', revision: 8 },
  { cmd: 'GET', file: '/kilo.0001/Makefile', revision: 1 },
  { cmd: 'GET', file: '/kilo.0001/kilo.c', revision: 4 },
  { cmd: 'GET', file: '/kilo.0001/README.md', revision: 3 },
  { cmd: 'LIST', dir: '/' },
  { cmd: 'LIST', dir: '/kilo.0001' },
  { cmd: 'GET', file: '/kilo.0001/', revision: 1 },
];

const socket = await new Promise<Socket>((resolve) => {
  const s = connect(30307, 'vcs.protohackers.com', () => resolve(s));
});

const write = async (line: string) => {
  console.log('<--', line);
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  socket.write(line + '\n', (err) => (err ? reject(err) : resolve()));
  await promise;
};

const it = createInterface({ input: socket })[Symbol.asyncIterator]();

socket.on('data', (data) => {
  stdout.write(data);
});

const awaitReady = async () => {
  for (
    let { value: line } = await it.next();
    line !== undefined;
    { value: line } = await it.next()
  ) {
    // console.log('-->', line);
    if (line.trim().toUpperCase() === 'READY') {
      break;
    }
  }
};

const ALPHANUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

for (const line of lines) {
  await awaitReady();

  if (line.cmd === 'GET') {
    let msg = `${line.cmd} ${line.file}`;
    if (line.revision) msg += ` r${line.revision}`;
    await write(msg);
  } else if (line.cmd === 'PUT') {
    const size = Math.min(line.size, 5);
    await write(`PUT ${line.file} ${size}`);
    const file = Array.from(
      { length: size - 1 },
      () => ALPHANUMERIC[randomInt(ALPHANUMERIC.length)],
    ).join('');
    await write(file);
  } else if (line.cmd === 'LIST') {
    await write(`LIST ${line.dir}`);
  }
}
