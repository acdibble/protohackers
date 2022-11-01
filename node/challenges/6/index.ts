import { createServer, Socket } from 'net';
import { on } from 'events';
import debug from 'debug';

enum Size {
  U16 = 2,
  U32 = 4,
}

enum ServerMessage {
  Error = 0x10,
  Ticket = 0x21,
  Heartbeat = 0x41,
}

enum ClientMessage {
  Plate = 0x20,
  WantHeartbeat = 0x40,
  IAmCamera = 0x80,
  IAmDispatcher = 0x81,
}

class ServerError extends Error {
  constructor(message: string) {
    super(message);

    Error.captureStackTrace(this, ServerError);
  }

  toMessage(): Buffer {
    return encodeError(this.message);
  }
}

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new ServerError(message);
}

const decodeString = (buffer: Buffer, offset: number): string => {
  const length = buffer[offset];
  assert(buffer.length > length + 1, 'buffer is too short');
  return buffer.subarray(offset + 1, offset + 1 + length).toString('utf8');
};

const encodeU8 = (value: number, destination: Buffer, offset: number): number => {
  destination[offset] = value;
  return 1;
};

const encodeString = (string: string, destination: Buffer, offset: number): number => {
  assert(string.length <= 255, 'string too long to encode');
  destination[offset] = string.length;
  destination.write(string, offset + 1, 'utf8');
  return 1 + string.length;
};

const encodeError = (message: string): Buffer => {
  const error = Buffer.alloc(2 + message.length);
  encodeU8(ServerMessage.Error, error, 0);
  encodeString(message, error, 1);
  return error;
};

const encodeU16 = (value: number, destination: Buffer, offset: number): number => {
  destination.writeUInt16BE(value, offset);
  return 2;
};

const encodeU32 = (value: number, destination: Buffer, offset: number): number => {
  destination.writeUInt32BE(value, offset);
  return 4;
};

type Location = { timestamp: number; mile: number };
const encodeTicket = (
  plate: string,
  road: number,
  location1: Location,
  location2: Location,
  speed: number,
): Buffer => {
  const ticket = Buffer.alloc(
    1 + // header
      Size.U16 + // road
      (1 + plate.length) + // encoded string
      (Size.U16 + Size.U32) * 2 + // each location
      Size.U16, // speed
  );
  let offset = encodeU8(ServerMessage.Ticket, ticket, 0);
  offset += encodeString(plate, ticket, offset);
  offset += encodeU16(road, ticket, offset);

  [location1, location2]
    .sort((a, b) => a.timestamp - b.timestamp)
    .forEach((location) => {
      offset += encodeU16(location.mile, ticket, offset);
      offset += encodeU32(location.timestamp, ticket, offset);
    });

  encodeU16(speed * 100, ticket, offset);
  return ticket;
};

type IAmCameraMessage = { type: 'I_AM_CAMERA'; road: number; mile: number; limit: number };
type IAmDispatcherMessage = { type: 'I_AM_DISPATCHER'; roads: number[] };
type HeartbeatMessage = { interval: number; type: 'HEARTBEAT' };

type Message =
  | { type: 'PLATE'; plate: string; timestamp: number }
  | IAmCameraMessage
  | IAmDispatcherMessage
  | HeartbeatMessage;

const parseMessage = (
  input: Buffer,
): { message: Message | HeartbeatMessage; length: number } | null => {
  assert(input.length !== 0, 'internal server error');
  switch (input[0]) {
    case ClientMessage.Plate: {
      const expectedLength = 1 + 1 + input[1] + Size.U32;
      if (input.length < expectedLength) return null;
      const plate = decodeString(input, 1);
      const timestamp = input.readUInt32BE(2 + plate.length);
      return { message: { plate, timestamp, type: 'PLATE' }, length: expectedLength };
    }
    case ClientMessage.WantHeartbeat: {
      const expectedLength = 1 + Size.U32;
      if (input.length < expectedLength) return null;

      const interval = input.readUInt32BE(1);
      return { message: { type: 'HEARTBEAT', interval }, length: expectedLength };
    }
    case ClientMessage.IAmCamera: {
      const expectedLength = 1 + Size.U16 * 3;
      if (input.length < expectedLength) return null;
      const road = input.readUInt16BE(1);
      const mile = input.readUInt16BE(3);
      const limit = input.readUInt16BE(5);
      return { message: { road, mile, limit, type: 'I_AM_CAMERA' }, length: expectedLength };
    }
    case ClientMessage.IAmDispatcher: {
      const roadCount = input[1];
      const offset = 2;
      const expectedLength = offset + roadCount * Size.U16;
      if (input.length < expectedLength) return null;
      const roads = new Array(roadCount);
      for (let i = 0; i < roadCount; i += 1) {
        roads[i] = input.readUint16BE(offset + Size.U16 * i);
      }
      return { message: { roads, type: 'I_AM_DISPATCHER' }, length: expectedLength };
    }
    default:
      throw new ServerError('illegal msg');
  }
};

async function* parseMessages(socket: Socket, log: debug.Debugger): AsyncGenerator<Message> {
  let input = Buffer.alloc(0);

  for await (const [buf] of on(socket, 'data')) {
    input = Buffer.concat([input, buf], input.length + buf.length);

    while (input.length !== 0) {
      log('input: %O', input);
      const result = parseMessage(input);
      if (result === null) break;
      const { message, length } = result;
      input = input.subarray(length);
      yield message;
    }
  }
}

const plates: Record<string, Record<number, Location[]>> = {};

type TicketInfo = { plate: string; ticket: Buffer; timestamps: [number, number] };

const tickets: Record<number, TicketInfo[]> = {};

const ticketedPlates: Record<number, Set<string>> = {};

const HEARTBEAT = Uint8Array.from([ServerMessage.Heartbeat]);

const handleClient = async (socket: Socket, log: debug.Debugger): Promise<void> => {
  let cameraInfo: IAmCameraMessage | null = null;
  let isDispatcher = false;
  let heartbeatReceived = false;

  for await (const message of parseMessages(socket, log)) {
    log('next message: %O', { message });

    if (message.type === 'I_AM_CAMERA') {
      assert(!isDispatcher, 'client is dispatcher');
      assert(cameraInfo === null, 'client is already camera');
      cameraInfo = message;
    } else if (message.type === 'PLATE') {
      assert(cameraInfo !== null, 'client is not camera');
      const { road, mile, limit } = cameraInfo;
      const { plate, timestamp } = message;
      const currentLocation = { mile, timestamp };
      plates[plate] ??= {};
      plates[plate][road] ??= [];
      const previousLocations = plates[plate][road];
      for (const previousLocation of previousLocations) {
        const changeInSeconds = currentLocation.timestamp - previousLocation.timestamp;
        if (changeInSeconds === 0) continue;
        const changeInDistance = currentLocation.mile - previousLocation.mile;
        const changeInHours = changeInSeconds / 3600;
        const speed = Math.round(Math.abs(changeInDistance / changeInHours));
        if (speed > limit) {
          const ticket = encodeTicket(plate, road, previousLocation, currentLocation, speed);
          tickets[road] ??= [];
          tickets[road].push({
            ticket,
            plate,
            timestamps: [previousLocation.timestamp, currentLocation.timestamp],
          });
        }
      }
      plates[plate][road].push(currentLocation);
    } else if (message.type === 'I_AM_DISPATCHER') {
      assert(cameraInfo === null, 'client is camera');
      assert(!isDispatcher, 'client is already dispatcher');
      isDispatcher = true;
      message.roads.forEach((road) => {
        const checkForTickets = () => {
          if (socket.closed) return;
          const ticketsAndPlates = tickets[road] ?? [];
          for (
            let current = ticketsAndPlates.shift();
            current !== undefined;
            current = ticketsAndPlates.shift()
          ) {
            const { ticket, plate, timestamps } = current;
            const day1 = Math.floor(timestamps[0] / 86400);
            const day2 = Math.floor(timestamps[1] / 86400);
            ticketedPlates[day1] ??= new Set();
            ticketedPlates[day2] ??= new Set();
            if (!ticketedPlates[day1].has(plate) && !ticketedPlates[day2].has(plate)) {
              ticketedPlates[day1].add(plate);
              ticketedPlates[day2].add(plate);
              log('wrote ticket for %O', plate);
              socket.write(ticket);
            }
          }

          setTimeout(checkForTickets, 100);
        };

        checkForTickets();
      });
    } else if (message.type === 'HEARTBEAT') {
      const { interval } = message;
      assert(!heartbeatReceived, 'already received heartbeat request');
      heartbeatReceived = true;
      if (interval !== 0) {
        const sendHeartbeat = () => {
          if (socket.closed) return;
          socket.write(HEARTBEAT);
          setTimeout(sendHeartbeat, interval * 100);
        };
        sendHeartbeat();
      }
    }
  }
};

let id = 0;

createServer(async (socket) => {
  const log = debug(`traffic:${++id}`);
  log('new connection');
  socket.once('end', () => log('connection ended'));

  try {
    await handleClient(socket, log);
  } catch (error) {
    log('error', error);
    if (error instanceof ServerError) {
      socket.write(error.toMessage());
    }
  }

  socket.end();
}).listen(Number(process.env.PORT) || 8080, () => {
  console.log('listening on 8080...');
});
