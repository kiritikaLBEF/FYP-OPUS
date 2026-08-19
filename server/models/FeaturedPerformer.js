import mongoose from 'mongoose';

const featuredPerformerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    headline: { type: String, trim: true, default: '', maxlength: 80 },
    candidateCategory: {
      type: String,
      enum: ['high_performers', 'new_accounts', 'top_bidders', 'potentials', 'manual'],
      default: 'manual',
    },
    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    featuredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

featuredPerformerSchema.index({ active: 1, sortOrder: 1, createdAt: -1 });

const FeaturedPerformer = mongoose.model('FeaturedPerformer', featuredPerformerSchema);
export default FeaturedPerformer;
