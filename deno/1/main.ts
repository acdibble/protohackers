import { readLine } from "../utils.ts";

const port = Number(Deno.env.get("PORT") ?? "8080");

const listener = Deno.listen({ port });

type Command = { method: "isPrime"; number: number };

const parseLine = (line: Uint8Array): Command => {
  const payload: Partial<Command> = JSON.parse(new TextDecoder().decode(line));

  if (
    typeof payload === "object" &&
    "method" in payload &&
    payload.method === "isPrime" &&
    "number" in payload &&
    typeof payload.number === "number"
  ) {
    return payload as Command;
  }

  throw new Error();
};

const isPrime = (number: number) => {
  if (number === 2) return true;
  if (number < 2 || !Number.isInteger(number) || number % 2 === 0) return false;

  for (let i = 3; i < Math.ceil(Math.sqrt(number)); i += 2) {
    if (number % i === 0) return false;
  }

  return true;
};

const write = (conn: Deno.Conn, message: string) =>
  conn.write(new TextEncoder().encode(message + "\n"));

const handleConnection = async (conn: Deno.Conn) => {
  for await (const line of readLine(conn.readable)) {
    try {
      const { number } = parseLine(line);

      await write(
        conn,
        JSON.stringify({ method: "isPrime", prime: isPrime(number) })
      );
    } catch {
      await write(conn, "{}");
      break;
    }
  }

  conn.close();
};

for await (const socket of listener) {
  handleConnection(socket).catch(() => {});
}
