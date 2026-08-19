import mongoose from 'mongoose';

const userBadgeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    badgeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Badge', required: true },
    awardedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    candidateCategory: {
      type: String,
      enum: ['high_performers', 'new_accounts', 'top_bidders', 'potentials', 'manual'],
      default: 'manual',
    },
  },
  { timestamps: true },
);

userBadgeSchema.index({ userId: 1, badgeId: 1 }, { unique: true });

const UserBadge = mongoose.model('UserBadge', userBadgeSchema);
export default UserBadge;
