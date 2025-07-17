import { createServer } from 'net';
import handleConnection from './handleConnection.js';

const writeLine = async (socket: NodeJS.WritableStream, data: string, append: string) => {
  const { promise, resolve, reject } = Promise.withResolvers<void>();

  socket.write(data + append, (err) => {
    if (err) {
      reject(err);
    } else {
      resolve();
    }
  });

  return promise;
};

let counter = 0;

createServer(async (socket) => {
  const id = ++counter;

  const logMessage = (arrow: '<--' | '-->', msg: string) =>
    console.log(arrow, id.toString().padStart(4), msg);

  for await (const { message, raw } of handleConnection(socket, logMessage)) {
    const index = message.indexOf('\n');
    // Process each line received from the socket
    logMessage('<--', index === -1 ? message : message.slice(0, index) + '...');
    await writeLine(socket, message, raw ? '' : '\n');
  }
}).listen(8080, '0.0.0.0', () => {
  console.log('Server is listening on port 8080');
});
