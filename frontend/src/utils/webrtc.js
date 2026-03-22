const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export function createPeerConnection() {
  return new RTCPeerConnection(ICE_SERVERS);
}

export async function createOffer(pc) {
  const offer = await pc.createOffer({
    offerToReceiveVideo: false, // Host only sends, never receives
    offerToReceiveAudio: false,
  });
  await pc.setLocalDescription(offer);
  return offer;
}

export async function createAnswer(pc, offer) {
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  return answer;
}

export async function handleAnswer(pc, answer) {
  if (pc.signalingState === 'have-local-offer') {
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  }
}

// ICE candidate queue — buffers candidates until remoteDescription is set
export function createIceCandidateQueue(pc) {
  const queue = [];
  let flushed = false;

  const flush = async () => {
    flushed = true;
    for (const c of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch (e) {
        console.warn('ICE flush error:', e);
      }
    }
    queue.length = 0;
  };

  const add = async (candidate) => {
    if (!candidate) return;
    if (flushed && pc.remoteDescription) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('ICE add error:', e);
      }
    } else {
      queue.push(candidate);
    }
  };

  return { add, flush };
}
