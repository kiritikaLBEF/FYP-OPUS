import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';

const AdminContext = createContext(null);

const EMPTY_BADGES = {
  verification: 0,
  flags: 0,
  gigs: 0,
  community: 0,
};

export function AdminProvider({ children }) {
  const [modal, setModal] = useState(null);
  const [badges, setBadges] = useState(EMPTY_BADGES);

  const closeModal = useCallback(() => setModal(null), []);

  const refreshBadges = useCallback(async () => {
    try {
      const data = await api.getAdminNavBadges();
      setBadges({
        verification: Number(data.verification) || 0,
        flags: Number(data.flags) || 0,
        gigs: Number(data.gigs) || 0,
        community: Number(data.community) || 0,
      });
    } catch {
      /* keep last known counts */
    }
  }, []);

  useEffect(() => {
    refreshBadges();
    const id = window.setInterval(refreshBadges, 20000);
    const onFocus = () => refreshBadges();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshBadges]);

  const openSendNote = useCallback((user, onComplete) => {
    setModal({ type: 'sendNote', user, onComplete });
  }, []);

  const openFlag = useCallback((user, onComplete) => {
    setModal({ type: 'flag', user, onComplete });
  }, []);

  const openSuspend = useCallback((user, onComplete) => {
    setModal({ type: 'suspend', user, onComplete });
  }, []);

  const openVerify = useCallback((user, onComplete) => {
    setModal({ type: 'verify', user, onComplete });
  }, []);

  const openDeleteJob = useCallback((job, onComplete) => {
    setModal({ type: 'deleteJob', job, onComplete });
  }, []);

  const openViewJob = useCallback((job) => {
    setModal({ type: 'viewJob', job });
  }, []);

  const value = useMemo(
    () => ({
      modal,
      closeModal,
      openSendNote,
      openFlag,
      openSuspend,
      openVerify,
      openDeleteJob,
      openViewJob,
      badges,
      refreshBadges,
    }),
    [modal, closeModal, openSendNote, openFlag, openSuspend, openVerify, openDeleteJob, openViewJob, badges, refreshBadges],
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}
