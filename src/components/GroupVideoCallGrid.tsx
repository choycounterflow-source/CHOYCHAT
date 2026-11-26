import React, { useEffect, useRef } from 'react';
import { Mic, Users, Video, VideoOff } from 'lucide-react';

export interface RemoteCallPeer {
  peerId: string;
  peerName: string;
  avatar?: string;
  stream: MediaStream | null;
  hasVideo: boolean;
  connectionState: string;
}

interface RemotePeerVideoTileProps {
  peer: RemoteCallPeer;
  defaultAvatar: string;
  singleFullBleed: boolean;
}

const RemotePeerVideoTile: React.FC<RemotePeerVideoTileProps> = ({
  peer,
  defaultAvatar,
  singleFullBleed,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.srcObject !== peer.stream) {
      el.srcObject = peer.stream;
    }
    if (peer.stream) {
      el.play().catch(() => {});
    }
  }, [peer.stream, peer.hasVideo]);

  return (
    <div
      className={`relative w-full h-full min-h-[160px] bg-slate-900 overflow-hidden flex items-center justify-center ${
        singleFullBleed ? '' : 'rounded-2xl border border-emerald-500/35 shadow-lg'
      }`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`w-full h-full object-cover ${peer.stream && peer.hasVideo ? 'block' : 'hidden'}`}
      />

      {(!peer.stream || !peer.hasVideo) && (
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/90 via-slate-950 to-slate-950 flex flex-col items-center justify-center p-4 text-center space-y-2.5">
          <img
            src={peer.avatar || defaultAvatar}
            alt={peer.peerName}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-emerald-400/70 shadow-lg"
          />
          <div className="text-sm font-black text-white truncate max-w-full">{peer.peerName}</div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-white/10 text-[11px] font-semibold text-emerald-300">
            <Mic className="w-3.5 h-3.5" />
            <span>
              {peer.connectionState === 'connected' ? 'Audio Live' : 'Connecting video...'}
            </span>
          </div>
        </div>
      )}

      {/* Participant Name Badge */}
      <div className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-xl bg-slate-950/80 border border-white/15 backdrop-blur-sm text-white text-xs font-bold flex items-center gap-1.5 max-w-[75%]">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            peer.connectionState === 'connected' ? 'bg-emerald-400' : 'bg-amber-400 motion-safe:animate-pulse'
          }`}
        />
        <span className="truncate">{peer.peerName}</span>
      </div>
    </div>
  );
};

interface GroupVideoCallGridProps {
  peers: RemoteCallPeer[];
  isGroupCall: boolean;
  callTitle: string;
  callStatus: 'idle' | 'calling' | 'ringing' | 'connected' | 'error';
  callError: string;
  callPeerOfflineHint: boolean;
  defaultAvatar: string;
  onRetry: () => void;
}

export const GroupVideoCallGrid: React.FC<GroupVideoCallGridProps> = ({
  peers,
  isGroupCall,
  callTitle,
  callStatus,
  callError,
  callPeerOfflineHint,
  defaultAvatar,
  onRetry,
}) => {
  if (peers.length === 0) {
    return (
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/90 via-slate-950/95 to-slate-950 flex flex-col items-center justify-center p-6 text-center space-y-3">
        <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-300 shadow-lg">
          {callStatus === 'error' ? (
            <VideoOff className="w-8 h-8 text-red-400" />
          ) : isGroupCall ? (
            <Users className="w-8 h-8 animate-pulse" />
          ) : (
            <Video className="w-8 h-8 animate-pulse" />
          )}
        </div>
        <div className="text-lg font-black text-white">{callTitle}</div>
        {callStatus === 'error' ? (
          <div className="space-y-3 max-w-sm">
            <p className="text-xs text-red-300 font-medium">{callError}</p>
            <button
              type="button"
              onClick={onRetry}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-400 text-slate-950 text-xs font-black hover:bg-emerald-300 transition"
            >
              Retry Camera &amp; Call
            </button>
          </div>
        ) : (
          <div className="space-y-1.5 max-w-sm">
            <div className="text-xs font-bold text-emerald-300">
              {isGroupCall
                ? callStatus === 'ringing'
                  ? `Joining group video call in ${callTitle}...`
                  : `Ringing members in ${callTitle}...`
                : callStatus === 'connected'
                ? 'Connected (Audio Live)'
                : callStatus === 'ringing'
                ? `Connecting video & audio with ${callTitle}...`
                : callPeerOfflineHint
                ? `Camera live — waiting for ${callTitle} to open Choy Chat...`
                : `Calling ${callTitle}...`}
            </div>
            <p className="text-[11px] text-slate-400">
              {isGroupCall
                ? 'Your live camera and microphone are active. Group members appear in this grid as soon as they join.'
                : `Your live camera & microphone are active. When ${callTitle} accepts on their device, their video appears here.`}
            </p>
          </div>
        )}
      </div>
    );
  }

  if (peers.length === 1) {
    return (
      <div className="w-full h-full">
        <RemotePeerVideoTile
          peer={peers[0]}
          defaultAvatar={defaultAvatar}
          singleFullBleed
        />
      </div>
    );
  }

  const gridColsClass =
    peers.length === 2
      ? 'grid-cols-1 sm:grid-cols-2'
      : peers.length <= 4
      ? 'grid-cols-2'
      : 'grid-cols-2 lg:grid-cols-3';

  return (
    <div className={`w-full h-full p-2.5 pt-16 pb-20 sm:pb-4 grid ${gridColsClass} gap-2.5 auto-rows-fr overflow-y-auto`}>
      {peers.map((peer) => (
        <RemotePeerVideoTile
          key={peer.peerId}
          peer={peer}
          defaultAvatar={defaultAvatar}
          singleFullBleed={false}
        />
      ))}
    </div>
  );
};
