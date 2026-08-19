export default function IncomingCallModal({ call, onAccept, onDecline }) {
  if (!call) return null;

  return (
    <div className="msg-incoming" role="dialog" aria-label="Incoming call">
      <div className="msg-incoming__card">
        <p className="msg-incoming__label">Incoming {call.callType === 'audio' ? 'audio' : 'video'} call</p>
        <h2>{call.fromName || 'Someone'}</h2>
        <div className="msg-incoming__actions">
          <button type="button" className="msg-incoming__decline" onClick={onDecline}>
            Decline
          </button>
          <button type="button" className="msg-incoming__accept" onClick={onAccept}>
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
