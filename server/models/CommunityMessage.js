import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['image', 'audio', 'video', 'file'], default: 'file' },
    path: { type: String, required: true },
    mime: { type: String, default: '' },
    size: { type: Number, default: 0 },
    name: { type: String, default: '' },
  },
  { _id: false },
);

const communityMessageSchema = new mongoose.Schema(
  {
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityGroup', required: true, index: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: {
      type: String,
      enum: ['regular', 'alert', 'warning', 'notice'],
      default: 'regular',
      index: true,
    },
    body: { type: String, trim: true, default: '', maxlength: 4000 },
    attachments: { type: [attachmentSchema], default: [] },
    pinned: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    clientMsgId: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
);

communityMessageSchema.index({ groupId: 1, createdAt: -1 });
communityMessageSchema.index({ groupId: 1, clientMsgId: 1 });
communityMessageSchema.index({ groupId: 1, pinned: 1, createdAt: -1 });

export default mongoose.model('CommunityMessage', communityMessageSchema);
