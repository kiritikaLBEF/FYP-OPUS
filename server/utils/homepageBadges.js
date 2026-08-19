import Badge from '../models/Badge.js';

export const DEFAULT_BADGES = [
  {
    key: 'top_performer',
    label: 'OPUS Top Performer',
    description: 'Recognized for completed, paid work on OPUS.',
    color: '#0071e3',
  },
  {
    key: 'rising_talent',
    label: 'Rising Talent',
    description: 'New on OPUS with early momentum.',
    color: '#34c759',
  },
  {
    key: 'growing',
    label: 'Growing',
    description: 'Building a consistent delivery record.',
    color: '#ff9500',
  },
  {
    key: 'top_bidder',
    label: 'Top Bidder',
    description: 'Among the most active bidders on the platform.',
    color: '#5856d6',
  },
  {
    key: 'high_potential',
    label: 'High Potential',
    description: 'Strong profile ready to take on more work.',
    color: '#af52de',
  },
];

export const CANDIDATE_CATEGORIES = [
  { key: 'high_performers', label: 'Top 5 high performers', metric: 'Completed paid tasks' },
  { key: 'new_accounts', label: 'New accounts', metric: 'Joined' },
  { key: 'top_bidders', label: 'Top bidders', metric: 'Bids placed' },
  { key: 'potentials', label: 'High potential', metric: 'Profile strength' },
];

export const ensureDefaultBadges = async () => {
  for (const badge of DEFAULT_BADGES) {
    await Badge.updateOne(
      { key: badge.key },
      { $setOnInsert: badge },
      { upsert: true },
    );
  }
};
