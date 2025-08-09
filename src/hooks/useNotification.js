import { useState, useCallback } from 'react';

/**
 * @description 管理通知狀態的 Hook
 * @returns {object} - 包含通知狀態、顯示通知的函數和清除通知的函數
 */
export function useNotification() {
  const [notification, setNotification] = useState({ message: '', type: '' });

  const showNotification = useCallback((message, type = 'info') => {
    setNotification({ message, type });
  }, []);

  const clearNotification = useCallback(() => {
    setNotification({ message: '', type: '' });
  }, []);

  return { notification, showNotification, clearNotification };
}
