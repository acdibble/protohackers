import { createServer, connect } from 'net';

const UPSTREAM_HOST = 'chat.protohackers.com';
const UPSTREAM_PORT = 16963;
const BIG_TONY_ADDRESS = '7YWHMfk9JZe0LM0g1ZauHuiSxhI';
const REGEX = /(?<=(^| ))7[\w\d]{25,34}(?=( |\n))/g;

/**
 * @param {import('net').Socket} src
 * @param {import('net').Socket} dest
 */
const rewrite = async (src, dest) => {
  let buf = Buffer.alloc(0);

  for await (const buffer of src) {
    buf = Buffer.concat([buf, buffer], buf.length + buffer.length);
    const index = buf.indexOf(10);
    if (index === -1) continue;

    const input = buf.subarray(0, index + 1).toString('utf8');
    buf = buf.subarray(index + 1);
    dest.write(input.replace(REGEX, BIG_TONY_ADDRESS));
  }

  dest.end();
};

createServer(async (socket) => {
  const upstream = connect({ host: UPSTREAM_HOST, port: UPSTREAM_PORT });
  await Promise.allSettled([rewrite(socket, upstream), rewrite(upstream, socket)]);
}).listen(Number(process.env.PORT) || 8080);
