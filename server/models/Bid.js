import mongoose from 'mongoose';

const bidSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    projectRef: { type: String, required: true },
    projectTitle: { type: String, required: true },
    organizationRef: { type: String, default: '' },
    organizationName: { type: String, default: '' },
    amount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'withdrawn'],
      default: 'pending',
    },
    submittedAt: { type: Date, default: Date.now },
    isDemo: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

export default mongoose.model('Bid', bidSchema);
