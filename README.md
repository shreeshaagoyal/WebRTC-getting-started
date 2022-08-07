# WebRTC Getting Started

In the server folder, run `npm install` to install dependencies. Then run `node server.js` to start the server on the specified port.
In the client folder, serve the folder. For example, one way of doing this is by running `static-server`.

Open two instances of main.html on localhost (on same or different computer). In the browser console, run `initializingPeer({fromChannel}, {toChannel})` on the initializing peer. Run `receivingPeer({fromChannel}, {toChannel})` on the receiving peer. You will want the receiver fromChannel == initializer toChannel, and receiver toChannel == initializer fromChannel.
For example, `initializingPeer("1", "2")` and `receivingPeer("2", "1")`.

## Setting up a STUN/TURN server
- Docker-compose with this file:
  - https://github.com/coturn/coturn/blob/master/docker/docker-compose-all.yml
- Add username/password in this file:
  - https://github.com/coturn/coturn/blob/master/docker/coturn/turnserver.conf
  - user=username:password
- Port is 3478 for both STUN and TURN
- Open up the relay ports too in docker compose config
