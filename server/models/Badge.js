import mongoose from 'mongoose';

const badgeSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, lowercase: true },
    label: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, trim: true, default: '', maxlength: 200 },
    color: { type: String, trim: true, default: '#0071e3' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const Badge = mongoose.model('Badge', badgeSchema);
export default Badge;
