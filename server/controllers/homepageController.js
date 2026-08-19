import Advertisement from '../models/Advertisement.js';
import FeaturedPerformer from '../models/FeaturedPerformer.js';
import Badge from '../models/Badge.js';
import UserBadge from '../models/UserBadge.js';
import User from '../models/User.js';
import WorkSession from '../models/WorkSession.js';
import JobApplication from '../models/JobApplication.js';
import { calculateProfileCompletion } from '../utils/profileCompletion.js';
import { CANDIDATE_CATEGORIES, ensureDefaultBadges } from '../utils/homepageBadges.js';
import { loadBadgesForUsers } from '../utils/badges.js';
import { serializePublicFreelancer } from '../utils/publicFreelancer.js';
import { notifyUser } from '../utils/notify.js';
import AdminActionLog from '../models/AdminActionLog.js';

const PAID_STATUSES = ['paid', 'certified'];
const CANDIDATE_LIMIT = 5;
const MAX_LIVE_ADS = 5;
const AD_ANIMATIONS = ['fade', 'slide', 'kenburns', 'zoom', 'rise'];

const normalizeAdAnimation = (value) =>
  AD_ANIMATIONS.includes(String(value || '')) ? String(value) : 'fade';

const logAdminAction = async (admin, action, details = {}) => {
  await AdminActionLog.create({
    adminId: admin._id,
    adminEmail: admin.email,
    adminName: `${admin.firstName} ${admin.lastName}`.trim(),
    action,
    targetType: details.targetType || '',
    targetId: details.targetId || '',
    targetEmail: details.targetEmail || '',
    summary: details.summary || '',
    metadata: details.metadata || {},
    occurredAt: new Date(),
  });
};

const freelancerBase = (user) => ({
  id: String(user._id),
  firstName: user.firstName || '',
  lastName: user.lastName || '',
  username: user.username || '',
  email: user.email || '',
  profilePicture: user.profilePicture || '',
  avatarId: user.avatarId || '',
  skills: Array.isArray(user.skills) ? user.skills.slice(0, 6) : [],
  freelancerId: user.freelancerId || '',
  schoolName: user.schoolName || '',
  degree: user.degree || '',
  createdAt: user.createdAt,
});

const serializeAd = (ad) => ({
  id: String(ad._id),
  title: ad.title,
  subtitle: ad.subtitle || '',
  organizationName: ad.organizationName || '',
  ctaLabel: ad.ctaLabel || 'Learn more',
  ctaUrl: ad.ctaUrl || '',
  imagePath: ad.imagePath || '',
  animation: normalizeAdAnimation(ad.animation),
  active: !!ad.active,
  sortOrder: ad.sortOrder || 0,
  startsAt: ad.startsAt || null,
  endsAt: ad.endsAt || null,
  createdAt: ad.createdAt,
});

const serializeBadge = (badge) => ({
  id: String(badge._id),
  key: badge.key,
  label: badge.label,
  description: badge.description || '',
  color: badge.color || '#0071e3',
  active: badge.active !== false,
});

const isAdLive = (ad, now = new Date()) => {
  if (!ad.active) return false;
  if (ad.startsAt && new Date(ad.startsAt) > now) return false;
  if (ad.endsAt && new Date(ad.endsAt) < now) return false;
  return true;
};

const countActiveAds = (excludeId) => {
  const filter = { active: true };
  if (excludeId) filter._id = { $ne: excludeId };
  return Advertisement.countDocuments(filter);
};

export const getPublicHomepage = async (_req, res) => {
  try {
    const now = new Date();
    const [ads, featuredRows] = await Promise.all([
      Advertisement.find({}).sort({ sortOrder: 1, createdAt: -1 }).lean(),
      FeaturedPerformer.find({ active: true }).sort({ sortOrder: 1, createdAt: -1 }).populate('userId').lean(),
    ]);

    const liveAds = ads.filter((ad) => isAdLive(ad, now)).map(serializeAd).slice(0, MAX_LIVE_ADS);
    const featuredUsers = featuredRows
      .filter((row) => row.userId && row.userId.role === 'freelancer' && row.userId.accountStatus !== 'suspended')
      .map((row) => ({
        featuredId: String(row._id),
        headline: row.headline || '',
        ...freelancerBase(row.userId),
      }));

    const badgeMap = await loadBadgesForUsers(featuredUsers.map((u) => u.id));
    const featured = featuredUsers.map((u) => ({ ...u, badges: badgeMap.get(u.id) || [] }));

    res.json({
      ads: liveAds,
      featured,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to load homepage' });
  }
};

export const getPublicFreelancerProfile = async (req, res) => {
  try {
    const userId = String(req.params.userId || '').trim();
    if (!userId) return res.status(400).json({ message: 'Missing freelancer' });

    const featured = await FeaturedPerformer.findOne({ userId, active: true }).lean();
    if (!featured) return res.status(404).json({ message: 'Profile not available' });

    const user = await User.findById(userId).lean();
    if (!user || user.role !== 'freelancer' || user.accountStatus === 'suspended') {
      return res.status(404).json({ message: 'Freelancer not found' });
    }

    const badgeMap = await loadBadgesForUsers([user._id]);
    res.json({
      user: serializePublicFreelancer(user, {
        badges: badgeMap.get(String(user._id)) || [],
        headline: featured.headline || '',
      }),
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to load profile' });
  }
};

export const listAdminAds = async (_req, res) => {
  try {
    const ads = await Advertisement.find({}).sort({ sortOrder: 1, createdAt: -1 }).lean();
    const liveCount = ads.filter((ad) => ad.active).length;
    res.json({ ads: ads.map(serializeAd), liveCount, maxLive: MAX_LIVE_ADS });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to load ads' });
  }
};

export const createAdminAd = async (req, res) => {
  try {
    const title = String(req.body.title || '').trim();
    if (!title) return res.status(400).json({ message: 'Title is required' });

    const active = req.body.active !== 'false' && req.body.active !== false;
    if (active) {
      const liveCount = await countActiveAds();
      if (liveCount >= MAX_LIVE_ADS) {
        return res.status(400).json({
          message: `At most ${MAX_LIVE_ADS} banners can be live at once. Turn one off, then add another.`,
        });
      }
    }

    const ad = await Advertisement.create({
      title,
      subtitle: String(req.body.subtitle || '').trim(),
      organizationName: String(req.body.organizationName || '').trim(),
      ctaLabel: String(req.body.ctaLabel || 'Learn more').trim() || 'Learn more',
      ctaUrl: String(req.body.ctaUrl || '').trim(),
      imagePath: req.file ? `/uploads/ads/${req.file.filename}` : '',
      animation: normalizeAdAnimation(req.body.animation),
      active,
      sortOrder: Number(req.body.sortOrder) || 0,
      startsAt: req.body.startsAt ? new Date(req.body.startsAt) : null,
      endsAt: req.body.endsAt ? new Date(req.body.endsAt) : null,
      createdBy: req.user._id,
    });

    await logAdminAction(req.user, 'homepage_ad_created', {
      targetType: 'advertisement',
      targetId: String(ad._id),
      summary: `Ad created: ${ad.title}`,
    });

    res.status(201).json({ ad: serializeAd(ad) });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to create ad' });
  }
};

export const updateAdminAd = async (req, res) => {
  try {
    const ad = await Advertisement.findById(req.params.adId);
    if (!ad) return res.status(404).json({ message: 'Advertisement not found' });

    if (req.body.title != null) ad.title = String(req.body.title).trim();
    if (req.body.subtitle != null) ad.subtitle = String(req.body.subtitle).trim();
    if (req.body.organizationName != null) ad.organizationName = String(req.body.organizationName).trim();
    if (req.body.ctaLabel != null) ad.ctaLabel = String(req.body.ctaLabel).trim() || 'Learn more';
    if (req.body.ctaUrl != null) ad.ctaUrl = String(req.body.ctaUrl).trim();
    if (req.body.animation != null) ad.animation = normalizeAdAnimation(req.body.animation);
    if (req.body.sortOrder != null) ad.sortOrder = Number(req.body.sortOrder) || 0;
    if (req.body.active != null) {
      const nextActive = req.body.active !== 'false' && req.body.active !== false;
      if (nextActive && !ad.active) {
        const liveCount = await countActiveAds(ad._id);
        if (liveCount >= MAX_LIVE_ADS) {
          return res.status(400).json({
            message: `At most ${MAX_LIVE_ADS} banners can be live at once. Turn one off, then add another.`,
          });
        }
      }
      ad.active = nextActive;
    }
    if (req.body.startsAt !== undefined) ad.startsAt = req.body.startsAt ? new Date(req.body.startsAt) : null;
    if (req.body.endsAt !== undefined) ad.endsAt = req.body.endsAt ? new Date(req.body.endsAt) : null;
    if (req.file) ad.imagePath = `/uploads/ads/${req.file.filename}`;
    if (!ad.title) return res.status(400).json({ message: 'Title is required' });

    await ad.save();
    await logAdminAction(req.user, 'homepage_ad_updated', {
      targetType: 'advertisement',
      targetId: String(ad._id),
      summary: `Ad updated: ${ad.title}`,
    });
    res.json({ ad: serializeAd(ad) });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to update ad' });
  }
};

export const deleteAdminAd = async (req, res) => {
  try {
    const ad = await Advertisement.findByIdAndDelete(req.params.adId);
    if (!ad) return res.status(404).json({ message: 'Advertisement not found' });
    await logAdminAction(req.user, 'homepage_ad_deleted', {
      targetType: 'advertisement',
      targetId: String(ad._id),
      summary: `Ad deleted: ${ad.title}`,
    });
    res.json({ message: 'Advertisement removed' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to delete ad' });
  }
};

const hydrateUsers = async (ids) => {
  const users = await User.find({
    _id: { $in: ids },
    role: 'freelancer',
    accountStatus: { $ne: 'suspended' },
  }).lean();
  const map = new Map(users.map((u) => [String(u._id), u]));
  return ids.map((id) => map.get(String(id))).filter(Boolean);
};

const listHighPerformers = async () => {
  const rows = await WorkSession.aggregate([
    { $match: { status: { $in: PAID_STATUSES } } },
    { $group: { _id: '$freelancerId', completed: { $sum: 1 }, earned: { $sum: { $ifNull: ['$bidAmount', 0] } } } },
    { $sort: { completed: -1, earned: -1 } },
    { $limit: CANDIDATE_LIMIT },
  ]);
  const users = await hydrateUsers(rows.map((r) => r._id));
  const stats = new Map(rows.map((r) => [String(r._id), r]));
  return users.map((u) => ({
    ...freelancerBase(u),
    metricLabel: `${stats.get(String(u._id))?.completed || 0} completed`,
    metricValue: stats.get(String(u._id))?.completed || 0,
    earned: stats.get(String(u._id))?.earned || 0,
  }));
};

const listNewAccounts = async () => {
  const users = await User.find({
    role: 'freelancer',
    accountStatus: { $ne: 'suspended' },
    isEmailVerified: true,
  })
    .sort({ createdAt: -1 })
    .limit(CANDIDATE_LIMIT)
    .lean();
  return users.map((u) => ({
    ...freelancerBase(u),
    metricLabel: u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB') : 'New',
    metricValue: u.createdAt ? new Date(u.createdAt).getTime() : 0,
  }));
};

const listTopBidders = async () => {
  const rows = await JobApplication.aggregate([
    {
      $group: {
        _id: '$freelancerId',
        bids: { $sum: 1 },
        accepted: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
      },
    },
    { $sort: { bids: -1, accepted: -1 } },
    { $limit: CANDIDATE_LIMIT },
  ]);
  const users = await hydrateUsers(rows.map((r) => r._id));
  const stats = new Map(rows.map((r) => [String(r._id), r]));
  return users.map((u) => ({
    ...freelancerBase(u),
    metricLabel: `${stats.get(String(u._id))?.bids || 0} bids`,
    metricValue: stats.get(String(u._id))?.bids || 0,
    accepted: stats.get(String(u._id))?.accepted || 0,
  }));
};

const listPotentials = async () => {
  const users = await User.find({
    role: 'freelancer',
    accountStatus: { $ne: 'suspended' },
    isEmailVerified: true,
  }).lean();

  const sessionCounts = await WorkSession.aggregate([
    { $match: { freelancerId: { $in: users.map((u) => u._id) }, status: { $in: PAID_STATUSES } } },
    { $group: { _id: '$freelancerId', completed: { $sum: 1 } } },
  ]);
  const completedMap = new Map(sessionCounts.map((r) => [String(r._id), r.completed]));

  return users
    .map((u) => {
      const completion = calculateProfileCompletion(u).percentage;
      const completed = completedMap.get(String(u._id)) || 0;
      return {
        ...freelancerBase(u),
        metricLabel: `${completion}% profile · ${completed} paid`,
        metricValue: completion,
        completed,
      };
    })
    .filter((u) => u.metricValue >= 40 && u.completed <= 1)
    .sort((a, b) => b.metricValue - a.metricValue)
    .slice(0, CANDIDATE_LIMIT);
};

const CANDIDATE_LOADERS = {
  high_performers: listHighPerformers,
  new_accounts: listNewAccounts,
  top_bidders: listTopBidders,
  potentials: listPotentials,
};

export const getBadgeCandidates = async (req, res) => {
  try {
    const category = String(req.query.category || '').trim();
    if (category) {
      const loader = CANDIDATE_LOADERS[category];
      if (!loader) return res.status(400).json({ message: 'Unknown candidate category' });
      const candidates = await loader();
      const featured = await FeaturedPerformer.find({ userId: { $in: candidates.map((c) => c.id) } }).lean();
      const featuredSet = new Set(featured.map((f) => String(f.userId)));
      const awards = await UserBadge.find({ userId: { $in: candidates.map((c) => c.id) } }).populate('badgeId').lean();
      const awardMap = new Map();
      awards.forEach((row) => {
        const id = String(row.userId);
        const list = awardMap.get(id) || [];
        if (row.badgeId) list.push({ id: String(row.badgeId._id), label: row.badgeId.label, color: row.badgeId.color });
        awardMap.set(id, list);
      });
      return res.json({
        category,
        categories: CANDIDATE_CATEGORIES,
        candidates: candidates.map((c) => ({
          ...c,
          isFeatured: featuredSet.has(c.id),
          badges: awardMap.get(c.id) || [],
        })),
      });
    }

    const tables = {};
    for (const cat of CANDIDATE_CATEGORIES) {
      tables[cat.key] = await CANDIDATE_LOADERS[cat.key]();
    }
    res.json({ categories: CANDIDATE_CATEGORIES, tables });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to load candidates' });
  }
};

export const listFeaturedPerformers = async (_req, res) => {
  try {
    const rows = await FeaturedPerformer.find({}).sort({ sortOrder: 1, createdAt: -1 }).populate('userId').lean();
    const badgeMap = await loadBadgesForUsers(rows.filter((r) => r.userId).map((r) => String(r.userId._id)));
    res.json({
      featured: rows.filter((r) => r.userId).map((row) => ({
        id: String(row._id),
        headline: row.headline || '',
        candidateCategory: row.candidateCategory,
        sortOrder: row.sortOrder || 0,
        active: !!row.active,
        user: freelancerBase(row.userId),
        badges: badgeMap.get(String(row.userId._id)) || [],
      })),
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to load featured talent' });
  }
};

export const addFeaturedPerformer = async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!userId) return res.status(400).json({ message: 'Select a freelancer' });
    const user = await User.findById(userId);
    if (!user || user.role !== 'freelancer') {
      return res.status(404).json({ message: 'Freelancer not found' });
    }

    const row = await FeaturedPerformer.findOneAndUpdate(
      { userId: user._id },
      {
        $set: {
          headline: String(req.body.headline || '').trim(),
          candidateCategory: CANDIDATE_LOADERS[req.body.candidateCategory] ? req.body.candidateCategory : 'manual',
          sortOrder: Number(req.body.sortOrder) || 0,
          active: req.body.active !== false,
          featuredBy: req.user._id,
        },
      },
      { upsert: true, new: true },
    );

    await logAdminAction(req.user, 'homepage_featured_added', {
      targetType: 'user',
      targetId: String(user._id),
      targetEmail: user.email,
      summary: `Featured ${user.firstName} ${user.lastName} on homepage`,
    });

    res.status(201).json({ id: String(row._id) });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to feature freelancer' });
  }
};

export const removeFeaturedPerformer = async (req, res) => {
  try {
    const row = await FeaturedPerformer.findByIdAndDelete(req.params.featuredId);
    if (!row) return res.status(404).json({ message: 'Featured entry not found' });
    await logAdminAction(req.user, 'homepage_featured_removed', {
      targetType: 'user',
      targetId: String(row.userId),
      summary: 'Removed featured performer from homepage',
    });
    res.json({ message: 'Removed from homepage' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to remove featured performer' });
  }
};

export const listBadges = async (_req, res) => {
  try {
    await ensureDefaultBadges();
    const badges = await Badge.find({}).sort({ label: 1 }).lean();
    res.json({ badges: badges.map(serializeBadge) });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to load badges' });
  }
};

export const saveBadge = async (req, res) => {
  try {
    const key = String(req.body.key || '').trim().toLowerCase().replace(/\s+/g, '_');
    const label = String(req.body.label || '').trim();
    if (!key || !label) return res.status(400).json({ message: 'Key and label are required' });

    const badge = await Badge.findOneAndUpdate(
      { key },
      {
        $set: {
          label,
          description: String(req.body.description || '').trim(),
          color: String(req.body.color || '#0071e3').trim() || '#0071e3',
          active: req.body.active !== false,
        },
      },
      { upsert: true, new: true },
    );

    await logAdminAction(req.user, 'badge_saved', {
      targetType: 'badge',
      targetId: String(badge._id),
      summary: `Badge saved: ${badge.label}`,
    });
    res.json({ badge: serializeBadge(badge) });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to save badge' });
  }
};

export const awardBadge = async (req, res) => {
  try {
    const { userId, badgeId, candidateCategory } = req.body;
    if (!userId || !badgeId) return res.status(400).json({ message: 'Select a freelancer and a badge' });

    const [user, badge] = await Promise.all([User.findById(userId), Badge.findById(badgeId)]);
    if (!user || user.role !== 'freelancer') return res.status(404).json({ message: 'Freelancer not found' });
    if (!badge) return res.status(404).json({ message: 'Badge not found' });

    const existing = await UserBadge.findOne({ userId: user._id, badgeId: badge._id });
    await UserBadge.findOneAndUpdate(
      { userId: user._id, badgeId: badge._id },
      {
        $set: {
          awardedBy: req.user._id,
          candidateCategory: CANDIDATE_LOADERS[candidateCategory] ? candidateCategory : 'manual',
        },
      },
      { upsert: true, new: true },
    );

    if (!existing) {
      await notifyUser({
        userId: user._id,
        type: 'badge_awarded',
        title: `You earned ${badge.label}`,
        message: `${user.firstName}, you received the ${badge.label} badge${badge.description ? `. ${badge.description}` : '.'} Open your profile to download a certificate image for LinkedIn.`,
        link: '/profile/edit',
        meta: { badgeId: badge._id },
      });
    }

    await logAdminAction(req.user, 'badge_awarded', {
      targetType: 'user',
      targetId: String(user._id),
      targetEmail: user.email,
      summary: `Awarded ${badge.label} to ${user.firstName} ${user.lastName}`,
      metadata: { badgeKey: badge.key, candidateCategory: candidateCategory || 'manual' },
    });

    res.json({ message: `Awarded ${badge.label}` });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to award badge' });
  }
};

export const revokeBadge = async (req, res) => {
  try {
    const row = await UserBadge.findByIdAndDelete(req.params.awardId);
    if (!row) return res.status(404).json({ message: 'Award not found' });
    await logAdminAction(req.user, 'badge_revoked', {
      targetType: 'user',
      targetId: String(row.userId),
      summary: 'Badge revoked',
    });
    res.json({ message: 'Badge revoked' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to revoke badge' });
  }
};

export const listUserAwards = async (_req, res) => {
  try {
    const awards = await UserBadge.find({})
      .sort({ createdAt: -1 })
      .populate('userId', 'firstName lastName email profilePicture avatarId freelancerId')
      .populate('badgeId')
      .lean();
    res.json({
      awards: awards
        .filter((row) => row.userId && row.badgeId)
        .map((row) => ({
          id: String(row._id),
          candidateCategory: row.candidateCategory,
          createdAt: row.createdAt,
          user: freelancerBase(row.userId),
          badge: serializeBadge(row.badgeId),
        })),
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to load awards' });
  }
};
