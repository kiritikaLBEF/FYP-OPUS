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

const progressUpdateSchema = new mongoose.Schema(
  {
    number: { type: Number, required: true },
    type: { type: String, enum: CONTENT_TYPES, default: 'note' },
    title: { type: String, required: true, trim: true },
    body: { type: String, trim: true, default: '' },
    attachments: [attachmentSchema],
    reviewStatus: {
      type: String,
      enum: [
        'pending',
        'approved', // legacy
        'disapproved', // legacy
        'approved_new_draft',
        'approved_complete',
        'changes_requested',
      ],
      default: 'pending',
    },
    reviewComment: { type: String, trim: true, default: '' },
    reviewedAt: { type: Date },
    reviewFeedbackId: { type: mongoose.Schema.Types.ObjectId },
  },
  { timestamps: true },
);

const finalDeliverySchema = new mongoose.Schema(
  {
    type: { type: String, enum: CONTENT_TYPES, default: 'repo' },
    body: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    techStack: { type: String, trim: true, default: '' },
    setupNotes: { type: String, trim: true, default: '' },
    attachments: [attachmentSchema],
    round: { type: Number, default: 1 },
    submittedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const feedbackSchema = new mongoose.Schema(
  {
    round: { type: Number, required: true },
    kind: {
      type: String,
      enum: [
        'next_draft',
        'disapproved',
        'approved',
        'approved_new_draft',
        'approved_complete',
        'changes_requested',
      ],
      default: 'next_draft',
    },
    text: { type: String, required: true, trim: true },
    resolved: { type: Boolean, default: false },
    relatedUpdateId: { type: mongoose.Schema.Types.ObjectId },
    relatedUpdateNumber: { type: Number },
    relatedDelivery: {
      type: {
        type: String,
        enum: CONTENT_TYPES,
        default: 'note',
      },
      body: { type: String, default: '' },
      notes: { type: String, default: '' },
      techStack: { type: String, default: '' },
      setupNotes: { type: String, default: '' },
      submittedAt: { type: Date },
      attachments: [attachmentSchema],
    },
  },
  { timestamps: true },
);

const messageSchema = new mongoose.Schema(
  {
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorRole: { type: String, enum: ['employer', 'freelancer'], required: true },
    text: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

const workSessionSchema = new mongoose.Schema(
  {
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JobApplication',
      required: true,
      unique: true,
      index: true,
    },
    jobPostingId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobPosting', required: true, index: true },
    freelancerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    employerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    organizationName: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    category: { type: String, default: 'other' },
    bidAmount: { type: Number, default: 0 },
    budgetType: { type: String, enum: ['fixed', 'hourly'], default: 'fixed' },
    deadline: { type: Date },
    status: {
      type: String,
      enum: [
        'not_started',
        'in_progress',
        'final_submitted',
        'finalized', // legacy alias migrated to final_submitted on read
        'awaiting_payment',
        'paid',
        'certified',
      ],
      default: 'not_started',
      index: true,
    },
    /** Employer must unlock this before the freelancer can submit final delivery. */
    finalizationUnlocked: { type: Boolean, default: false },
    /** Last time employer emailed the freelancer a reminder to start work. */
    startReminderSentAt: { type: Date },
    guidelines: [guidelineSchema],
    progressUpdates: [progressUpdateSchema],
    finalDelivery: { type: finalDeliverySchema, default: null },
    feedbackLog: [feedbackSchema],
    messages: [messageSchema],
    deliveryRound: { type: Number, default: 0 },
    paymentRef: { type: String, default: '' },
    certificateId: { type: String, default: '' },
    certificateFilePath: { type: String, default: '' },
    certificateAddedToProfile: { type: Boolean, default: false },
    startedAt: { type: Date },
    finalizedAt: { type: Date },
    paidAt: { type: Date },
    certifiedAt: { type: Date },

    /** @deprecated legacy fields kept only for one-time migration */
    conditions: [{ type: String, trim: true }],
    drafts: [{
      number: Number,
      title: String,
      notes: String,
      fileName: String,
      reviewStatus: String,
      comments: [{ authorId: mongoose.Schema.Types.ObjectId, authorRole: String, text: String }],
      createdAt: Date,
      updatedAt: Date,
    }],
  },
  { timestamps: true },
);

workSessionSchema.index({ freelancerId: 1, status: 1 });
workSessionSchema.index({ employerId: 1, status: 1 });

export const WORKSPACE_CONTENT_TYPES = CONTENT_TYPES;
export const WORKSPACE_GUIDELINE_CATEGORIES = GUIDELINE_CATEGORIES;

export default mongoose.model('WorkSession', workSessionSchema);
