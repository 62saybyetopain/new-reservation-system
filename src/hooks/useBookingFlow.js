import { useState, useCallback } from 'react';
import { playClickSound } from '../utils'; // 假設 playClickSound 被移到 utils.js

/**
 * @description 管理整個預約流程狀態的 Hook
 * @param {boolean} isAdmin - 使用者是否為管理員
 * @returns {object} - 包含預約流程中所有狀態和相關操作函數
 */
export function useBookingFlow(isAdmin) {
  const [currentView, setCurrentView] = useState('form');
  const [recommendedPlanId, setRecommendedPlanId] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [formAnswers, setFormAnswers] = useState([]);
  const [successfulBooking, setSuccessfulBooking] = useState(null);
  const [rescheduleBooking, setRescheduleBooking] = useState(null);

  const resetFlow = useCallback(() => {
    playClickSound();
    setCurrentView(isAdmin ? 'admin_dashboard' : 'form');
    setSelectedPlan(null);
    setRecommendedPlanId(null);
    setFormAnswers([]);
    setSuccessfulBooking(null);
    // 注意：這裡不重置 rescheduleBooking，因為可能需要從行事曆返回
  }, [isAdmin]);

  return {
    currentView,
    setCurrentView,
    recommendedPlanId,
    setRecommendedPlanId,
    selectedPlan,
    setSelectedPlan,
    formAnswers,
    setFormAnswers,
    successfulBooking,
    setSuccessfulBooking,
    rescheduleBooking,
    setRescheduleBooking,
    resetFlow
  };
}
