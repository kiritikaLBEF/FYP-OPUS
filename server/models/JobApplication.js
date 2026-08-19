import mongoose from 'mongoose';

const jobApplicationSchema = new mongoose.Schema(
  {
    jobPostingId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobPosting', required: true, index: true },
    freelancerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    employerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    jobTitle: { type: String, trim: true, default: '' },
    organizationName: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'withdrawn'],
      default: 'pending',
      index: true,
    },
    /** single = whole job; role = one employer-defined role */
    bidType: {
      type: String,
      enum: ['single', 'role'],
      default: 'single',
      index: true,
    },
    roleKey: { type: String, trim: true, default: '' },
    roleName: { type: String, trim: true, default: '' },
    amount: { type: Number, default: 0 },
    message: { type: String, trim: true, default: '' },
    estimatedDelivery: { type: String, trim: true, default: '' },
    appliedAt: { type: Date, default: Date.now, index: true },
    reviewedAt: { type: Date },
  },
  { timestamps: true },
);

// One bid per freelancer per role (roleKey '' for classic single-job apply)
jobApplicationSchema.index(
  { jobPostingId: 1, freelancerId: 1, roleKey: 1 },
  { unique: true },
);

export default mongoose.model('JobApplication', jobApplicationSchema);
