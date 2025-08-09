import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
// 保持所有現有的 import
import { format, addDays, getDay, parseISO, isBefore, isEqual, addMinutes, set, getHours, isAfter, endOfDay } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { 
    ChevronRight, ChevronDown, ChevronLeft, X, LogIn, LogOut, ArrowLeft, Star, Tag, FileText, 
    PlusCircle, Link2, GitBranch, ShoppingBag, Calendar, Settings, Save, Trash2, User, Phone, 
    Clock, Image as ImageIcon, Video, CheckCircle, Inbox, Users, MapPin, Download, 
    Volume2, VolumeX, Instagram, Mail, Lock, AlertCircle, MessageCircle, Twitter, Facebook 
} from 'lucide-react';
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, collection, doc, addDoc, setDoc, updateDoc, deleteDoc, getDoc, writeBatch, runTransaction, getDocs } from "firebase/firestore";

// 導入新的 Hooks
import { useNotification } from './hooks/useNotification';
import { useModalState } from './hooks/useModalState';
import { useAuth } from './hooks/useAuth';
import { useBookingFlow } from './hooks/useBookingFlow';
import { useFirebaseData } from './hooks/useFirebaseData';

// --- 將所有工具函數和常數移出組件 ---
// (這裡應包含 getFirebaseConfig, appId, ADMIN_UID, CONTACT_TYPES, BOOKING_WINDOW_DAYS, 
// TIME_SLOT_INTERVAL, initialFormSystem, MOCK_*, styles, timeUtils, getEffectiveAvailability, 
// hasBookingConflict, checkEveningRules, isSlotAvailable, generateAvailableTimeSlotsForHour, 
// getHourSummary, createFirebaseUtils, csvUtils, playClickSound 等等...)
// 為了簡潔，此處省略，但實際操作時應將它們全部移到檔案頂部或獨立的 utils.js 檔案中。

// --- 假設的 utils.js 檔案內容 ---
// export const playClickSound = () => { ... };
// export const initialFormSystem = { ... };
// ... etc

// --- 保持所有 UI 組件不變 ---
// const Button = (...) => { ... }
// const FormInput = (...) => { ... }
// ... 所有其他組件 ...
// const BookingSuccessModal = (...) => { ... }

// --- 主 App 組件 ---
export default function App() {
    // --- Firebase 初始化 ---
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);

    useEffect(() => {
        const firebaseConfig = getFirebaseConfig(); // 假設 getFirebaseConfig 在外部
        if (!firebaseConfig) {
            console.error("Firebase config not found. Running in offline/mock mode.");
            // 在離線模式下，hooks 會使用自己的 mock data
            return;
        }
        try {
            const app = initializeApp(firebaseConfig);
            setDb(getFirestore(app));
            setAuth(getAuth(app));
        } catch (error) {
            console.error("Firebase initialization failed:", error);
        }
    }, []);

    // --- 使用自定義 Hooks 管理狀態 ---
    const { notification, showNotification, clearNotification } = useNotification();
    const { isLoginModalOpen, setIsLoginModalOpen, confirmation, setConfirmation } = useModalState();
    const { user, isAdmin, handleLogin: authLogin, handleLogout: authLogout } = useAuth(auth);
    const { 
        currentView, setCurrentView, 
        recommendedPlanId, setRecommendedPlanId,
        selectedPlan, setSelectedPlan,
        formAnswers, setFormAnswers,
        successfulBooking, setSuccessfulBooking,
        rescheduleBooking, setRescheduleBooking,
        resetFlow
    } = useBookingFlow(isAdmin);
    
    // --- 建立依賴於 Hooks 狀態的工具 ---
    const fbUtils = useMemo(() => {
        if (!db) return null;
        // 將 showNotification 傳入，而不是 setNotification
        return createFirebaseUtils(db, (notif) => showNotification(notif.message, notif.type));
    }, [db, showNotification]);

    // --- 使用 useFirebaseData 獲取資料 ---
    const { formSystem, bookings, adminAvailability, loading } = useFirebaseData(db, fbUtils, 'default-app-id');

    // --- 其他狀態和 Refs ---
    const [isMuted, setIsMuted] = useState(false);
    const [hasInteracted, setHasInteracted] = useState(false);
    const audioRef = useRef(null);

    // --- 衍生狀態 (Derived State) ---
    const unreadCount = useMemo(() => bookings.filter(b => !b.isRead).length, [bookings]);
    const pendingCount = useMemo(() => bookings.filter(b => b.completionStatus === 'pending' || !b.completionStatus).length, [bookings]);

    // --- Effects ---
    // 文檔標題 Effect
    useEffect(() => {
        document.title = "筋伸自在預約系統";
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
        script.async = true;
        document.body.appendChild(script);
        return () => { if (document.body.contains(script)) document.body.removeChild(script); }
    }, []);
    
    // 音訊控制 Effect
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !hasInteracted) return;
        const visitorViews = ['form', 'plans', 'calendar'];
        if (isMuted || !visitorViews.includes(currentView) || isAdmin) {
            audio.pause();
        } else {
            audio.play().catch(e => {
                if (process.env.NODE_ENV !== 'production') console.error("Audio play failed:", e);
            });
        }
    }, [isMuted, currentView, isAdmin, hasInteracted]);

    // --- 事件處理函數 (Event Handlers) ---
    // 這些函數協調來自不同 Hook 的狀態和方法，因此保留在 App 組件中是合適的

    const handleFirstInteraction = () => {
        if (hasInteracted) return;
        setHasInteracted(true);
        // ... (其餘邏輯不變)
    };

    const handleFormComplete = (recId) => {
        playClickSound();
        setRecommendedPlanId(recId);
        setCurrentView('plans');
    };

    const handlePlanSelect = (plan) => {
        playClickSound();
        setSelectedPlan(plan);
        setCurrentView('calendar');
    };

    const handleLogin = async (email, password) => {
        const success = await authLogin(email, password);
        if (success) {
            setCurrentView('admin_dashboard');
            setIsLoginModalOpen(false);
        }
        return success;
    };

    const handleLogout = async () => {
        await authLogout();
        resetFlow();
    };

    const handleRescheduleBooking = (booking) => {
        if (!formSystem) return;
        const plan = Object.values(formSystem.recommendations).flatMap(cat => Object.values(cat.plans)).find(p => p.id === booking.planId);
        if (plan) {
            setRescheduleBooking(booking);
            setSelectedPlan(plan);
            setFormAnswers(booking.formAnswers || []);
            setCurrentView('calendar');
        } else {
            showNotification('找不到對應的方案，無法更改時段。', 'error');
        }
    };
    
    // addNewBooking, addRescheduleBooking, cancelBooking, updateAdminAvailability,
    // updateFormSystem, handleMarkAsCompleted, handleMarkAsRead, handleExportBookings,
    // clearAllBookings 等函數保持不變，因為它們依賴於 fbUtils 和多個狀態。
    // 範例：
    const addNewBooking = async (newBookingData) => {
        if (!fbUtils || !selectedPlan || !db) return;
        try {
            const newDocData = await runTransaction(db, async (transaction) => {
                const bookingsRef = collection(db, `${fbUtils.getBasePath('default-app-id')}/bookings`);
                const snapshot = await getDocs(bookingsRef);
                const currentBookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const selectedDateTime = timeUtils.parseDate(newBookingData.startTime);
                if (!isSlotAvailable(selectedDateTime, selectedPlan, currentBookings, adminAvailability, formSystem)) {
                    throw new Error("Conflict: Timeslot just got booked.");
                }
                const newBooking = { ...newBookingData, planId: selectedPlan.id, planName: selectedPlan.name, duration: selectedPlan.duration, restTime: selectedPlan.restTime, formAnswers, isRead: false, completionStatus: 'pending', createdAt: new Date().toISOString() };
                const newDocRef = doc(bookingsRef);
                transaction.set(newDocRef, newBooking);
                return { id: newDocRef.id, ...newBooking };
            });
            if (newDocData) setSuccessfulBooking(newDocData);
        } catch (error) {
            console.error("Booking transaction failed: ", error);
            showNotification(error.message.includes("Conflict") ? '抱歉，此時段已被預約，請選擇其他時段。' : '預約失敗，請稍後再試。', 'error');
        }
    };

    const cancelBooking = (bookingId) => {
        if (!fbUtils) return;
        setConfirmation({
            isOpen: true,
            title: '確認取消預約',
            message: '您確定要取消這個預約嗎？此操作無法復原。',
            onConfirm: async () => {
                if (await fbUtils.deleteDoc(`${fbUtils.getBasePath('default-app-id')}/bookings/${bookingId}`)) {
                    showNotification('預約已成功取消。', 'success');
                }
                setConfirmation(c => ({...c, isOpen: false}));
            }
        });
    };
    
    // ... 其他事件處理函數 ...
    const handleMarkAsRead = useCallback(async (bookingIds) => {
        if (!fbUtils || bookingIds.length === 0) return;
        const operations = bookingIds.map(id => ({ type: 'update', path: `${fbUtils.getBasePath('default-app-id')}/bookings/${id}`, data: { isRead: true } }));
        await fbUtils.writeBatch(operations);
    }, [fbUtils]);


    // --- 渲染邏輯 (Render Logic) ---
    const renderContent = () => {
        if (loading || !formSystem) return <div className="text-center p-10">載入中...</div>;
        if (successfulBooking) return <BookingSuccessModal isOpen={!!successfulBooking} booking={successfulBooking} businessInfo={formSystem.businessInfo || {}} onClose={resetFlow} />;

        const handleBackFromCalendar = () => {
            if (rescheduleBooking) {
                setRescheduleBooking(null);
                setCurrentView('admin_dashboard');
            } else {
                isAdmin ? resetFlow() : setCurrentView('plans');
            }
        };

        // 這裡的 switch-case 邏輯完全保持不變，只需傳入從 Hooks 獲取的 props
        if (isAdmin) {
            // ... (Admin 視圖邏輯不變)
        }
        // ... (Visitor 視圖邏輯不變)
    };

    // --- JSX 渲染 ---
    // 保持 JSX 結構完全相同，但 props 現在來自 Hooks
    return (
        <div className="bg-gray-100 min-h-screen font-sans">
            {formSystem?.businessInfo?.backgroundMusicUrl && <audio ref={audioRef} src={formSystem.businessInfo.backgroundMusicUrl} loop />}
            <div className="w-full max-w-6xl mx-auto p-4 sm:p-6">
                <header className="flex flex-wrap gap-4 justify-between items-center mb-6 pb-4 border-b bg-gray-100 sticky top-0 z-30">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 cursor-pointer" onClick={resetFlow}>筋伸自在預約系統</h1>
                    <div className="flex items-center gap-4">
                        {!isAdmin && formSystem?.businessInfo?.backgroundMusicUrl && <Button variant="ghost" size="icon" onClick={() => setIsMuted(!isMuted)}>{isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}</Button>}
                        {isAdmin ? <Button variant="danger" size="sm" onClick={handleLogout}><LogOut className="w-5 h-5 mr-2" />登出</Button> : <Button variant="primary" size="sm" onClick={() => setIsLoginModalOpen(true)}><LogIn className="w-5 h-5 mr-2" />管理員登入</Button>}
                    </div>
                </header>
                <ErrorBoundary>
                    {/* renderContent 函數的邏輯保持不變，它會根據 currentView 渲染對應的組件 */}
                    {/* {renderContent()} */}
                </ErrorBoundary>
                <AdminLoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} onLogin={handleLogin} />
                <Notification notification={notification} onClose={clearNotification} />
                <ConfirmationModal isOpen={confirmation.isOpen} onClose={() => setConfirmation(c => ({...c, isOpen: false}))} onConfirm={confirmation.onConfirm} title={confirmation.title}>
                    <p>{confirmation.message}</p>
                </ConfirmationModal>
            </div>
        </div>
    );
}

// 注意：所有 UI 組件 (AdminDashboard, AdminEditor, VisitorForm 等) 的程式碼應保持不變。
// 您只需確保傳遞給它們的 props 是正確的。
// 為了保持回應的簡潔性，這裡省略了所有 UI 組件和工具函數的重複程式碼。
