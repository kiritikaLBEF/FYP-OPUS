import MessengerPane from '../../features/messaging/MessengerPane';
import '../../features/messaging/messaging.css';

export default function FreelancerMessages() {
  return (
    <main className="msg-page msg-page--wide">
      <MessengerPane
        title="Messages"
        subtitle="Chat, call, and share your screen with organizations after your bid is accepted"
        emptyText="No conversations yet. When an organization accepts your bid, you will be connected here automatically."
        wide
      />
    </main>
  );
}
