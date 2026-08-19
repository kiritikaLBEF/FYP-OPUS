import mongoose from 'mongoose';

const squadMemberSchema = new mongoose.Schema(
  {
    freelancerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    roleKey: { type: String, required: true, trim: true },
    roleName: { type: String, trim: true, default: '' },
    splitAmount: { type: Number, default: 0 },
    inviteStatus: {
      type: String,
      enum: ['leader', 'pending', 'accepted', 'declined'],
      default: 'pending',
    },
    respondedAt: { type: Date },
  },
  { _id: false },
);

const squadBidSchema = new mongoose.Schema(
  {
    jobPostingId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobPosting', required: true, index: true },
    employerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    leaderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    message: { type: String, trim: true, default: '' },
    estimatedDelivery: { type: String, trim: true, default: '' },
    combinedAmount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['forming', 'submitted', 'accepted', 'rejected', 'withdrawn'],
      default: 'forming',
      index: true,
    },
    members: [squadMemberSchema],
    submittedAt: { type: Date },
    reviewedAt: { type: Date },
    jobTitle: { type: String, trim: true, default: '' },
    organizationName: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
);

squadBidSchema.index({ jobPostingId: 1, leaderId: 1, status: 1 });
squadBidSchema.index({ 'members.freelancerId': 1, status: 1 });

export default mongoose.model('SquadBid', squadBidSchema);
