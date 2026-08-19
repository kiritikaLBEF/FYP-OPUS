import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const AdminContext = createContext(null);

export function AdminProvider({ children }) {
  const [modal, setModal] = useState(null);

  const closeModal = useCallback(() => setModal(null), []);

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
    }),
    [modal, closeModal, openSendNote, openFlag, openSuspend, openVerify, openDeleteJob, openViewJob],
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}
