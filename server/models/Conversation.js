import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    employerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    freelancerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    jobPostingId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobPosting' },
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobApplication' },
    workSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkSession' },
    jobTitle: { type: String, default: '', trim: true },
    organizationName: { type: String, default: '', trim: true },
    collaborationCount: { type: Number, default: 1, min: 1 },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    lastMessagePreview: { type: String, default: '', trim: true },
    unreadBy: {
      employer: { type: Number, default: 0, min: 0 },
      freelancer: { type: Number, default: 0, min: 0 },
    },
    archivedBy: {
      employer: { type: Boolean, default: false },
      freelancer: { type: Boolean, default: false },
    },
  },
  { timestamps: true },
);

conversationSchema.index({ employerId: 1, freelancerId: 1 }, { unique: true });

export default mongoose.model('Conversation', conversationSchema);
