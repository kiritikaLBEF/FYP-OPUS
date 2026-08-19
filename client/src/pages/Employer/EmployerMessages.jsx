import MessengerPane from '../../features/messaging/MessengerPane';
import EmployerLockedGate from './EmployerLockedGate';
import '../../features/messaging/messaging.css';

export default function EmployerMessages() {
  return (
    <EmployerLockedGate feature="Messages">
      <MessengerPane
        title="Messages"
        subtitle="Chat, call, and share your screen with connected freelancers"
        emptyText="No conversations yet. Accept a bid on Check Status to start messaging."
        wide
      />
    </EmployerLockedGate>
  );
}
