import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import EmployerLayout from './EmployerLayout';
import './EmployerLayout.css';

export default function EmployerPanel() {
  const { persistSession, token } = useAuth();

  useEffect(() => {
    if (!token) return;
    api.getEmployerInit()
      .then((data) => {
        if (data.user) persistSession(token, data.user);
      })
      .catch(() => {});
  }, [token, persistSession]);

  return <EmployerLayout />;
}
