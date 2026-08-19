import User from '../models/User.js';
import {
  calculateProfileCompletion,
  PROJECT_CATEGORIES,
  LINK_TYPES,
} from '../utils/profileCompletion.js';
import { DEGREE_OPTIONS, needsDegreeName } from '../utils/constants.js';
import { loadBadgesForUsers } from '../utils/badges.js';

export const getProfile = async (req, res) => {
  const user = req.user;
  const completion = calculateProfileCompletion(user);
  const badgeMap = await loadBadgesForUsers([user._id]);
  res.json({
    user: { ...user.toPublicJSON(), badges: badgeMap.get(String(user._id)) || [] },
    completion,
    meta: { projectCategories: PROJECT_CATEGORIES, linkTypes: LINK_TYPES, degrees: DEGREE_OPTIONS },
  });
};

export const updateProfile = async (req, res) => {
  try {
    const user = req.user;
    const {
      firstName, lastName, username, phone, alternatePhone, country, stateProvince,
      city, address, postalCode, timezone, gender, dateOfBirth,
      degree, degreeName, schoolName, passoutYear, stillRunning,
      interests, bio, careerObjectives, professionalSummary, skills,
      notificationPreferences, privacySettings, language,
    } = req.body;

    if (firstName !== undefined) user.firstName = firstName.trim();
    if (lastName !== undefined) user.lastName = lastName.trim();
    if (phone !== undefined) user.phone = phone.trim();
    if (alternatePhone !== undefined) user.alternatePhone = alternatePhone.trim();
    if (country !== undefined) user.country = country.trim();
    if (stateProvince !== undefined) user.stateProvince = stateProvince.trim();
    if (city !== undefined) user.city = city.trim();
    if (address !== undefined) user.address = address.trim();
    if (postalCode !== undefined) user.postalCode = postalCode.trim();
    if (timezone !== undefined) user.timezone = timezone.trim();
    if (gender !== undefined) user.gender = gender;
    if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;

    if (username !== undefined && username.trim()) {
      const taken = await User.findOne({
        username: username.trim().toLowerCase(),
        _id: { $ne: user._id },
      });
      if (taken) return res.status(400).json({ message: 'Username is already taken' });
      user.username = username.trim().toLowerCase();
    }

    if (degree !== undefined) {
      if (degree && !DEGREE_OPTIONS.includes(degree)) {
        return res.status(400).json({ message: 'Invalid degree' });
      }
      user.degree = degree;
      user.degreeName = needsDegreeName(degree) ? (degreeName || '').trim() : '';
      user.schoolName = (schoolName || '').trim();
      user.stillRunning = !!stillRunning;
      user.passoutYear = stillRunning ? undefined : (passoutYear ? Number(passoutYear) : undefined);
    }

    if (bio !== undefined) user.bio = String(bio).slice(0, 2000);
    if (interests !== undefined) {
      user.interests = [...new Set((Array.isArray(interests) ? interests : []).map((i) => String(i).trim()).filter(Boolean))];
    }
    if (careerObjectives !== undefined) user.careerObjectives = String(careerObjectives).slice(0, 1000);
    if (professionalSummary !== undefined) user.professionalSummary = String(professionalSummary).slice(0, 2000);
    if (skills !== undefined) {
      user.skills = [...new Set((Array.isArray(skills) ? skills : []).map((s) => String(s).trim()).filter(Boolean))];
    }

    if (notificationPreferences) {
      user.notificationPreferences = { ...user.notificationPreferences.toObject?.() || user.notificationPreferences, ...notificationPreferences };
    }
    if (privacySettings) {
      user.privacySettings = { ...user.privacySettings.toObject?.() || user.privacySettings, ...privacySettings };
    }
    if (language !== undefined) user.language = language;

    await user.save();
    const completion = calculateProfileCompletion(user);
    res.json({ message: 'Profile updated', user: user.toPublicJSON(), completion });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ message: err.message || 'Failed to update profile' });
  }
};

export const uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image uploaded' });
    const user = req.user;
    user.profilePicture = `/uploads/profiles/${req.file.filename}`;
    user.avatarId = '';
    await user.save();
    const completion = calculateProfileCompletion(user);
    res.json({ message: 'Photo updated', user: user.toPublicJSON(), completion });
  } catch (err) {
    res.status(500).json({ message: 'Failed to upload photo' });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (user.authProvider === 'google' && !user.password) {
      return res.status(400).json({ message: 'Google-only accounts cannot set password here' });
    }

    const valid = await user.comparePassword(currentPassword);
    if (!valid) return res.status(401).json({ message: 'Current password is incorrect' });

    user.password = await User.hashPassword(newPassword);
    user.authProvider = user.googleId ? 'both' : 'local';
    await user.save();
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to change password' });
  }
};

export const addCertification = async (req, res) => {
  try {
    const { name, organization, issueDate, expirationDate, credentialId, credentialUrl } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Certification name is required' });

    const user = req.user;
    const cert = {
      name: name.trim(),
      organization: (organization || '').trim(),
      issueDate: issueDate ? new Date(issueDate) : undefined,
      expirationDate: expirationDate ? new Date(expirationDate) : undefined,
      credentialId: (credentialId || '').trim(),
      credentialUrl: (credentialUrl || '').trim(),
      filePath: req.file ? `/uploads/certificates/${req.file.filename}` : '',
    };
    user.certifications.push(cert);
    await user.save();
    const completion = calculateProfileCompletion(user);
    res.status(201).json({ message: 'Certification added', user: user.toPublicJSON(), completion });
  } catch (err) {
    res.status(500).json({ message: 'Failed to add certification' });
  }
};

export const updateCertification = async (req, res) => {
  try {
    const user = req.user;
    const cert = user.certifications.id(req.params.id);
    if (!cert) return res.status(404).json({ message: 'Certification not found' });

    const { name, organization, issueDate, expirationDate, credentialId, credentialUrl } = req.body;
    if (name !== undefined) cert.name = name.trim();
    if (organization !== undefined) cert.organization = organization.trim();
    if (issueDate !== undefined) cert.issueDate = issueDate ? new Date(issueDate) : null;
    if (expirationDate !== undefined) cert.expirationDate = expirationDate ? new Date(expirationDate) : null;
    if (credentialId !== undefined) cert.credentialId = credentialId.trim();
    if (credentialUrl !== undefined) cert.credentialUrl = credentialUrl.trim();
    if (req.file) cert.filePath = `/uploads/certificates/${req.file.filename}`;

    await user.save();
    const completion = calculateProfileCompletion(user);
    res.json({ message: 'Certification updated', user: user.toPublicJSON(), completion });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update certification' });
  }
};

export const deleteCertification = async (req, res) => {
  try {
    const user = req.user;
    const cert = user.certifications.id(req.params.id);
    if (!cert) return res.status(404).json({ message: 'Certification not found' });
    cert.deleteOne();
    await user.save();
    const completion = calculateProfileCompletion(user);
    res.json({ message: 'Certification deleted', user: user.toPublicJSON(), completion });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete certification' });
  }
};

export const addProject = async (req, res) => {
  try {
    const { title, description, category, technologies, completionDate, links } = req.body;
    if (!title?.trim()) return res.status(400).json({ message: 'Project title is required' });

    let parsedLinks = [];
    if (links) {
      parsedLinks = typeof links === 'string' ? JSON.parse(links) : links;
    }

    const user = req.user;
    const project = {
      title: title.trim(),
      description: (description || '').trim(),
      category: category || 'other',
      technologies: technologies
        ? (typeof technologies === 'string' ? JSON.parse(technologies) : technologies)
        : [],
      completionDate: completionDate ? new Date(completionDate) : undefined,
      thumbnail: req.files?.thumbnail?.[0] ? `/uploads/projects/${req.files.thumbnail[0].filename}` : '',
      files: (req.files?.files || []).map((f) => `/uploads/projects/${f.filename}`),
      screenshots: (req.files?.screenshots || []).map((f) => `/uploads/projects/${f.filename}`),
      links: parsedLinks.filter((l) => l.url?.trim()),
    };

    user.projects.push(project);
    await user.save();
    const completion = calculateProfileCompletion(user);
    res.status(201).json({ message: 'Project added', user: user.toPublicJSON(), completion });
  } catch (err) {
    console.error('Add project error:', err);
    res.status(500).json({ message: 'Failed to add project' });
  }
};

export const updateProject = async (req, res) => {
  try {
    const user = req.user;
    const project = user.projects.id(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const { title, description, category, technologies, completionDate, links } = req.body;
    if (title !== undefined) project.title = title.trim();
    if (description !== undefined) project.description = description.trim();
    if (category !== undefined) project.category = category;
    if (technologies !== undefined) {
      project.technologies = typeof technologies === 'string' ? JSON.parse(technologies) : technologies;
    }
    if (completionDate !== undefined) project.completionDate = completionDate ? new Date(completionDate) : null;
    if (links !== undefined) {
      project.links = (typeof links === 'string' ? JSON.parse(links) : links).filter((l) => l.url?.trim());
    }
    if (req.files?.thumbnail?.[0]) project.thumbnail = `/uploads/projects/${req.files.thumbnail[0].filename}`;
    if (req.files?.files?.length) project.files.push(...req.files.files.map((f) => `/uploads/projects/${f.filename}`));
    if (req.files?.screenshots?.length) project.screenshots.push(...req.files.screenshots.map((f) => `/uploads/projects/${f.filename}`));

    await user.save();
    const completion = calculateProfileCompletion(user);
    res.json({ message: 'Project updated', user: user.toPublicJSON(), completion });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update project' });
  }
};

export const deleteProject = async (req, res) => {
  try {
    const user = req.user;
    const project = user.projects.id(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    project.deleteOne();
    await user.save();
    const completion = calculateProfileCompletion(user);
    res.json({ message: 'Project deleted', user: user.toPublicJSON(), completion });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete project' });
  }
};

export const deleteAccount = async (req, res) => {
  try {
    const { password, confirmText } = req.body;
    if (confirmText !== 'DELETE') {
      return res.status(400).json({ message: 'Type DELETE to confirm account deletion' });
    }

    const user = await User.findById(req.user._id).select('+password');
    const needsPassword = user.authProvider === 'local' || user.authProvider === 'both';
    if (needsPassword) {
      if (!password) return res.status(400).json({ message: 'Password is required to delete account' });
      const valid = await user.comparePassword(password);
      if (!valid) return res.status(401).json({ message: 'Incorrect password' });
    }

    await User.findByIdAndDelete(user._id);
    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete account' });
  }
};
