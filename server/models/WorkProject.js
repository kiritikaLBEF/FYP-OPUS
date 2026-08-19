import mongoose from 'mongoose';

const workProjectSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    projectRef: { type: String, required: true },
    organizationRef: { type: String, required: true },
    organizationName: { type: String, required: true },
    title: { type: String, required: true },
    category: { type: String, default: 'coding' },
    paymentAmount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['awaiting_start', 'in_progress', 'review', 'completed', 'on_hold'],
      default: 'in_progress',
    },
    startDate: { type: Date },
    expectedCompletionDate: { type: Date },
    completedDate: { type: Date },
    bidAcceptedAt: { type: Date, default: Date.now },
    isDemo: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

workProjectSchema.index({ userId: 1, status: 1 });

export default mongoose.model('WorkProject', workProjectSchema);
