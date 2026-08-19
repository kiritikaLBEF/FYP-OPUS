import mongoose from 'mongoose';

const advertisementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    subtitle: { type: String, trim: true, default: '', maxlength: 240 },
    organizationName: { type: String, trim: true, default: '', maxlength: 80 },
    ctaLabel: { type: String, trim: true, default: 'Learn more', maxlength: 40 },
    ctaUrl: { type: String, trim: true, default: '' },
    imagePath: { type: String, trim: true, default: '' },
    animation: {
      type: String,
      enum: ['fade', 'slide', 'kenburns', 'zoom', 'rise'],
      default: 'fade',
    },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

advertisementSchema.index({ active: 1, sortOrder: 1, createdAt: -1 });

const Advertisement = mongoose.model('Advertisement', advertisementSchema);
export default Advertisement;
