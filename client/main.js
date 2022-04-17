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

const servers = {
    'iceServers': [
        {'urls': 'stun:stun.l.google.com:19302'},
        // {
        //     'urls': 'turn:198.199.104.53:3478',
        //     'username': 'hello',
        //     'credential': 'sn0lxJKM1mkFebzEnKI',
        //     'maxRateKbps': '8000'
        // }
    ]
};

function establishConnection(fromChannel, toChannel, isInitiator) {
    let signallingChannel = new SignallingChannel(fromChannel, toChannel);

    let dataChannel;
    const peerConnection = new RTCPeerConnection(servers);
    let descriptionReceived = false;
    let iceCandidatesQueue = [];

    // The initiator creates a data channel and the receiver receives it
    if (isInitiator) {
        dataChannel = peerConnection.createDataChannel('sendDataChannel');
        dataChannel.onopen = () => {
            dataChannel.send('Hello, world!!');
        };
    } else {
        peerConnection.ondatachannel = event => {
            dataChannel = event.channel;
            dataChannel.onmessage = message => {
                console.log('MESSAGE RECEIVED', message);
            };
        };
    }

    // Listen for local ICE candidates on the local RTCPeerConnection
    peerConnection.addEventListener('icecandidate', async event => {
        console.log('icecandidate event generated');
        if (event.candidate) {
            await signallingChannel.sendMessage('ice', event.candidate);
            console.log("sending ice candidate");
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

    let applyPendingIceMsgs = async function() {
        while (iceCandidatesQueue.length > 0) {
            let iceMsg = iceCandidatesQueue.shift();

            try {
                await peerConnection.addIceCandidate(iceMsg);
                console.log("applying ice candidate");
            } catch (e) {
                console.error('Error applying ice candidate', e);
            }
        }
    };

    let onIceCandidateMsg = async function(iceMsg) {
        iceCandidatesQueue.push(iceMsg);

        // Have to wait for description before we can do anything with this
        // ice message
        if (descriptionReceived) {
            await applyPendingIceMsgs();
        }
    };

    let onDescriptionMsg = async function(descriptionMsg) {
        descriptionReceived = true;

        const remoteDesc = new RTCSessionDescription(descriptionMsg);
        await peerConnection.setRemoteDescription(remoteDesc);
        console.log('set remote description');

        if (!isInitiator) {
            let answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            console.log('set local description');

            await signallingChannel.sendMessage('description', answer);
            console.log('sent description');
        }

        // Now that we have a description, we can apply any ice candidate messages
        // we received before and queued
        await applyPendingIceMsgs();
    };

    signallingChannel.addMessageReceiveCallback(async message => {
        if (message.type == 'ice') {
            await onIceCandidateMsg(message.body);
        } else if (message.type == 'description') {
            await onDescriptionMsg(message.body);
        } else {
            console.log(`Invalid message type: ${message.type}`);
        }
    });

    if (isInitiator) {
        (async () => {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            console.log('set local description');

            await signallingChannel.sendMessage('description', offer);
            console.log('sent description');
        })();
    }
}

async function initiatingPeer(fromChannel, toChannel) {
    establishConnection(fromChannel, toChannel, true);
}

async function receivingPeer(fromChannel, toChannel) {
    establishConnection(fromChannel, toChannel, false);
}

