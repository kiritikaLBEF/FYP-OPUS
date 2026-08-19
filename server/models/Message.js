import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true },
    filePath: { type: String, required: true },
    mimeType: { type: String, default: '' },
    fileSize: { type: Number, default: 0 },
  },
  { _id: false },
);

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    senderRole: {
      type: String,
      enum: ['employer', 'freelancer', 'system'],
      required: true,
    },
    type: {
      type: String,
      enum: ['text', 'system', 'call_event', 'attachment'],
      default: 'text',
    },
    text: { type: String, default: '', trim: true, maxlength: 4000 },
    attachments: { type: [attachmentSchema], default: [] },
    clientMsgId: { type: String, default: '', trim: true, index: true },
    /** Soft-deleted for specific users (still visible to others) */
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    deletedForEveryone: { type: Boolean, default: false },
    readBy: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      readAt: { type: Date, default: Date.now },
    }],
  },
  { timestamps: true },
);

messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ text: 'text' });
messageSchema.index(
  { conversationId: 1, clientMsgId: 1 },
  {
    unique: true,
    partialFilterExpression: { clientMsgId: { $type: 'string', $gt: '' } },
  },
);

export default mongoose.model('Message', messageSchema);
