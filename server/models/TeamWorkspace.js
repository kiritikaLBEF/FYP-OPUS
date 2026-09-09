import mongoose from 'mongoose';

const CONTENT_TYPES = ['file', 'repo', 'preview', 'video', 'note'];
const GUIDELINE_CATEGORIES = ['technical', 'design', 'submission'];

const guidelineSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    category: { type: String, enum: GUIDELINE_CATEGORIES, default: 'submission' },
    checked: { type: Boolean, default: false },
  },
  { _id: true },
);

const attachmentSchema = new mongoose.Schema(
  {
    fileName: { type: String, trim: true, default: '' },
    filePath: { type: String, trim: true, default: '' },
    mimeType: { type: String, trim: true, default: '' },
    fileSize: { type: Number, default: 0 },
  },
  { _id: true },
);

const memberSchema = new mongoose.Schema(
  {
    freelancerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobApplication', required: true },
    roleKey: { type: String, required: true, trim: true },
    roleName: { type: String, trim: true, default: '' },
    splitAmount: { type: Number, default: 0 },
    roleStatus: {
      type: String,
      enum: ['not_started', 'in_progress', 'role_finalized', 'paid', 'certified'],
      default: 'not_started',
    },
    startedAt: { type: Date },
    roleFinalizedAt: { type: Date },
    paidAt: { type: Date },
    certifiedAt: { type: Date },
    certificateId: { type: String, default: '' },
    certificateFilePath: { type: String, default: '' },
  },
  { _id: false },
);

const progressUpdateSchema = new mongoose.Schema(
  {
    number: { type: Number, required: true },
    type: { type: String, enum: CONTENT_TYPES, default: 'note' },
    title: { type: String, required: true, trim: true },
    body: { type: String, trim: true, default: '' },
    roleKey: { type: String, trim: true, default: '' },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    attachments: [attachmentSchema],
    reviewStatus: {
      type: String,
      enum: ['pending', 'approved_new_draft', 'approved_complete', 'changes_requested'],
      default: 'pending',
    },
    reviewComment: { type: String, trim: true, default: '' },
    reviewedAt: { type: Date },
  },
  { timestamps: true },
);

const teamWorkspaceSchema = new mongoose.Schema(
  {
    jobPostingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JobPosting',
      required: true,
      unique: true,
      index: true,
    },
    employerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    organizationName: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    category: { type: String, default: 'other' },
    deadline: { type: Date },
    guidelines: [guidelineSchema],
    members: [memberSchema],
    status: {
      type: String,
      enum: ['not_started', 'in_progress', 'awaiting_payment', 'paid', 'certified'],
      default: 'not_started',
      index: true,
    },
    progressUpdates: [progressUpdateSchema],
    freelancerGroupConversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' },
    projectGroupConversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' },
    paymentRef: { type: String, default: '' },
    paidAt: { type: Date },
    certifiedAt: { type: Date },
  },
  { timestamps: true },
);

teamWorkspaceSchema.index({ employerId: 1, status: 1 });
teamWorkspaceSchema.index({ 'members.freelancerId': 1, status: 1 });

export const TEAM_WORKSPACE_CONTENT_TYPES = CONTENT_TYPES;
export default mongoose.model('TeamWorkspace', teamWorkspaceSchema);
