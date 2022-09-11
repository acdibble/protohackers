const port = Number(Deno.env.get("PORT") ?? "8080");

const listener = Deno.listen({ port });

const handleConnection = async (conn: Deno.Conn): Promise<void> => {
  for await (const buf of conn.readable) {
    await conn.write(buf);
  }

  conn.close();
};

for await (const socket of listener) {
  handleConnection(socket).catch(() => {});
}

export {};
