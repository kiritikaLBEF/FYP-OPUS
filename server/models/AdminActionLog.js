import mongoose from 'mongoose';

const adminActionLogSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    adminEmail: { type: String, default: '', trim: true },
    adminName: { type: String, default: '', trim: true },
    action: { type: String, required: true, trim: true, index: true },
    targetType: { type: String, default: '', trim: true, index: true },
    targetId: { type: String, default: '', trim: true, index: true },
    targetEmail: { type: String, default: '', trim: true },
    summary: { type: String, default: '', trim: true },
    metadata: { type: Object, default: {} },
    occurredAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

adminActionLogSchema.index({ occurredAt: -1, action: 1 });

export default mongoose.model('AdminActionLog', adminActionLogSchema);
