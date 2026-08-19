import mongoose from 'mongoose';

const paymentIntentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: {
      type: String,
      enum: ['topup', 'job_pay', 'withdraw'],
      required: true,
    },
    provider: { type: String, enum: ['khalti', 'esewa'], required: true },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    workSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkSession' },
    purchaseOrderId: { type: String, required: true, unique: true },
    pidx: { type: String, default: '', index: true },
    transactionUuid: { type: String, default: '', index: true },
    gatewayRef: { type: String, default: '' },
    payoutAccountId: { type: String, default: '' },
    successRedirect: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

paymentIntentSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('PaymentIntent', paymentIntentSchema);
