import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    transactionId: { type: String, required: true, unique: true },
    occurredAt: { type: Date, required: true, index: true },
    description: { type: String, required: true },
    organizationRef: { type: String, default: '' },
    organizationName: { type: String, default: '' },
    projectRef: { type: String, default: '' },
    projectTitle: { type: String, default: '' },
    paymentType: {
      type: String,
      enum: ['milestone', 'withdrawal', 'platform_fee', 'refund', 'bonus', 'adjustment', 'hiring', 'topup'],
      default: 'milestone',
    },
    method: {
      type: String,
      enum: ['', 'esewa', 'khalti', 'opus'],
      default: '',
    },
    debit: { type: Number, default: 0 },
    credit: { type: Number, default: 0 },
    runningBalance: { type: Number, required: true },
    paymentStatus: {
      type: String,
      enum: ['completed', 'pending', 'failed', 'reversed'],
      default: 'completed',
    },
    transactionStatus: {
      type: String,
      enum: ['settled', 'processing', 'reversed', 'on_hold'],
      default: 'settled',
    },
    workSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkSession' },
    counterpartyUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    gatewayRef: { type: String, default: '' },
    payoutAccount: { type: String, default: '' },
    isDemo: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

transactionSchema.index({ userId: 1, occurredAt: -1 });

export default mongoose.model('Transaction', transactionSchema);
