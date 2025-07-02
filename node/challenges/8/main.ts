import { createServer } from 'net';
import { handleConnection } from './handleConnection.js';

createServer(async (socket) => {
  socket.on('error', (err) => {
    console.error('Socket error:', err);
  });

  try {
    for await (const msg of handleConnection(socket)) {
      if (socket.closed) return;
      const string = JSON.stringify(msg);
      console.log('===>', string);
      socket.write(string);
      socket.write('\n');
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
