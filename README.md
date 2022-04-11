# WebRTC Getting Started

In the server folder, run `npm install` to install dependencies. Then run `node server.js` to start the server on the specified port.
In the client folder, serve the folder. For example, one way of doing this is by running `static-server`.

Open two instances of main.html on localhost (on same or different computer). In the browser console, run `initializingPeer({fromChannel}, {toChannel})` on the initializing peer. Run `receivingPeer({fromChannel}, {toChannel})` on the receiving peer. You will want the receiver fromChannel == initializer toChannel, and receiver toChannel == initializer fromChannel.
For example, `initializingPeer("1", "2")` and `receivingPeer("2", "1")`.
