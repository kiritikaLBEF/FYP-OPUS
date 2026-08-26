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
  },
  { timestamps: true },
);

communityGroupSchema.index({ visibility: 1, lastMessageAt: -1 });
communityGroupSchema.index({ name: 'text', description: 'text' });

export default mongoose.model('CommunityGroup', communityGroupSchema);
