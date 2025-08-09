import { useState } from 'react';

/**
 * @description 管理所有模態框（Modal）狀態的 Hook
 * @returns {object} - 包含登入模態框和確認對話框的狀態及設定函數
 */
export function useModalState() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [confirmation, setConfirmation] = useState({ 
    isOpen: false, 
    title: '', 
    message: '', 
    onConfirm: () => {} 
  });

  return {
    isLoginModalOpen, 
    setIsLoginModalOpen,
    confirmation, 
    setConfirmation
  };
}
