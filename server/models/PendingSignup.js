import mongoose from 'mongoose';

const pendingSignupSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    organizationName: { type: String, default: '' },
    phone: { type: String, default: '' },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['freelancer', 'employer'], required: true },
    otp: { type: String, select: false },
    otpExpires: { type: Date, select: false },
  },
  { timestamps: true },
);

const PendingSignup = mongoose.model('PendingSignup', pendingSignupSchema);
export default PendingSignup;
