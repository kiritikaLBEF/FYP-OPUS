import mongoose from 'mongoose';

const sentNoteSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailTemplate' },
    templateKey: { type: String, trim: true, default: '' },
    subject: { type: String, trim: true, required: true },
    body: { type: String, trim: true, required: true },
    sentByAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sentByAdminName: { type: String, trim: true, default: '' },
    sentByAdminEmail: { type: String, trim: true, default: '' },
    recipientEmail: { type: String, trim: true, required: true },
    status: { type: String, enum: ['sent', 'failed'], required: true },
    errorReason: { type: String, trim: true, default: '' },
    sentAt: { type: Date, default: Date.now, index: true },
    retryOf: { type: mongoose.Schema.Types.ObjectId, ref: 'SentNote' },
  },
  { timestamps: true },
);

sentNoteSchema.index({ userId: 1, sentAt: -1 });

export default mongoose.model('SentNote', sentNoteSchema);
