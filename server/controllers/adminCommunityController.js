import CommunityGroup from '../models/CommunityGroup.js';
import CommunityMember from '../models/CommunityMember.js';
import User from '../models/User.js';
import AdminActionLog from '../models/AdminActionLog.js';
import { serializeMember, loadAuthorsMap } from '../utils/community.js';

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

const serializeReport = (report) => ({
  id: String(report._id),
  reason: report.reason,
  note: report.note || '',
  status: report.status || 'open',
  reporterName: report.reporterName || '',
  reporterEmail: report.reporterEmail || '',
  createdAt: report.createdAt,
});

const serializeAdminGroup = (group, owner = null) => {
  const sortedReports = [...(group.reports || [])].sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
  );
  const reportLog = sortedReports.map(serializeReport);

  return {
    id: String(group._id),
    name: group.name,
    slug: group.slug,
    description: group.description || '',
    visibility: group.visibility,
    memberCount: group.memberCount || 0,
    moderationStatus: group.moderationStatus || 'active',
    moderationReason: group.moderationReason || '',
    moderatedAt: group.moderatedAt || null,
    reportCount: group.reportCount || 0,
    openReports: reportLog.filter((r) => r.status === 'open').length,
    reports: reportLog.filter((r) => r.status === 'open'),
    reportLog,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
    owner: owner ? {
      id: String(owner._id),
      name: [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim() || owner.email,
      email: owner.email,
    } : null,
  };
};

export const listAdminCommunityGroups = async (req, res) => {
  try {
    const filterKey = String(req.query.filter || 'all').trim();
    const filter = {};
    if (filterKey === 'reported') filter.reportCount = { $gt: 0 };
    else if (filterKey === 'restricted') filter.moderationStatus = 'restricted';
    else if (filterKey === 'suspended') filter.moderationStatus = 'suspended';
    else if (filterKey === 'active') filter.moderationStatus = 'active';

    const groups = await CommunityGroup.find(filter)
      .sort({ reportCount: -1, updatedAt: -1 })
      .limit(200)
      .lean();

    const ownerIds = [...new Set(groups.map((g) => String(g.createdBy)))];
    const owners = await User.find({ _id: { $in: ownerIds } })
      .select('firstName lastName email')
      .lean();
    const ownerMap = Object.fromEntries(owners.map((u) => [String(u._id), u]));

    res.json({
      groups: groups.map((g) => serializeAdminGroup(g, ownerMap[String(g.createdBy)])),
      filter: filterKey,
    });
  } catch (err) {
    console.error('listAdminCommunityGroups:', err);
    res.status(500).json({ message: 'Failed to load community groups' });
  }
};

export const getAdminCommunityGroup = async (req, res) => {
  try {
    const group = await CommunityGroup.findById(req.params.groupId).lean();
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const owner = await User.findById(group.createdBy)
      .select('firstName lastName email role organizationName')
      .lean();

    res.json({ group: serializeAdminGroup(group, owner) });
  } catch (err) {
    console.error('getAdminCommunityGroup:', err);
    res.status(500).json({ message: 'Failed to load group' });
  }
};

export const listAdminCommunityGroupMembers = async (req, res) => {
  try {
    const group = await CommunityGroup.findById(req.params.groupId).lean();
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const members = await CommunityMember.find({ groupId: group._id })
      .sort({ role: -1, joinedAt: 1 })
      .lean();
    const userMap = await loadAuthorsMap(members.map((m) => m.userId));

    res.json({
      members: members.map((m) => serializeMember(m, userMap[String(m.userId)])),
    });
  } catch (err) {
    console.error('listAdminCommunityGroupMembers:', err);
    res.status(500).json({ message: 'Failed to load members' });
  }
};

export const updateAdminCommunityGroupModeration = async (req, res) => {
  try {
    const { status, reason } = req.body;
    const allowed = ['active', 'restricted', 'suspended'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: 'Invalid moderation status' });
    }

    const group = await CommunityGroup.findById(req.params.groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    group.moderationStatus = status;
    group.moderationReason = String(reason || '').trim().slice(0, 500);
    group.moderatedAt = new Date();
    group.moderatedBy = req.user._id;

    if (status === 'active') {
      for (const report of group.reports) {
        report.status = 'dismissed';
      }
      group.reportCount = 0;
    }

    await group.save();

    await logAdminAction(req.user, 'community_group_moderated', {
      targetType: 'community_group',
      targetId: String(group._id),
      summary: `Community group "${group.name}" set to ${status}`,
      metadata: { status, reason: group.moderationReason },
    });

    const owner = await User.findById(group.createdBy)
      .select('firstName lastName email')
      .lean();

    res.json({ group: serializeAdminGroup(group.toObject(), owner) });
  } catch (err) {
    console.error('updateAdminCommunityGroupModeration:', err);
    res.status(500).json({ message: 'Failed to update group moderation' });
  }
};

export const dismissAdminCommunityReports = async (req, res) => {
  try {
    const group = await CommunityGroup.findById(req.params.groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    for (const report of group.reports) {
      report.status = 'dismissed';
    }
    group.reportCount = 0;
    await group.save();

    await logAdminAction(req.user, 'community_reports_dismissed', {
      targetType: 'community_group',
      targetId: String(group._id),
      summary: `Dismissed reports for community group "${group.name}"`,
    });

    const owner = await User.findById(group.createdBy)
      .select('firstName lastName email')
      .lean();

    res.json({ group: serializeAdminGroup(group.toObject(), owner) });
  } catch (err) {
    console.error('dismissAdminCommunityReports:', err);
    res.status(500).json({ message: 'Failed to dismiss reports' });
  }
};
