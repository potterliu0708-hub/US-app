// src/hooks/useNotifications.js
import { useEffect } from 'react';
import { registerFCMToken } from '../../services';

export const useNotifications = () => {
  useEffect(() => {
    registerFCMToken().catch(console.error);
  }, []);
};