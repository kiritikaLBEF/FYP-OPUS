import mongoose from 'mongoose';

const emailTemplateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    label: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    category: { type: String, trim: true, default: 'general' },
    isSystem: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model('EmailTemplate', emailTemplateSchema);
