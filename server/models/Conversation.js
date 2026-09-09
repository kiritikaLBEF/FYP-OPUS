import mongoose from 'mongoose';

const participantSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['employer', 'freelancer'], required: true },
  },
  { _id: false },
);

const conversationSchema = new mongoose.Schema(
  {
    /** direct = classic 1:1 employer↔freelancer; group = multi-participant */
    kind: {
      type: String,
      enum: ['direct', 'group'],
      default: 'direct',
      index: true,
    },
    /** Only for group chats */
    groupType: {
      type: String,
      enum: ['freelancer_team', 'project_team', ''],
      default: '',
    },
    title: { type: String, trim: true, default: '' },
    participantIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
    participants: [participantSchema],
    /** Per-user unread for groups (keys are userId strings) */
    unreadByMap: { type: Map, of: Number, default: undefined },

    employerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    freelancerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    jobPostingId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobPosting' },
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobApplication' },
    workSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkSession' },
    teamWorkspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'TeamWorkspace' },
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
    archivedByUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true },
);

/** Unique 1:1 only for direct chats */
conversationSchema.index(
  { employerId: 1, freelancerId: 1 },
  {
    unique: true,
    partialFilterExpression: { kind: 'direct', employerId: { $exists: true }, freelancerId: { $exists: true } },
  },
);

conversationSchema.index({ kind: 1, jobPostingId: 1, groupType: 1 });

export default mongoose.model('Conversation', conversationSchema);
