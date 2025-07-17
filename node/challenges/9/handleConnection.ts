import { z } from 'zod/v4';
import { createInterface } from 'readline/promises';

const Message = z.discriminatedUnion('request', [
  z.object({
    request: z.literal('get'),
    queues: z.array(z.string()),
    wait: z.boolean().optional(),
  }),
  z.object({
    job: z.unknown(),
    queue: z.string(),
    request: z.literal('put'),
    pri: z.number(),
  }),
  z.object({ id: z.number(), request: z.literal('abort') }),
  z.object({ id: z.number(), request: z.literal('delete') }),
]);

type Message = z.output<typeof Message>;

type Job = {
  id: number;
  job: unknown;
  pri: number;
  queue: string;
};

let idCounter = 0;

const queues = new Map<string, Job[]>();

const waitMap = new Map<
  string,
  { promise: Promise<Job>; resolve: (job: Job) => void; handled: boolean }[]
>();

const enqueueJob = (msg: Extract<Message, { request: 'put' }> | Job) => {
  let id = 'id' in msg ? msg.id : idCounter++;
  let queue = queues.get(msg.queue);
  if (!queue) {
    queue = [];
    queues.set(msg.queue, queue);
  }
  const waiter = waitMap.get(msg.queue)?.find((w) => !w.handled);
  const job = { id, job: msg.job, pri: msg.pri, queue: msg.queue };
  if (waiter) {
    waiter.handled = true;
    waiter.resolve(job);
    waitMap.delete(msg.queue);
  } else {
    queue.push(job);
    queue.sort((a, b) => a.pri - b.pri);
  }
  return id;
};

const findJob = (msg: Extract<Message, { request: 'get' }>) => {
  return msg.queues.reduce<Job | null>((acc, queueName) => {
    const job = queues.get(queueName)?.at(-1) ?? null;
    if (!job) return acc;
    if (!acc) return job;
    if (acc.pri > job.pri) return acc;
    return job;
  }, null);
};

const workerMap = new Map<NodeJS.ReadableStream, Job>();

const parseJSON = (data: string) => {
  try {
    return { ok: true as const, data: JSON.parse(data) };
  } catch {
    return { ok: false as const, error: 'Invalid JSON format' };
  }
};

export async function* handleConnection(socket: NodeJS.ReadableStream) {
  for await (const line of createInterface({ input: socket })) {
    console.log('<===', line);
    const json = parseJSON(line);
    if (!json.ok) {
      yield { status: 'error', error: json.error };
      continue;
    }

    const msgResult = Message.safeParse(json.data);
    if (!msgResult.success) {
      console.error(`Invalid message format: ${msgResult.error.message}`);
      console.error(line);
      yield { status: 'error' };
      continue;
    }

    const msg = msgResult.data;

    switch (msg.request) {
      case 'get': {
        let job = findJob(msg);
        if (job) {
          queues.get(job.queue)?.pop();
          workerMap.set(socket, job);
          yield { status: 'ok', ...job };
        } else if (msg.wait) {
          const { promise, resolve } = Promise.withResolvers<Job>();
          const waiter = { promise, resolve, handled: false };
          msg.queues.forEach((q) => {
            const waiters = waitMap.get(q) ?? [];
            waiters.push(waiter);
            waiter.promise = waiter.promise.finally(() => {
              waitMap.set(
                q,
                waiters.filter((w) => w !== waiter),
              );
            });
            waitMap.set(q, waiters);
          });
          job = await promise;
          workerMap.set(socket, job);
          yield { status: 'ok', ...job };
        } else {
          yield { status: 'no-job' };
        }
        break;
      }
      case 'put': {
        const id = enqueueJob(msg);
        yield { status: 'ok', id };
        break;
      }
      case 'abort': {
        const job = workerMap.get(socket);
        if (job) {
          enqueueJob(job);
          workerMap.delete(socket);
          yield { status: 'ok' };
        } else {
          yield { status: 'no-job' };
        }
        break;
      }
      case 'delete': {
        let status = 'no-job';
        for (const [, jobs] of queues) {
          const index = jobs.findIndex((j) => j.id === msg.id);
          if (index !== -1) {
            jobs.splice(index, 1);
            status = 'ok';
            break;
          }
        }
        if (status === 'no-job') {
          for (const [key, job] of workerMap) {
            if (job.id === msg.id) {
              workerMap.delete(key);
              status = 'ok';
              break;
            }
          }
        }
        yield { status };
        break;
      }
      default:
        const _: never = msg;
        throw new Error('unreachable', { cause: _ });
    }
  }

  const job = workerMap.get(socket);
  if (job) enqueueJob(job);
  workerMap.delete(socket);
}
