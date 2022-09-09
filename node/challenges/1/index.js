import { createServer } from "net";
import { createInterface } from "readline";

const isPrime = (number) => {
  if (number % 2 === 0 || number < 2 || !Number.isInteger(number)) return false;

  for (let i = 3; i <= Math.ceil(Math.sqrt(number)); i += 2) {
    if (number % i === 0) return false;
  }

  return true;
};

createServer(async (socket) => {
  try {
    for await (const line of createInterface(socket)) {
      const packet = JSON.parse(line);

      if (packet.method !== "isPrime" || typeof packet.number !== "number") {
        throw new Error();
      }

      socket.write(
        JSON.stringify({ method: "isPrime", prime: isPrime(packet.number) }) +
          "\n"
      );
    }
  } catch {
    socket.write("{}\n");
    socket.end();
  }
}).listen(process.env.PORT ?? 8080);
