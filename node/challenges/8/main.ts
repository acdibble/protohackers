import { createServer } from 'net';
import { handleConnection } from './handleConnection';

const server = createServer(async (socket) => {
  try {
    for await (const msg of handleConnection(socket)) {
      socket.write(Uint8Array.from(msg));
    }
  } catch (error) {
    console.error('Error handling connection:', error);
  } finally {
    socket.end();
  }
}).listen({
  host: '0.0.0.0',
  port: 8080,
});
