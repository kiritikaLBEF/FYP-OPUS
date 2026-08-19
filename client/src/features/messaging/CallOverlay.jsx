import { useEffect, useRef, useState } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  createLocalTracks,
} from 'livekit-client';
import { api } from '../../services/api';
import './messaging.css';

export default function CallOverlay({ call, onEnd }) {
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(call?.callType !== 'audio');
  const [sharing, setSharing] = useState(false);
  const [hasRemoteScreen, setHasRemoteScreen] = useState(false);

  const roomRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const screenVideoRef = useRef(null);
  const localTracksRef = useRef([]);

  const onEndRef = useRef(onEnd);
  useEffect(() => { onEndRef.current = onEnd; }, [onEnd]);

  useEffect(() => {
    if (!call?.conversationId) return undefined;
    let cancelled = false;

    const attachTrack = (track, el) => {
      if (!el || !track) return;
      track.attach(el);
    };

    const handleTrackSubscribed = (track) => {
      if (track.kind === Track.Kind.Video) {
        if (track.source === Track.Source.ScreenShare) {
          attachTrack(track, screenVideoRef.current);
          setHasRemoteScreen(true);
        } else {
          attachTrack(track, remoteVideoRef.current);
        }
      } else if (track.kind === Track.Kind.Audio) {
        const el = track.attach();
        el.dataset.lkAudio = '1';
        document.body.appendChild(el);
      }
    };

    const handleTrackUnsubscribed = (track) => {
      track.detach().forEach((el) => el.remove());
      if (track.source === Track.Source.ScreenShare) {
        setHasRemoteScreen(false);
        if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
      }
    };

    (async () => {
      try {
        const data = await api.getCallToken(call.conversationId);
        if (cancelled) return;
        if (!data.configured || !data.token) {
          setError(data.message || 'LiveKit is not configured on the server.');
          setConnecting(false);
          return;
        }

        const room = new Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;

        room.on(RoomEvent.TrackSubscribed, (track) => handleTrackSubscribed(track));
        room.on(RoomEvent.TrackUnsubscribed, (track) => handleTrackUnsubscribed(track));
        room.on(RoomEvent.Disconnected, () => {
          if (!cancelled) onEndRef.current?.();
        });

        await room.connect(data.url, data.token);
        if (cancelled) {
          room.disconnect();
          return;
        }

        const audioOnly = call.callType === 'audio';
        const tracks = await createLocalTracks({
          audio: true,
          video: audioOnly ? false : { resolution: { width: 1280, height: 720 } },
        });
        localTracksRef.current = tracks;

        for (const track of tracks) {
          await room.localParticipant.publishTrack(track);
          if (track.kind === Track.Kind.Video) {
            attachTrack(track, localVideoRef.current);
          }
        }

        setMicOn(true);
        setCamOn(!audioOnly);
        setConnecting(false);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to join call');
          setConnecting(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      localTracksRef.current.forEach((t) => t.stop());
      document.querySelectorAll('[data-lk-audio="1"]').forEach((el) => el.remove());
      roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, [call?.conversationId, call?.callType]);

  const toggleMic = async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !micOn;
    await room.localParticipant.setMicrophoneEnabled(next);
    setMicOn(next);
  };

  const toggleCam = async () => {
    const room = roomRef.current;
    if (!room || call?.callType === 'audio') return;
    const next = !camOn;
    await room.localParticipant.setCameraEnabled(next);
    setCamOn(next);
  };

  const toggleScreen = async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      const next = !sharing;
      await room.localParticipant.setScreenShareEnabled(next);
      setSharing(next);
    } catch (err) {
      alert(err.message || 'Screen share failed or was blocked');
    }
  };

  return (
    <div className="msg-call" role="dialog" aria-label="Call">
      <div className="msg-call__stage">
        <video ref={remoteVideoRef} className="msg-call__remote" autoPlay playsInline />
        <video
          ref={screenVideoRef}
          className="msg-call__screen"
          autoPlay
          playsInline
          muted
          style={{ opacity: hasRemoteScreen ? 1 : 0, pointerEvents: hasRemoteScreen ? 'auto' : 'none' }}
        />
        <video ref={localVideoRef} className="msg-call__local" autoPlay playsInline muted />

        {connecting && <div className="msg-call__status">Connecting…</div>}
        {error && <div className="msg-call__status msg-call__status--err">{error}</div>}
        {!connecting && !error && call?.status === 'calling' && (
          <div className="msg-call__status">Calling…</div>
        )}
      </div>

      <div className="msg-call__controls">
        <button type="button" className={micOn ? '' : 'is-off'} onClick={toggleMic}>
          {micOn ? 'Mute' : 'Unmute'}
        </button>
        {call?.callType !== 'audio' && (
          <button type="button" className={camOn ? '' : 'is-off'} onClick={toggleCam}>
            {camOn ? 'Camera off' : 'Camera on'}
          </button>
        )}
        <button type="button" className={sharing ? 'is-active' : ''} onClick={toggleScreen}>
          {sharing ? 'Stop share' : 'Share screen'}
        </button>
        <button type="button" className="msg-call__end" onClick={onEnd}>
          End
        </button>
      </div>
    </div>
  );
}
