import { readPacket } from "../utils.ts";

const port = Number(Deno.env.get("PORT") ?? "8080");

const listener = Deno.listen({ port });

type Message =
  | { type: "Q"; start: number; end: number }
  | { type: "I"; value: number; timestamp: number };

const parsePacket = (packet: Uint8Array): Message => {
  const type = String.fromCharCode(packet[0]);
  const view = new DataView(packet.buffer);
  const a = view.getInt32(1);
  const b = view.getInt32(5);

  if (type === "Q") return { type, start: a, end: b };
  if (type === "I") return { type, timestamp: a, value: b };
  throw new Error(packet.toString());
};

const handleConnection = async (conn: Deno.Conn) => {
  const storage = new Map<number, number>();
  const output = new Uint8Array(4);
  const outputView = new DataView(output.buffer);

  for await (const packet of readPacket(conn.readable, 9)) {
    try {
      const parsed = parsePacket(packet);
      if (parsed.type === "I") {
        storage.set(parsed.timestamp, parsed.value);
      } else {
        const { start, end } = parsed;
        let sum = 0;
        let count = 0;

        storage.forEach((value, key) => {
          if (key >= start && key <= end) {
            sum += value;
            count++;
          }
        });

        const result = count === 0 ? 0 : Math.round(sum / count);

        outputView.setInt32(0, result);
        await conn.write(output);
      }
    } catch {
      break;
    }
  }
};

for await (const socket of listener) {
  handleConnection(socket)
    .catch(console.error)
    .finally(() => {
      socket.close();
    })
    .catch(() => {});
}
