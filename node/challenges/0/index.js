import { createServer } from "net";

createServer((socket) => {
  socket.pipe(socket);
}).listen(process.env.PORT ?? 8080);
