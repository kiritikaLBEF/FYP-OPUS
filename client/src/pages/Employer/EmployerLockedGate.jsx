import { useAuth } from '../../context/AuthContext';



export default function EmployerLockedGate({ feature, children }) {

  const { user } = useAuth();

  const isVerified = user?.verificationStatus === 'verified';

  const isRejected = user?.verificationStatus === 'rejected';



  if (!isVerified) {

    return (

      <div className="emp-locked">

        <div className="emp-locked__icon" aria-hidden="true">

          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">

            <rect x="7" y="10" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />

            <path d="M9 10V8a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.5" />

          </svg>

        </div>

        <h2>{feature} is locked</h2>

        {isRejected ? (

          <p>

            Your organization verification was not approved.

            {user?.verificationRejectionReason ? ` Reason: ${user.verificationRejectionReason}.` : ''}

            {' '}Please contact support or resubmit your documents.

          </p>

        ) : (

          <p>

            Your organization account is pending admin verification. Once approved, you can access

            {' '}{feature.toLowerCase()} and other hiring tools.

          </p>

        )}

      </div>

    );

  }



  return children;

}

