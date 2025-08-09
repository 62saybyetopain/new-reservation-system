import { useState, useEffect } from 'react';
import { doc, onSnapshot, collection, getDoc } from "firebase/firestore";
import { initialFormSystem, MOCK_INITIAL_BOOKINGS, MOCK_INITIAL_ADMIN_AVAILABILITY } from '../utils'; // 假設 Mock data 被移到 utils.js

/**
 * @description 管理 Firebase 資料訂閱的 Hook
 * @param {object} db - Firestore 的實例
 * @param {object} fbUtils - Firebase 工具函數
 * @param {string} appId - 應用程式 ID
 * @returns {object} - 包含從 Firebase 獲取的資料和載入狀態
 */
export function useFirebaseData(db, fbUtils, appId) {
  const [formSystem, setFormSystem] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [adminAvailability, setAdminAvailability] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 如果 db 或 fbUtils 尚未準備好，則不執行
    if (!db || !fbUtils) {
      // 使用 Mock data 進行離線模式
      setFormSystem(initialFormSystem);
      setBookings(MOCK_INITIAL_BOOKINGS);
      setAdminAvailability(MOCK_INITIAL_ADMIN_AVAILABILITY);
      setLoading(false);
      return;
    }

    setLoading(true);
    const publicDataPath = fbUtils.getBasePath(appId);

    // 訂閱 formSystem
    const unsubForm = onSnapshot(doc(db, `${publicDataPath}/systems`, 'formSystem'), (docSnap) => {
      if (docSnap.exists()) {
        const fetchedData = docSnap.data();
        setFormSystem(prev => ({
          ...initialFormSystem,
          ...fetchedData,
          businessInfo: { ...initialFormSystem.businessInfo, ...(fetchedData.businessInfo || {}) },
          defaultSchedule: fetchedData.defaultSchedule || initialFormSystem.defaultSchedule,
          questions: fetchedData.questions || initialFormSystem.questions,
          recommendations: fetchedData.recommendations || initialFormSystem.recommendations,
        }));
      } else {
        fbUtils.setDoc(`${publicDataPath}/systems/formSystem`, initialFormSystem)
               .then(() => setFormSystem(initialFormSystem));
      }
    }, (error) => fbUtils.handleError("讀取系統設定失敗", error));

    // 訂閱 bookings
    const unsubBookings = onSnapshot(collection(db, `${publicDataPath}/bookings`), (snapshot) => {
      setBookings(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => fbUtils.handleError("讀取預約資料失敗", error));

    // 訂閱 availability
    const unsubAvailability = onSnapshot(collection(db, `${publicDataPath}/availability`), (snapshot) => {
      const availabilityData = {};
      snapshot.docs.forEach(d => {
        availabilityData[d.id] = d.data();
      });
      setAdminAvailability(availabilityData);
    }, (error) => fbUtils.handleError("讀取可預約時段失敗", error));

    // 確保在所有監聽器設定後更新載入狀態
    getDoc(doc(db, `${publicDataPath}/systems`, 'formSystem')).finally(() => setLoading(false));

    // Cleanup 函數，在組件卸載時取消所有訂閱
    return () => {
      unsubForm();
      unsubBookings();
      unsubAvailability();
    };
  }, [db, fbUtils, appId]);

  return { formSystem, bookings, adminAvailability, loading };
}
