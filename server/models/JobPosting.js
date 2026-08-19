import mongoose from 'mongoose';

const jobPostingSchema = new mongoose.Schema(
  {
    employerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    organizationName: { type: String, required: true, trim: true },
    employerRef: { type: String, default: '' },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    category: {
      type: String,
      enum: [
        'coding', 'ui_ux', 'graphic_design', 'video_editing', 'data_entry',
        'marketing', 'consulting', 'content_writing', 'other',
      ],
      default: 'other',
    },
    budget: { type: Number, default: 0 },
    budgetType: {
      type: String,
      enum: ['fixed', 'hourly'],
      default: 'fixed',
    },
    hourlyRate: { type: Number, default: 0 },
    location: { type: String, trim: true, default: 'Remote' },
    skillsRequired: [{ type: String, trim: true }],
    conditions: [{ type: String, trim: true }],
    applicationDeadline: { type: Date },
    coverMode: {
      type: String,
      enum: ['image', 'text', 'none'],
      default: 'none',
    },
    coverImage: { type: String, trim: true, default: '' },
    coverText: { type: String, trim: true, default: '' },
    publishStatus: {
      type: String,
      enum: ['draft', 'published'],
      default: 'published',
      index: true,
    },
    status: {
      type: String,
      enum: ['open', 'closed', 'filled'],
      default: 'open',
    },
    /** single = classic 1 hire; multi = role / squad hiring */
    projectMode: {
      type: String,
      enum: ['single', 'multi'],
      default: 'single',
      index: true,
    },
    /** How freelancers may bid on multi jobs */
    multiBidMode: {
      type: String,
      enum: ['role', 'squad', 'both'],
      default: 'both',
    },
    roles: [
      {
        roleKey: { type: String, required: true },
        name: { type: String, required: true, trim: true },
        description: { type: String, trim: true, default: '' },
        budgetPercent: { type: Number, default: 0 },
        budgetAmount: { type: Number, default: 0 },
        status: { type: String, enum: ['open', 'filled'], default: 'open' },
        filledByApplicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobApplication', default: null },
      },
    ],
    isRemoved: { type: Boolean, default: false, index: true },
    removedAt: { type: Date },
    removedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    removeReason: { type: String, trim: true, default: '' },
    removeReasonCategory: {
      type: String,
      enum: ['fake_listing', 'offensive_content', 'scam_fraud', 'duplicate', 'other', ''],
      default: '',
    },
    postedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

jobPostingSchema.index({ status: 1, postedAt: -1 });

export default mongoose.model('JobPosting', jobPostingSchema);
