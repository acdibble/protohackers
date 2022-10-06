import dgram from 'dgram';

const server = dgram.createSocket('udp4');

const store = new Map([['version', "Ken's Key-Value Store 1.0"]]);

server.on('error', (err) => {
  console.log(`server error:\n${err.stack}`);
  server.close();
});

server.on('message', (msg, rinfo) => {
  const string = msg.toString();
  console.log(`server got: %O from %s:%d`, string, rinfo.address, rinfo.port);
  const index = string.indexOf('=');
  if (index !== -1) {
    const key = string.slice(0, index);
    if (key === 'version') return;
    const value = string.slice(index + 1);
    store.set(key, value);
  } else {
    const value = store.get(string) || '';
    server.send(`${string}=${value}`, rinfo.port, rinfo.address);
  }
});

server.on('listening', () => {
  const address = server.address();
  console.log(`server listening ${address.address}:${address.port}`);
});

server.bind(8080, 'fly-global-services');
