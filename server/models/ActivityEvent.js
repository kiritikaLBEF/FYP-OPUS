import mongoose from 'mongoose';

const activityEventSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      required: true,
      enum: [
        'proposal_accepted',
        'payment_received',
        'project_invitation',
        'project_completed',
        'certificate_added',
        'portfolio_viewed',
        'profile_viewed',
        'review_received',
        'withdrawal_completed',
        'statement_generated',
      ],
    },
    title: { type: String, required: true },
    subtitle: { type: String, default: '' },
    meta: {
      organizationRef: String,
      organizationName: String,
      projectRef: String,
      projectTitle: String,
      amount: Number,
      rating: Number,
    },
    occurredAt: { type: Date, required: true, index: true },
    isDemo: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

export default mongoose.model('ActivityEvent', activityEventSchema);
