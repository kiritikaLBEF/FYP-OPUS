import CallOverlay from './CallOverlay';
import IncomingCallModal from './IncomingCallModal';
import ChatDock from './ChatDock';
import { useMessaging } from './MessagingProvider';

/** Global overlays: dock, incoming call, active call */
export default function MessagingOverlays() {
  const { enabled, incomingCall, activeCall, acceptCall, declineCall, endCall } = useMessaging();

  if (!enabled) return null;

  return (
    <>
      <ChatDock />
      <IncomingCallModal call={incomingCall} onAccept={acceptCall} onDecline={declineCall} />
      {activeCall && <CallOverlay call={activeCall} onEnd={endCall} />}
    </>
  );
}
