import { useState, useEffect, useMemo, useCallback } from 'react';
import { onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, onSnapshot, collection, getDoc } from "firebase/firestore";
import { initialFormSystem, MOCK_INITIAL_BOOKINGS, MOCK_INITIAL_ADMIN_AVAILABILITY, playClickSound, ADMIN_UID } from './utils';

// =================================================================
// --- useNotification ---
// =================================================================
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


// =================================================================
// --- useModalState ---
// =================================================================
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


// =================================================================
// --- useAuth ---
// =================================================================
export function useAuth(auth) {
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        signInAnonymously(auth).catch(error => 
          console.error("Anonymous sign-in failed:", error)
        );
      }
    });
    return () => unsubscribe();
  }, [auth]);

  const isAdmin = useMemo(() => user?.uid === ADMIN_UID, [user]);

  const handleLogin = async (email, password) => {
    if (!auth) return false;
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return true;
    } catch (error) {
      console.error("Login failed:", error.message);
      return false;
    }
  };

  const handleLogout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return { user, isAdmin, handleLogin, handleLogout };
}


// =================================================================
// --- useBookingFlow ---
// =================================================================
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
  }, [isAdmin]);

  return {
    currentView, setCurrentView,
    recommendedPlanId, setRecommendedPlanId,
    selectedPlan, setSelectedPlan,
    formAnswers, setFormAnswers,
    successfulBooking, setSuccessfulBooking,
    rescheduleBooking, setRescheduleBooking,
    resetFlow
  };
}


// =================================================================
// --- useFirebaseData ---
// =================================================================
export function useFirebaseData(db, fbUtils, appId) {
  const [formSystem, setFormSystem] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [adminAvailability, setAdminAvailability] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !fbUtils) {
      setFormSystem(initialFormSystem);
      setBookings(MOCK_INITIAL_BOOKINGS);
      setAdminAvailability(MOCK_INITIAL_ADMIN_AVAILABILITY);
      setLoading(false);
      return;
    }

    setLoading(true);
    const publicDataPath = fbUtils.getBasePath(appId);

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

    const unsubBookings = onSnapshot(collection(db, `${publicDataPath}/bookings`), (snapshot) => {
      setBookings(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => fbUtils.handleError("讀取預約資料失敗", error));

    const unsubAvailability = onSnapshot(collection(db, `${publicDataPath}/availability`), (snapshot) => {
      const availabilityData = {};
      snapshot.docs.forEach(d => {
        availabilityData[d.id] = d.data();
      });
      setAdminAvailability(availabilityData);
    }, (error) => fbUtils.handleError("讀取可預約時段失敗", error));

    getDoc(doc(db, `${publicDataPath}/systems`, 'formSystem')).finally(() => setLoading(false));

    return () => {
      unsubForm();
      unsubBookings();
      unsubAvailability();
    };
  }, [db, fbUtils, appId]);

  return { formSystem, bookings, adminAvailability, loading };
}
