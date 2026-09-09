import express from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import JobPosting from '../models/JobPosting.js';
import WorkSession from '../models/WorkSession.js';
import Transaction from '../models/Transaction.js';
import { serializePublicEmployer } from '../utils/publicEmployer.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();
const DONE_STATUSES = ['paid', 'certified'];

router.get('/:userId', optionalAuth, async (req, res) => {
  try {
    const raw = String(req.params.userId || '').trim();
    if (!raw) return res.status(400).json({ message: 'Missing employer' });

    let user = null;
    if (mongoose.Types.ObjectId.isValid(raw)) {
      user = await User.findById(raw).lean();
    }
    if (!user && raw.toUpperCase().startsWith('EMP-')) {
      user = await User.findOne({ employerId: raw.toUpperCase() }).lean();
    }
    if (!user || user.role !== 'employer' || user.accountStatus === 'suspended') {
      return res.status(404).json({ message: 'Employer not found' });
    }
    if (user.privacySettings?.profileVisible === false) {
      const viewerId = req.user?._id ? String(req.user._id) : '';
      if (viewerId !== String(user._id)) {
        return res.status(404).json({ message: 'Profile not available' });
      }
    }

    const [totalGigs, completedGigs, payoutAgg] = await Promise.all([
      JobPosting.countDocuments({ employerId: user._id, isRemoved: { $ne: true } }),
      WorkSession.countDocuments({ employerId: user._id, status: { $in: DONE_STATUSES } }),
      Transaction.aggregate([
        { $match: { userId: user._id, debit: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$debit' } } },
      ]),
    ]);

    res.json({
      employer: serializePublicEmployer(user, {
        totalGigs,
        completedGigs,
        totalPayouts: Number(payoutAgg[0]?.total || 0),
        rating: null,
        reviews: 0,
      }),
    });
  } catch (err) {
    console.error('Public employer profile error:', err);
    res.status(500).json({ message: err.message || 'Failed to load employer profile' });
  }
});

export default router;
