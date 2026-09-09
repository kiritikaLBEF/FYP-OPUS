import mongoose from 'mongoose';

const communityGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    description: { type: String, trim: true, default: '', maxlength: 500 },
    visibility: { type: String, enum: ['public', 'private'], default: 'public', index: true },
    avatarPath: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    memberCount: { type: Number, default: 1 },
    lastMessageAt: { type: Date },
    lastMessagePreview: { type: String, default: '' },
    moderationStatus: {
      type: String,
      enum: ['active', 'restricted', 'suspended'],
      default: 'active',
      index: true,
    },
    moderationReason: { type: String, trim: true, default: '' },
    moderatedAt: { type: Date },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reportCount: { type: Number, default: 0 },
    reports: [{
      reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      reporterName: { type: String, trim: true, default: '' },
      reporterEmail: { type: String, trim: true, default: '' },
      reason: { type: String, trim: true, required: true },
      note: { type: String, trim: true, default: '' },
      status: { type: String, enum: ['open', 'dismissed'], default: 'open' },
      createdAt: { type: Date, default: Date.now },
    }],
  },
  { timestamps: true },
);

communityGroupSchema.index({ visibility: 1, lastMessageAt: -1 });
communityGroupSchema.index({ name: 'text', description: 'text' });

export default mongoose.model('CommunityGroup', communityGroupSchema);
