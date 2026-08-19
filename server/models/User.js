import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { generateFreelancerId } from '../utils/freelancerId.js';
import { generateEmployerId } from '../utils/employerId.js';

const certificationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  organization: { type: String, trim: true, default: '' },
  issueDate: { type: Date },
  expirationDate: { type: Date },
  credentialId: { type: String, trim: true, default: '' },
  credentialUrl: { type: String, trim: true, default: '' },
  filePath: { type: String, default: '' },
});

const projectLinkSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['github', 'figma', 'behance', 'dribbble', 'youtube', 'drive', 'portfolio', 'demo', 'other'],
    default: 'other',
  },
  url: { type: String, required: true, trim: true },
});

const projectSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  category: {
    type: String,
    enum: [
      'coding', 'university', 'ui_ux', 'graphic_design', 'video_editing',
      'photography', 'research', 'presentation', '3d_modeling', 'animation',
      'content_writing', 'marketing', 'other',
    ],
    default: 'other',
  },
  technologies: [{ type: String, trim: true }],
  completionDate: { type: Date },
  thumbnail: { type: String, default: '' },
  files: [{ type: String }],
  links: [projectLinkSchema],
  screenshots: [{ type: String }],
});

const flagEntrySchema = new mongoose.Schema(
  {
    reason: { type: String, required: true, trim: true },
    note: { type: String, default: '', trim: true },
    flaggedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    flaggedByName: { type: String, default: '', trim: true },
    flaggedByEmail: { type: String, default: '', trim: true },
  },
  { timestamps: true },
);

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    username: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, default: '' },
    alternatePhone: { type: String, trim: true, default: '' },
    country: { type: String, trim: true, default: '' },
    stateProvince: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    postalCode: { type: String, trim: true, default: '' },
    timezone: { type: String, trim: true, default: '' },
    gender: {
      type: String,
      enum: ['', 'male', 'female', 'non_binary', 'prefer_not_to_say'],
      default: '',
    },
    dateOfBirth: { type: Date },
    password: { type: String, select: false },
    role: { type: String, enum: ['freelancer', 'employer', 'admin'], default: 'freelancer' },
    adminTier: { type: String, enum: ['', 'admin', 'super_admin'], default: '' },
    freelancerId: { type: String, unique: true, sparse: true, trim: true },
    employerId: { type: String, unique: true, sparse: true, trim: true },
    accountStatus: { type: String, enum: ['active', 'suspended'], default: 'active' },
    suspensionSource: { type: String, enum: ['', 'manual', 'auto_flags'], default: '' },
    suspensionReason: { type: String, default: '', trim: true },
    suspendedAt: { type: Date },
    suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isAutoSuspended: { type: Boolean, default: false },
    flags: [flagEntrySchema],
    flagCount: { type: Number, default: 0 },

    organizationName: { type: String, trim: true, default: '' },
    panCardDocument: { type: String, default: '' },
    businessRegistrationDocument: { type: String, default: '' },
    businessType: {
      type: String,
      enum: ['', 'it', 'government', 'ngo_ingo', 'marketing', 'consulting', 'other'],
      default: '',
    },
    businessTypeOther: { type: String, trim: true, default: '' },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
    },
    verificationRejectionReason: { type: String, default: '', trim: true },
    verifiedAt: { type: Date },

    googleId: { type: String, sparse: true, unique: true },
    googlePicture: { type: String },
    authProvider: { type: String, enum: ['local', 'google', 'both'], default: 'local' },

    isEmailVerified: { type: Boolean, default: false },
    otp: { type: String, select: false },
    otpExpires: { type: Date, select: false },

    degree: { type: String, default: '' },
    degreeName: { type: String, default: '' },
    schoolName: { type: String, default: '' },
    passoutYear: { type: Number },
    stillRunning: { type: Boolean, default: false },

    bio: { type: String, default: '', maxlength: 2000 },
    interests: [{ type: String, trim: true }],
    careerObjectives: { type: String, default: '', maxlength: 1000 },
    professionalSummary: { type: String, default: '', maxlength: 2000 },
    skills: [{ type: String, trim: true }],

    certifications: [certificationSchema],
    projects: [projectSchema],

    profilePicture: { type: String, default: '' },
    avatarId: { type: String, default: '' },

    notificationPreferences: {
      emailUpdates: { type: Boolean, default: true },
      jobAlerts: { type: Boolean, default: true },
      forumReplies: { type: Boolean, default: true },
    },
    privacySettings: {
      profileVisible: { type: Boolean, default: true },
      showEmail: { type: Boolean, default: false },
    },
    language: { type: String, default: 'en' },

    onboardingStep: {
      type: String,
      enum: ['otp', 'password', 'degree', 'skills', 'profile', 'documents', 'business_type', 'complete'],
      default: 'otp',
    },
    onboardingComplete: { type: Boolean, default: false },
  },
  { timestamps: true },
);

userSchema.methods.comparePassword = async function comparePassword(candidate) {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

userSchema.pre('save', async function assignIds() {
  if (this.role === 'freelancer' && !this.freelancerId) {
    this.freelancerId = await generateFreelancerId();
  }
  if (this.role === 'employer' && !this.employerId) {
    this.employerId = await generateEmployerId();
  }
  this.flagCount = Array.isArray(this.flags) ? this.flags.length : 0;
});

userSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id,
    firstName: this.firstName,
    lastName: this.lastName,
    username: this.username || '',
    email: this.email,
    phone: this.phone,
    alternatePhone: this.alternatePhone || '',
    country: this.country,
    stateProvince: this.stateProvince || '',
    city: this.city,
    address: this.address || '',
    postalCode: this.postalCode || '',
    timezone: this.timezone || '',
    gender: this.gender || '',
    dateOfBirth: this.dateOfBirth,
    role: this.role,
    adminTier: this.adminTier || '',
    freelancerId: this.freelancerId || '',
    employerId: this.employerId || '',
    accountStatus: this.accountStatus || 'active',
    suspensionSource: this.suspensionSource || '',
    suspensionReason: this.suspensionReason || '',
    suspendedAt: this.suspendedAt || null,
    isAutoSuspended: !!this.isAutoSuspended,
    flagCount: this.flagCount || 0,
    flags: (this.flags || []).map((f) => ({
      id: f._id,
      reason: f.reason,
      note: f.note || '',
      flaggedBy: f.flaggedBy,
      flaggedByName: f.flaggedByName || '',
      flaggedByEmail: f.flaggedByEmail || '',
      createdAt: f.createdAt,
    })),
    organizationName: this.organizationName || '',
    businessType: this.businessType || '',
    businessTypeOther: this.businessTypeOther || '',
    panCardDocument: this.panCardDocument || '',
    businessRegistrationDocument: this.businessRegistrationDocument || '',
    verificationStatus: this.verificationStatus || 'pending',
    verificationRejectionReason: this.verificationRejectionReason || '',
    verifiedAt: this.verifiedAt || null,
    degree: this.degree,
    degreeName: this.degreeName,
    schoolName: this.schoolName,
    passoutYear: this.passoutYear,
    stillRunning: this.stillRunning,
    bio: this.bio,
    interests: this.interests,
    careerObjectives: this.careerObjectives,
    professionalSummary: this.professionalSummary,
    skills: this.skills,
    certifications: this.certifications,
    projects: this.projects,
    profilePicture: this.profilePicture,
    avatarId: this.avatarId,
    notificationPreferences: this.notificationPreferences,
    privacySettings: this.privacySettings,
    language: this.language,
    onboardingStep: this.onboardingStep,
    onboardingComplete: this.onboardingComplete,
    authProvider: this.authProvider,
    hasPassword: this.authProvider === 'local' || this.authProvider === 'both',
    emailReadOnly: this.authProvider === 'google' || (this.authProvider === 'both' && this.googleId),
  };
};

userSchema.statics.hashPassword = async (plain) => bcrypt.hash(plain, 12);

const User = mongoose.model('User', userSchema);
export default User;
