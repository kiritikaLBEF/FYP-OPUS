import mongoose from 'mongoose';

const communityInviteSchema = new mongoose.Schema(
  {
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityGroup', required: true, index: true },
    code: { type: String, required: true, unique: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date },
    maxUses: { type: Number, default: 0 },
    useCount: { type: Number, default: 0 },
    revoked: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

export default mongoose.model('CommunityInvite', communityInviteSchema);
