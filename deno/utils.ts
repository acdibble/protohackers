export async function* readLine(readable: AsyncIterable<Uint8Array>) {
  for await (const buf of readable) {
    let startIndex = 0;

    while (startIndex < buf.length) {
      const endIndex = buf.indexOf(10, startIndex);

      yield buf.subarray(startIndex, endIndex);

      startIndex = endIndex + 1;
    }
  }
}

export async function* readPacket(
  readable: AsyncIterable<Uint8Array>,
  packetSize: number
) {
  const buffer = [];

  for await (const buf of readable) {
    buffer.push(...buf);

    while (buffer.length >= packetSize) {
      yield Uint8Array.from(buffer.splice(0, packetSize));
    }
  }
}
