import mongoose from 'mongoose';

const payoutMethodSchema = new mongoose.Schema(
  {
    provider: { type: String, enum: ['esewa', 'khalti'], required: true },
    accountId: { type: String, required: true, trim: true },
    last4: { type: String, default: '' },
    isPrimary: { type: Boolean, default: false },
    linkedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const walletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    availableBalance: { type: Number, default: 0 },
    pendingBalance: { type: Number, default: 0 },
    lifetimeEarned: { type: Number, default: 0 },
    lifetimeWithdrawn: { type: Number, default: 0 },
    lifetimePlatformFees: { type: Number, default: 0 },
    payoutMethods: { type: [payoutMethodSchema], default: [] },
    settings: {
      autoWithdraw: { type: Boolean, default: false },
      autoWithdrawProvider: { type: String, enum: ['', 'esewa', 'khalti'], default: '' },
      emailReceipts: { type: Boolean, default: true },
    },
  },
  { timestamps: true },
);

export default mongoose.model('Wallet', walletSchema);
