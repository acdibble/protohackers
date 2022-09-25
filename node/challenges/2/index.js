import { createServer, Socket } from 'net';

/**
 * @param {Buffer} message
 */
const processMessage = (message) => {
  const type = String.fromCharCode(message[0]);
  const a = message.readInt32BE(1);
  const b = message.readInt32BE(5);
  return { type, a, b };
};

/**
 * @param {Socket} socket
 */
async function* messages(socket) {
  let storage = Buffer.alloc(0);

  for await (const chunk of socket) {
    storage = Buffer.concat([storage, chunk], storage.length + chunk.length);
    while (storage.length >= 9) {
      yield processMessage(storage.subarray(0, 9));
      storage = storage.subarray(9);
    }
  }
}

createServer(async (socket) => {
  const store = new Map();
  const responseBuffer = Buffer.alloc(4);

  try {
    for await (const { type, a, b } of messages(socket)) {
      if (type === 'Q') {
        const values = [];

        store.forEach((value, key) => {
          if (key >= a && key <= b) {
            values.push(value);
          }
        });

        responseBuffer.writeInt32BE(0);

        if (values.length !== 0) {
          const average = Math.round(
            values.reduce((a, b) => a + b, 0) / values.length,
          );
          responseBuffer.writeInt32BE(average);
        }

        socket.write(responseBuffer);
      } else if (type === 'I') {
        store.set(a, b);
      } else {
        throw new Error();
      }
    }
  } catch {
    socket.end();
  }
}).listen(process.env.PORT ?? 8080);
