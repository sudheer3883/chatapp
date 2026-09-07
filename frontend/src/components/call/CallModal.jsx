import React, { useState, useEffect, useRef } from 'react';
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  MonitorUp,
  Volume2,
  Maximize2,
} from 'lucide-react';
import Avatar from '../common/Avatar';
import { useSocket } from '../../context/SocketContext';
import { getEntityId } from '../../utils/chatHelpers';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export const CallModal = () => {
  const { socket, incomingCall, setIncomingCall, activeCall, setActiveCall } = useSocket();

  const [callStatus, setCallStatus] = useState('initiating'); // 'ringing' | 'connected' | 'ended'
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);

  const targetPeer = activeCall?.peerUser || incomingCall?.from;
  const isVideo = activeCall?.callType === 'video' || incomingCall?.callType === 'video';

  // -------------------------------------------------------------
  // Cleanup WebRTC Media Streams & PeerConnection
  // -------------------------------------------------------------
  const endCall = () => {
    if (socket && targetPeer) {
      socket.emit('call:end', { toUserId: getEntityId(targetPeer) });
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    setIncomingCall(null);
    setActiveCall(null);
    setCallStatus('ended');
  };

  // -------------------------------------------------------------
  // WebRTC Initialization
  // -------------------------------------------------------------
  useEffect(() => {
    if (!activeCall || !socket) return;

    const initWebRTC = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: isVideo ? { width: 1280, height: 720 } : false,
        });

        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        const pc = new RTCPeerConnection(ICE_SERVERS);
        peerConnectionRef.current = pc;

        // Push local tracks to peer connection
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        // Listen for remote tracks
        pc.ontrack = (event) => {
          if (remoteVideoRef.current && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        };

        // ICE candidate exchange
        pc.onicecandidate = (event) => {
          if (event.candidate && targetPeer) {
            socket.emit('call:ice_candidate', {
              toUserId: getEntityId(targetPeer),
              candidate: event.candidate,
            });
          }
        };

        // If initiating, create offer and send to recipient
        if (activeCall.isInitiator) {
          setCallStatus('ringing');
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          socket.emit('call:initiate', {
            toUserId: getEntityId(targetPeer),
            offer,
            callType: activeCall.callType,
          });
        } else if (activeCall.offer) {
          // If receiving, set remote offer and answer
          await pc.setRemoteDescription(new RTCSessionDescription(activeCall.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.emit('call:accept', {
            toUserId: getEntityId(targetPeer),
            answer,
          });
          setCallStatus('connected');
        }
      } catch (err) {
        console.error('[WebRTC] Media error:', err);
        endCall();
      }
    };

    initWebRTC();

    // Socket signaling listeners
    const handleAccepted = async ({ answer }) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        setCallStatus('connected');
      }
    };

    const handleIceCandidate = async ({ candidate }) => {
      if (peerConnectionRef.current && candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('[WebRTC] Error adding ICE candidate:', e);
        }
      }
    };

    const handleRejected = ({ reason }) => {
      alert(`Call declined: ${reason}`);
      endCall();
    };

    socket.on('call:accepted', handleAccepted);
    socket.on('call:ice_candidate', handleIceCandidate);
    socket.on('call:rejected', handleRejected);

    return () => {
      socket.off('call:accepted', handleAccepted);
      socket.off('call:ice_candidate', handleIceCandidate);
      socket.off('call:rejected', handleRejected);
    };
  }, [activeCall, socket]);

  // Accept incoming call from banner
  const handleAcceptIncoming = () => {
    setActiveCall({
      peerUser: incomingCall.from,
      callType: incomingCall.callType,
      isInitiator: false,
      offer: incomingCall.offer,
    });
    setIncomingCall(null);
  };

  // Reject incoming call
  const handleRejectIncoming = () => {
    if (socket && incomingCall) {
      socket.emit('call:reject', {
        toUserId: getEntityId(incomingCall.from),
        reason: 'Call declined',
      });
    }
    setIncomingCall(null);
  };

  // Toggle Audio Mute
  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted((prev) => !prev);
    }
  };

  // Toggle Camera
  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff((prev) => !prev);
    }
  };

  // Toggle Screen Sharing
  const toggleScreenShare = async () => {
    if (!peerConnectionRef.current) return;

    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];

        // Replace track in peer connection sender
        const sender = peerConnectionRef.current
          .getSenders()
          .find((s) => s.track && s.track.kind === 'video');

        if (sender) {
          sender.replaceTrack(screenTrack);
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        screenTrack.onended = () => {
          toggleScreenShare(); // Revert back when user stops sharing via browser UI
        };

        setIsScreenSharing(true);
      } catch (err) {
        console.error('[WebRTC] Screen sharing failed:', err);
      }
    } else {
      // Revert back to local camera track
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
      const sender = peerConnectionRef.current
        .getSenders()
        .find((s) => s.track && s.track.kind === 'video');

      if (sender && cameraTrack) {
        sender.replaceTrack(cameraTrack);
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      setIsScreenSharing(false);
    }
  };

  // -------------------------------------------------------------
  // 1. Incoming Call Notification Popup
  // -------------------------------------------------------------
  if (incomingCall && !activeCall) {
    return (
      <div className="fixed top-6 right-6 z-50 flex items-center gap-4 p-4 bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl animate-slide-up select-none">
        <Avatar
          src={incomingCall.from.profilePic?.url}
          name={incomingCall.from.displayName}
          size="lg"
          className="ring-2 ring-indigo-500 animate-pulse"
        />

        <div>
          <h4 className="text-sm font-semibold text-white">{incomingCall.from.displayName}</h4>
          <p className="text-xs text-zinc-400 capitalize">
            Incoming {incomingCall.callType} call...
          </p>
        </div>

        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={handleRejectIncoming}
            className="p-2.5 text-white bg-rose-600 hover:bg-rose-500 rounded-full transition-colors shadow-md"
            title="Decline"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
          <button
            onClick={handleAcceptIncoming}
            className="p-2.5 text-white bg-emerald-600 hover:bg-emerald-500 rounded-full transition-colors shadow-md animate-bounce"
            title="Accept"
          >
            <Phone className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 2. Active Call Canvas
  // -------------------------------------------------------------
  if (!activeCall) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl animate-fade-in select-none">
      <div className="relative w-full h-full flex flex-col justify-between p-6">
        {/* Top Header */}
        <div className="flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <Avatar
              src={targetPeer?.profilePic?.url}
              name={targetPeer?.displayName}
              size="md"
            />
            <div>
              <h3 className="text-base font-semibold text-white">{targetPeer?.displayName}</h3>
              <p className="text-xs text-indigo-400 font-medium capitalize">
                {callStatus === 'ringing' ? 'Calling...' : `${activeCall.callType} Call`}
              </p>
            </div>
          </div>
        </div>

        {/* Video / Audio Stage */}
        <div className="relative flex-1 flex items-center justify-center my-4 overflow-hidden rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl">
          {isVideo ? (
            <>
              {/* Remote Peer Video Stream */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover rounded-3xl"
              />

              {/* Local User Video PIP overlay */}
              <div className="absolute bottom-6 right-6 w-48 h-32 md:w-64 md:h-40 rounded-2xl overflow-hidden shadow-2xl ring-2 ring-white/10 bg-zinc-900">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
                />
                {isVideoOff && (
                  <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-zinc-500 text-xs font-medium">
                    Camera Off
                  </div>
                )}
              </div>
            </>
          ) : (
            // Audio-only call visualization
            <div className="flex flex-col items-center justify-center space-y-6">
              <div className="relative">
                <span className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" />
                <Avatar
                  src={targetPeer?.profilePic?.url}
                  name={targetPeer?.displayName}
                  size="2xl"
                  className="ring-8 ring-indigo-500/30"
                />
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white">{targetPeer?.displayName}</h2>
                <p className="text-sm text-zinc-400 mt-1">
                  {callStatus === 'connected' ? 'Audio Connected' : 'Calling...'}
                </p>
              </div>
              <audio ref={remoteVideoRef} autoPlay />
            </div>
          )}
        </div>

        {/* Bottom In-Call Controls Bar */}
        <div className="flex items-center justify-center gap-4 z-10 py-2">
          {/* Audio Mute Button */}
          <button
            onClick={toggleMute}
            className={`p-4 rounded-2xl transition-all shadow-lg ${
              isMuted ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'bg-zinc-800 text-white hover:bg-zinc-700'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          {/* Camera Toggle Button */}
          {isVideo && (
            <button
              onClick={toggleVideo}
              className={`p-4 rounded-2xl transition-all shadow-lg ${
                isVideoOff ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'bg-zinc-800 text-white hover:bg-zinc-700'
              }`}
              title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
            >
              {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
            </button>
          )}

          {/* Screen Sharing Button */}
          {isVideo && (
            <button
              onClick={toggleScreenShare}
              className={`p-4 rounded-2xl transition-all shadow-lg ${
                isScreenSharing ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-white hover:bg-zinc-700'
              }`}
              title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
            >
              <MonitorUp className="w-6 h-6" />
            </button>
          )}

          {/* End Call Button */}
          <button
            onClick={endCall}
            className="p-4 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl transition-all shadow-lg shadow-rose-600/30"
            title="End Call"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallModal;
