import { createInterface } from 'readline/promises';
import { createServer } from 'net';
import { EventEmitter } from 'events';

const room = new Set();
const emitter = new EventEmitter();

/**
 * @param {string | null} author
 * @param {string} message
 */
const formatMessage = (author, message) =>
  (author === null ? message : `[${author}] ${message}`) + '\n';

/**
 * @param {string | null} author
 * @param {string} message
 */
const sendMessage = (author, message) => emitter.emit('msg', author, message);

/**
 * @param {string} name
 * @param {import('net').Socket} socket
 */
const listenForMessages = (name, socket) => {
  const handleMessage = (author, message) => {
    if (author === name) return;
    if (socket.closed) {
      emitter.off('msg', handleMessage);
    } else {
      socket.write(formatMessage(author, message));
    }
  };

  emitter.on('msg', handleMessage);
  return () => emitter.off('msg', handleMessage);
};

createServer(async (socket) => {
  const rl = createInterface({ input: socket, output: socket });
  const name = await rl.question('Welcome to budgetchat! What shall I call you?\n');

  if (!/^[\w\d]+$/.test(name) || room.has(name)) {
    socket.end();
    return;
  }

  if (socket.closed) return;

  socket.write(formatMessage(null, `* The room contains: ${[...room].join(', ')}`));
  room.add(name);
  sendMessage(null, `* ${name} has entered the room`);

  const stop = listenForMessages(name, socket);
  rl.on('line', (line) => sendMessage(name, line));

  socket.on('close', () => {
    stop();
    rl.close();
    room.delete(name);
    sendMessage(null, `* ${name} has left the room`);
  });
}).listen(Number(process.env.PORT) || 8080);
