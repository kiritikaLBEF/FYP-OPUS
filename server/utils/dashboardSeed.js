import Transaction from '../models/Transaction.js';
import WorkProject from '../models/WorkProject.js';
import Bid from '../models/Bid.js';
import ActivityEvent from '../models/ActivityEvent.js';

const pad = (n, len = 4) => String(n).padStart(len, '0');

export const DEMO_ORGANIZATION_NAMES = [
  'HimalTech Solutions',
  'Kathmandu Digital Labs',
  'Nepal Innovation Hub',
  'Everest Ventures',
];

export const DEMO_PROJECT_TITLES = [
  'AI Recruitment Portal',
  'E-Commerce Mobile App UI',
  'University LMS Dashboard',
  'Brand Identity & Marketing Kit',
  'FinTech Analytics Dashboard',
  'Social Media Campaign Assets',
  'API Integration for POS',
  'Research Paper Formatting',
];

const demoWorkProjectFilter = (userId) => ({
  userId,
  $or: [
    { isDemo: true },
    { organizationName: { $in: DEMO_ORGANIZATION_NAMES } },
    { title: { $in: DEMO_PROJECT_TITLES } },
  ],
});

const demoBidFilter = (userId) => ({
  userId,
  $or: [
    { isDemo: true },
    { organizationName: { $in: DEMO_ORGANIZATION_NAMES } },
    { projectTitle: { $in: DEMO_PROJECT_TITLES } },
  ],
});

const demoTransactionFilter = (userId, projectRefs = []) => ({
  userId,
  $or: [
    { isDemo: true },
    { organizationName: { $in: DEMO_ORGANIZATION_NAMES } },
    { projectTitle: { $in: DEMO_PROJECT_TITLES } },
    ...(projectRefs.length ? [{ projectRef: { $in: projectRefs } }] : []),
    { description: /^Wallet withdrawal to registered bank account \(Ref: WDR-/ },
  ],
});

const demoActivityFilter = (userId) => ({
  userId,
  $or: [
    { isDemo: true },
    { 'meta.organizationName': { $in: DEMO_ORGANIZATION_NAMES } },
    { 'meta.projectTitle': { $in: DEMO_PROJECT_TITLES } },
    { subtitle: /HimalTech|Kathmandu Digital|Nepal Innovation|Everest Ventures|FinTech Analytics|AWS Certified Developer/i },
    { title: /AWS Certified Developer|3 organizations viewed your profile/i },
  ],
});

/** Remove seeded demo dashboard records for users who got fake data before seeding was disabled. */
export const purgeDemoDashboardData = async (userId) => {
  const demoProjects = await WorkProject.find(demoWorkProjectFilter(userId)).select('projectRef').lean();
  const projectRefs = demoProjects.map((p) => p.projectRef);

  await Promise.all([
    WorkProject.deleteMany(demoWorkProjectFilter(userId)),
    Bid.deleteMany(demoBidFilter(userId)),
    Transaction.deleteMany(demoTransactionFilter(userId, projectRefs)),
    ActivityEvent.deleteMany(demoActivityFilter(userId)),
  ]);
};

export const ensureDashboardData = async (userId, freelancerId) => {
  const existing = await Transaction.countDocuments({ userId, isDemo: { $ne: true } });
  if (existing > 0) {
    await ensureActivityEvents(userId);
    return;
  }

  const year = new Date().getFullYear();
  const orgs = [
    { ref: `ORG-${year}-0145`, name: 'HimalTech Solutions' },
    { ref: `ORG-${year}-0082`, name: 'Kathmandu Digital Labs' },
    { ref: `ORG-${year}-0201`, name: 'Nepal Innovation Hub' },
    { ref: `ORG-${year}-0033`, name: 'Everest Ventures' },
  ];

  const projects = [
    {
      projectRef: `PRJ-${year}-0089`,
      organizationRef: orgs[0].ref,
      organizationName: orgs[0].name,
      title: 'AI Recruitment Portal',
      category: 'coding',
      paymentAmount: 85000,
      status: 'in_progress',
      startDate: new Date(year, 0, 15),
      expectedCompletionDate: new Date(year, 3, 30),
    },
    {
      projectRef: `PRJ-${year}-0062`,
      organizationRef: orgs[1].ref,
      organizationName: orgs[1].name,
      title: 'E-Commerce Mobile App UI',
      category: 'ui_ux',
      paymentAmount: 42000,
      status: 'review',
      startDate: new Date(year - 1, 10, 1),
      expectedCompletionDate: new Date(year, 1, 28),
    },
    {
      projectRef: `PRJ-${year}-0041`,
      organizationRef: orgs[2].ref,
      organizationName: orgs[2].name,
      title: 'University LMS Dashboard',
      category: 'coding',
      paymentAmount: 55000,
      status: 'awaiting_start',
      startDate: new Date(year, 2, 1),
      expectedCompletionDate: new Date(year, 4, 15),
    },
    {
      projectRef: `PRJ-${year}-0018`,
      organizationRef: orgs[3].ref,
      organizationName: orgs[3].name,
      title: 'Brand Identity & Marketing Kit',
      category: 'graphic_design',
      paymentAmount: 28000,
      status: 'completed',
      startDate: new Date(year - 1, 8, 10),
      expectedCompletionDate: new Date(year - 1, 11, 20),
      completedDate: new Date(year - 1, 11, 18),
    },
  ];

  await WorkProject.insertMany(projects.map((p) => ({ ...p, userId, isDemo: true })));

  const bids = [
    { projectRef: projects[0].projectRef, projectTitle: projects[0].title, organizationRef: orgs[0].ref, organizationName: orgs[0].name, amount: 85000, status: 'accepted' },
    { projectRef: projects[1].projectRef, projectTitle: projects[1].title, organizationRef: orgs[1].ref, organizationName: orgs[1].name, amount: 42000, status: 'accepted' },
    { projectRef: projects[2].projectRef, projectTitle: projects[2].title, organizationRef: orgs[2].ref, organizationName: orgs[2].name, amount: 55000, status: 'accepted' },
    { projectRef: projects[3].projectRef, projectTitle: projects[3].title, organizationRef: orgs[3].ref, organizationName: orgs[3].name, amount: 28000, status: 'accepted' },
    { projectRef: `PRJ-${year}-0095`, projectTitle: 'FinTech Analytics Dashboard', organizationRef: orgs[0].ref, organizationName: orgs[0].name, amount: 62000, status: 'pending' },
    { projectRef: `PRJ-${year}-0077`, projectTitle: 'Social Media Campaign Assets', organizationRef: orgs[1].ref, organizationName: orgs[1].name, amount: 18000, status: 'rejected' },
    { projectRef: `PRJ-${year}-0055`, projectTitle: 'API Integration for POS', organizationRef: orgs[2].ref, organizationName: orgs[2].name, amount: 35000, status: 'pending' },
    { projectRef: `PRJ-${year}-0031`, projectTitle: 'Research Paper Formatting', organizationRef: orgs[3].ref, organizationName: orgs[3].name, amount: 12000, status: 'rejected' },
  ];
  await Bid.insertMany(bids.map((b) => ({ ...b, userId, isDemo: true })));

  const txns = [];
  let balance = 0;
  let txnSeq = 1;

  const addTxn = (date, desc, org, proj, type, debit, credit, payStatus = 'completed', txStatus = 'settled') => {
    balance += credit - debit;
    txns.push({
      userId,
      transactionId: `TXN-${year}-${pad(txnSeq++, 6)}`,
      occurredAt: date,
      description: desc,
      organizationRef: org.ref,
      organizationName: org.name,
      projectRef: proj.ref,
      projectTitle: proj.title,
      paymentType: type,
      debit,
      credit,
      runningBalance: balance,
      paymentStatus: payStatus,
      transactionStatus: txStatus,
      isDemo: true,
    });
  };

  const p18 = { ref: projects[3].projectRef, title: projects[3].title };
  const p62 = { ref: projects[1].projectRef, title: projects[1].title };
  const p89 = { ref: projects[0].projectRef, title: projects[0].title };

  addTxn(new Date(year - 1, 9, 5, 14, 30), `Milestone 1 payment received from ${orgs[3].ref} for Project ${p18.ref} – ${p18.title} (Initial delivery)`, orgs[3], p18, 'milestone', 0, 14000);
  addTxn(new Date(year - 1, 10, 12, 11, 0), `Platform service fee (5%) on Project ${p18.ref} – ${p18.title}`, orgs[3], p18, 'platform_fee', 700, 0);
  addTxn(new Date(year - 1, 11, 20, 16, 45), `Final milestone payment from ${orgs[3].ref} for Project ${p18.ref} – ${p18.title} (Completion)`, orgs[3], p18, 'milestone', 0, 14000);
  addTxn(new Date(year - 1, 11, 20, 16, 46), `Platform service fee (5%) on Project ${p18.ref} – ${p18.title} (Final)`, orgs[3], p18, 'platform_fee', 700, 0);
  addTxn(new Date(year, 0, 8, 10, 15), `Milestone 1 payment from ${orgs[1].ref} for Project ${p62.ref} – ${p62.title} (Wireframes & UI Kit)`, orgs[1], p62, 'milestone', 0, 21000);
  addTxn(new Date(year, 0, 8, 10, 16), `Platform service fee (5%) on Project ${p62.ref} – ${p62.title}`, orgs[1], p62, 'platform_fee', 1050, 0);
  addTxn(new Date(year, 0, 22, 9, 30), `Milestone 1 payment from ${orgs[0].ref} for Project ${p89.ref} – ${p89.title} (Discovery & Architecture)`, orgs[0], p89, 'milestone', 0, 25500);
  addTxn(new Date(year, 0, 22, 9, 31), `Platform service fee (5%) on Project ${p89.ref} – ${p89.title}`, orgs[0], p89, 'platform_fee', 1275, 0);
  addTxn(new Date(year, 1, 14, 15, 0), `Milestone 2 payment from ${orgs[0].ref} for Project ${p89.ref} – ${p89.title} (Core Development)`, orgs[0], p89, 'milestone', 0, 29750);
  addTxn(new Date(year, 1, 14, 15, 1), `Platform service fee (5%) on Project ${p89.ref} – ${p89.title} (Milestone 2)`, orgs[0], p89, 'platform_fee', 1487.5, 0);
  addTxn(new Date(year, 1, 28, 12, 0), `Performance bonus from ${orgs[0].ref} for Project ${p89.ref} – ${p89.title} (Early delivery)`, orgs[0], p89, 'bonus', 0, 5000);
  addTxn(new Date(year, 2, 1, 18, 20), `Wallet withdrawal to registered bank account (Ref: WDR-${year}-00012)`, { ref: '', name: '' }, { ref: '', title: '' }, 'withdrawal', 45000, 0);
  addTxn(new Date(year, 2, 5, 11, 45), `Milestone 2 payment from ${orgs[1].ref} for Project ${p62.ref} – ${p62.title} (Prototype)`, orgs[1], p62, 'milestone', 0, 21000, 'pending', 'processing');

  await Transaction.insertMany(txns);

  const activities = [
    {
      type: 'proposal_accepted',
      title: 'HimalTech Solutions accepted your proposal',
      subtitle: 'AI Recruitment Portal · NPR 85,000',
      meta: { organizationRef: orgs[0].ref, organizationName: orgs[0].name, projectRef: projects[0].projectRef, projectTitle: projects[0].title, amount: 85000 },
      occurredAt: new Date(year, 0, 10, 14, 20),
    },
    {
      type: 'payment_received',
      title: 'Milestone payment received',
      subtitle: `NPR 29,750 from ${orgs[0].name} for AI Recruitment Portal (Milestone 2)`,
      meta: { organizationRef: orgs[0].ref, organizationName: orgs[0].name, projectRef: projects[0].projectRef, projectTitle: projects[0].title, amount: 29750 },
      occurredAt: new Date(year, 1, 14, 15, 0),
    },
    {
      type: 'project_invitation',
      title: 'New project invitation received',
      subtitle: 'FinTech Analytics Dashboard from HimalTech Solutions',
      meta: { organizationRef: orgs[0].ref, organizationName: orgs[0].name, projectRef: `PRJ-${year}-0095`, projectTitle: 'FinTech Analytics Dashboard', amount: 62000 },
      occurredAt: new Date(year, 2, 8, 9, 15),
    },
    {
      type: 'project_completed',
      title: 'Project completed successfully',
      subtitle: 'Brand Identity & Marketing Kit for Everest Ventures',
      meta: { organizationRef: orgs[3].ref, organizationName: orgs[3].name, projectRef: projects[3].projectRef, projectTitle: projects[3].title, amount: 28000 },
      occurredAt: new Date(year - 1, 11, 18, 17, 30),
    },
    {
      type: 'certificate_added',
      title: 'Certificate added to your profile',
      subtitle: 'AWS Certified Developer – Associate',
      meta: {},
      occurredAt: new Date(year, 1, 3, 11, 0),
    },
    {
      type: 'portfolio_viewed',
      title: 'Portfolio viewed by an organization',
      subtitle: 'Kathmandu Digital Labs viewed your UI/UX portfolio',
      meta: { organizationRef: orgs[1].ref, organizationName: orgs[1].name },
      occurredAt: new Date(year, 2, 12, 16, 45),
    },
    {
      type: 'profile_viewed',
      title: 'Profile viewed by recruiters',
      subtitle: '3 organizations viewed your profile this week',
      meta: {},
      occurredAt: new Date(year, 2, 14, 8, 30),
    },
    {
      type: 'review_received',
      title: 'New 5-star review received',
      subtitle: 'Everest Ventures rated your work on Brand Identity project',
      meta: { organizationRef: orgs[3].ref, organizationName: orgs[3].name, projectRef: projects[3].projectRef, projectTitle: projects[3].title, rating: 5 },
      occurredAt: new Date(year - 1, 11, 19, 10, 0),
    },
    {
      type: 'withdrawal_completed',
      title: 'Withdrawal completed',
      subtitle: 'NPR 45,000 transferred to your registered bank account',
      meta: { amount: 45000 },
      occurredAt: new Date(year, 2, 1, 18, 25),
    },
    {
      type: 'statement_generated',
      title: 'E-Statement generated',
      subtitle: `Account statement for Q1 ${year} downloaded`,
      meta: {},
      occurredAt: new Date(year, 2, 15, 13, 10),
    },
    {
      type: 'payment_received',
      title: 'Performance bonus received',
      subtitle: `NPR 5,000 bonus from ${orgs[0].name} for early delivery`,
      meta: { organizationRef: orgs[0].ref, organizationName: orgs[0].name, projectRef: projects[0].projectRef, projectTitle: projects[0].title, amount: 5000 },
      occurredAt: new Date(year, 1, 28, 12, 0),
    },
    {
      type: 'proposal_accepted',
      title: 'Nepal Innovation Hub accepted your proposal',
      subtitle: 'University LMS Dashboard · NPR 55,000',
      meta: { organizationRef: orgs[2].ref, organizationName: orgs[2].name, projectRef: projects[2].projectRef, projectTitle: projects[2].title, amount: 55000 },
      occurredAt: new Date(year, 1, 25, 11, 30),
    },
  ];

  await ActivityEvent.insertMany(activities.map((a) => ({ ...a, userId, isDemo: true })));
};

const ensureActivityEvents = async (userId) => {
  const count = await ActivityEvent.countDocuments({ userId, isDemo: { $ne: true } });
  if (count > 0) return;

  const year = new Date().getFullYear();
  const projects = await WorkProject.find({ userId, isDemo: true }).lean();
  if (!projects.length) return;

  const orgs = [...new Map(projects.map((p) => [p.organizationRef, { ref: p.organizationRef, name: p.organizationName }])).values()];
  const p0 = projects.find((p) => p.status === 'in_progress') || projects[0];
  const pDone = projects.find((p) => p.status === 'completed') || projects[0];

  const activities = [
    {
      type: 'proposal_accepted',
      title: `${p0.organizationName} accepted your proposal`,
      subtitle: `${p0.title} · NPR ${p0.paymentAmount.toLocaleString()}`,
      meta: { organizationRef: p0.organizationRef, organizationName: p0.organizationName, projectRef: p0.projectRef, projectTitle: p0.title, amount: p0.paymentAmount },
      occurredAt: new Date(year, 0, 10, 14, 20),
    },
    {
      type: 'payment_received',
      title: 'Milestone payment received',
      subtitle: `Payment from ${p0.organizationName} for ${p0.title}`,
      meta: { organizationRef: p0.organizationRef, organizationName: p0.organizationName, projectRef: p0.projectRef, projectTitle: p0.title, amount: Math.round(p0.paymentAmount * 0.35) },
      occurredAt: new Date(year, 1, 14, 15, 0),
    },
    {
      type: 'project_invitation',
      title: 'New project invitation received',
      subtitle: `FinTech Analytics Dashboard from ${orgs[0]?.name || 'An organization'}`,
      meta: { organizationRef: orgs[0]?.ref, organizationName: orgs[0]?.name, projectRef: `PRJ-${year}-0095`, projectTitle: 'FinTech Analytics Dashboard', amount: 62000 },
      occurredAt: new Date(year, 2, 8, 9, 15),
    },
    {
      type: 'project_completed',
      title: 'Project completed successfully',
      subtitle: `${pDone.title} for ${pDone.organizationName}`,
      meta: { organizationRef: pDone.organizationRef, organizationName: pDone.organizationName, projectRef: pDone.projectRef, projectTitle: pDone.title, amount: pDone.paymentAmount },
      occurredAt: pDone.completedDate || new Date(year - 1, 11, 18),
    },
    {
      type: 'certificate_added',
      title: 'Certificate added to your profile',
      subtitle: 'AWS Certified Developer – Associate',
      meta: {},
      occurredAt: new Date(year, 1, 3, 11, 0),
    },
    {
      type: 'portfolio_viewed',
      title: 'Portfolio viewed by an organization',
      subtitle: `${orgs[1]?.name || orgs[0]?.name || 'An organization'} viewed your portfolio`,
      meta: { organizationRef: orgs[1]?.ref || orgs[0]?.ref, organizationName: orgs[1]?.name || orgs[0]?.name },
      occurredAt: new Date(year, 2, 12, 16, 45),
    },
    {
      type: 'profile_viewed',
      title: 'Profile viewed by recruiters',
      subtitle: '3 organizations viewed your profile this week',
      meta: {},
      occurredAt: new Date(year, 2, 14, 8, 30),
    },
    {
      type: 'review_received',
      title: 'New 5-star review received',
      subtitle: `${pDone.organizationName} rated your work on ${pDone.title}`,
      meta: { organizationRef: pDone.organizationRef, organizationName: pDone.organizationName, projectRef: pDone.projectRef, projectTitle: pDone.title, rating: 5 },
      occurredAt: new Date(year - 1, 11, 19, 10, 0),
    },
    {
      type: 'withdrawal_completed',
      title: 'Withdrawal completed',
      subtitle: 'NPR 45,000 transferred to your registered bank account',
      meta: { amount: 45000 },
      occurredAt: new Date(year, 2, 1, 18, 25),
    },
    {
      type: 'statement_generated',
      title: 'E-Statement generated',
      subtitle: `Account statement for Q1 ${year} downloaded`,
      meta: {},
      occurredAt: new Date(year, 2, 15, 13, 10),
    },
  ];

  await ActivityEvent.insertMany(activities.map((a) => ({ ...a, userId, isDemo: true })));
};
