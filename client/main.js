console.log("hello world");

class SignallingChannel {
    constructor(fromChannel, toChannel) {
        this.fromChannel = fromChannel;
        this.toChannel = toChannel;
        this.baseAddress = window.location.protocol + '//' +
            window.location.hostname + ':3000';
    }

    async sendMessage(type, body) {
        let message = JSON.stringify({
            type: type,
            body: body
        });

        let res = await fetch(`${this.baseAddress}/send_message`, {
            method: "POST",
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({
                message: message,
                channel: this.toChannel
            })
        });

        console.log(`Sent type ${type} body ${body} to channel ${this.toChannel}`);
    }

    async receiveMessage() {
        let res = await fetch(`${this.baseAddress}/receive_message`, {
            method: "POST",
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({
                channel: this.fromChannel
            })
        });

        let message = JSON.parse(await res.text());
        console.log(`Received type ${message.type} body ${message.body} from `+
            `channel ${this.fromChannel}`);
        return message;
    }

    async addMessageReceiveCallback(cb) {
        while (true) {
            let message = await this.receiveMessage();
            if (message) {
                cb(message);
            }
        }
    }
}

async function gatherIceCandidates
(
    peerConnection, signallingChannel, isReceivingPeer
) {
    console.log('starting to gather ice candidates');

    // Listen for local ICE candidates on the local RTCPeerConnection
    peerConnection.addEventListener('icecandidate', async event => {
        console.log('icecandidate event');
        if (event.candidate) {
            await signallingChannel.sendMessage('ice', event.candidate);
            console.log("sending ice candidate");
        }
    });

    // Listen for remote ICE candidates and add them to the local RTCPeerConnection
    signallingChannel.addMessageReceiveCallback(async message => {
        if (message.type == 'ice') {
            try {
                await peerConnection.addIceCandidate(message.body);
                console.log("received ice candidate");
            } catch (e) {
                console.error('Error adding received ice candidate', e);
            }
        } else if (message.type == 'description') {
            const remoteDesc = new RTCSessionDescription(message.body);
            await peerConnection.setRemoteDescription(remoteDesc);
            console.log('set remote description');

            if (isReceivingPeer) {
                let answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                console.log('set local description');

                await signallingChannel.sendMessage('description', answer);
                console.log('sent description');
            }
        }
    });

    // Listen for connectionstatechange on the local RTCPeerConnection
    peerConnection.addEventListener('connectionstatechange', _ => {
        console.log(`connection state changed: ${peerConnection.connectionState}`);
        if (peerConnection.connectionState === 'connected') {
            // Peers connected!
            console.log('peer connected!');
        }
    });
}

async function initiatingPeer(fromChannel, toChannel) {
    const configuration = {'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}]}
    const peerConnection = new RTCPeerConnection(configuration);

    let sendChannel = peerConnection.createDataChannel('sendDataChannel');
    let signallingChannel = new SignallingChannel(fromChannel, toChannel);

    gatherIceCandidates(peerConnection, signallingChannel, false);

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    console.log('set local description');

    await signallingChannel.sendMessage('description', offer);
    console.log('sent description');

    sendChannel.onopen = () => {
        sendChannel.send('Hello, world!!');
    };
}

async function receivingPeer(fromChannel, toChannel) {
    const configuration = {'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}]}
    const peerConnection = new RTCPeerConnection(configuration);

    peerConnection.ondatachannel = event => {
        let channel = event.channel;
        channel.onmessage = message => {
            console.log('MESSAGE RECEIVED', message);
        };
    };

    let signallingChannel = new SignallingChannel(fromChannel, toChannel);

    gatherIceCandidates(peerConnection, signallingChannel, true);
}

