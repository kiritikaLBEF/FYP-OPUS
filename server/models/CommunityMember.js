import mongoose from 'mongoose';

const communityMemberSchema = new mongoose.Schema(
  {
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityGroup', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: {
      type: String,
      enum: ['owner', 'admin', 'moderator', 'member'],
      default: 'member',
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'banned'],
      default: 'active',
      index: true,
    },
    statusReason: { type: String, trim: true, default: '' },
    joinedAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    lastReadAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

communityMemberSchema.index({ groupId: 1, userId: 1 }, { unique: true });
communityMemberSchema.index({ userId: 1, status: 1 });

export default mongoose.model('CommunityMember', communityMemberSchema);
