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

async function establishConnection
(
    fromChannel,
    toChannel,
    shareScreen,
    isInitiator,
    cbSuccess,
    cbError
)
{
    let signallingChannel = new SignallingChannel(fromChannel, toChannel);
    let dataChannel;
    let screenCaptureStream;
    const peerConnection = new RTCPeerConnection(servers);
    let descriptionReceived = false;
    let iceCandidatesQueue = [];

    // The initiator creates a data channel and the receiver receives it
    if (isInitiator) {
        if (shareScreen) {
            screenCaptureStream = await getScreenCaptureStream();
            for (const track of screenCaptureStream.getTracks()) {
                peerConnection.addTrack(track, screenCaptureStream);
            }
        } else {
            dataChannel = peerConnection.createDataChannel('sendDataChannel');
            dataChannel.onopen = () => {
                cbSuccess(dataChannel);
            };
        }
    } else {
        if (shareScreen) {
            peerConnection.ontrack = event => {
                console.log('stream received');
                screenCaptureStream = event.streams[0];
                cbSuccess(screenCaptureStream);
            };
        } else {
            peerConnection.ondatachannel = event => {
                dataChannel = event.channel;
                cbSuccess(dataChannel);
            };
        }
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

            if (isInitiator && shareScreen) {
                cbSuccess(screenCaptureStream);
            }
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
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        console.log('set local description');

        await signallingChannel.sendMessage('description', offer);
        console.log('sent description');
    }
}

function establishConnectionAsync
(
    fromChannel,
    toChannel,
    shareScreen,
    isInitiator
)
{
    return new Promise((resolve, reject) => {
        establishConnection(fromChannel, toChannel, shareScreen, isInitiator,
            resolve, reject);
    });
}

async function getScreenCaptureStream() {
    const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
            autoGainControl: false,
            echoCancellation: false,
            googAutoGainControl: false,
            noiseSuppression: false
        }
    });
    return stream;
}

async function initPeer(fromChannel, toChannel, shareScreen, isInitiator) {
    let webRtcResource = await establishConnectionAsync(fromChannel, toChannel,
        shareScreen, isInitiator);
    console.log('connection established');
    if (shareScreen) {
        const stream = webRtcResource;
        document.getElementById('test_video').srcObject = stream;
    } else {
        const dataChannel = webRtcResource;
        dataChannel.send('Hello, world!!');
        dataChannel.onmessage = message => {
            console.log('MESSAGE RECEIVED', message);
        };
    }
}

