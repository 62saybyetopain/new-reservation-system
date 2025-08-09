import { format, addDays, getDay, parseISO, isBefore, isEqual, addMinutes, set, getHours, isAfter, endOfDay } from 'date-fns';
import { zhTW } from 'date-fns/locale';
// --- FIX: Added missing firebase/firestore imports ---
import { collection, doc, addDoc, updateDoc, setDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { Phone, Mail, MessageCircle, Instagram, Twitter, Facebook } from 'lucide-react';

// --- Firebase & App Config ---
export const getFirebaseConfig = () => {
    if (typeof window !== 'undefined' && window.injectedFirebaseConfig && window.injectedFirebaseConfig.apiKey) {
        return window.injectedFirebaseConfig;
    }
    if (typeof process !== 'undefined' && process.env && process.env.REACT_APP_FIREBASE_API_KEY) {
        return {
            apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
            authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
            projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
            storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
            messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
            appId: process.env.REACT_APP_FIREBASE_APP_ID
        };
    }
    return null; 
};

export const appId = 'default-app-id';
export const ADMIN_UID = "mbCAypsn8AQ2lmISGRMpD6DzhTZ2";

// --- Constants ---
export const CONTACT_TYPES = [
    { id: 'phone', label: '手機', icon: Phone },
    { id: 'email', label: 'Email', icon: Mail },
    { id: 'line', label: 'Line', icon: MessageCircle },
    { id: 'ig', label: 'IG', icon: Instagram },
    { id: 'twitter', label: 'Twitter', icon: Twitter },
    { id: 'fb', label: 'FB', icon: Facebook }
];
export const BOOKING_WINDOW_DAYS = 21;
export const TIME_SLOT_INTERVAL = 10;

// --- Mock Data & Initial Setup ---
export const initialFormSystem = {
  businessInfo: { address: "請填寫您的地址", mapLink: "https://maps.google.com", successImageUrl: "https://placehold.co/600x300/e0f2fe/0c4a6e?text=預約成功", igLink: "https://instagram.com", igName: "@your_ig_name", backgroundMusicUrl: "" },
  startQuestionId: 'q1',
  questions: { 'q1': { id: 'q1', text: '請問您目前最主要的困擾是什麼？', imageUrl: 'https://placehold.co/600x400/e2e8f0/4a5568?text=Body+Illustration', videoUrl: '', options: [ { text: '身體特定部位痠痛', next: 'q2_pain_location' }, { text: '關節活動有障礙', next: 'q2_joint_issue' }, { text: '沒有特定問題，想日常保養', next: 'rec_experience_30' }, ] }, 'q2_pain_location': { id: 'q2_pain_location', text: '主要痠痛の部位是？', imageUrl: '', videoUrl: '', options: [ { text: '肩頸', next: 'q3_history' }, { text: '下背', next: 'q3_history' }, { text: '腿部', next: 'q3_history' }, ] }, 'q2_joint_issue': { id: 'q2_joint_issue', text: '哪個關節の活動有障礙？', imageUrl: '', videoUrl: '', options: [ { text: '肩膀', next: 'q3_history' }, { text: '膝蓋', next: 'q3_history' }, { text: '手腕', next: 'q3_history' }, ] }, 'q3_history': { id: 'q3_history', text: '是否有明確の受傷史或看過醫生？', imageUrl: '', videoUrl: '', options: [ { text: '有，急性受傷（兩週內）', next: 'rec_half_body' }, { text: '有，慢性舊傷', next: 'rec_full_body' }, { text: '沒有，是長期累積の', next: 'rec_full_body' }, ] } },
  recommendations: { 'experience': { title: '體驗方案', plans: { 'rec_experience_10': { id: 'rec_experience_10', name: '體驗 (10分)', description: '快速體驗，感受初步の放鬆效果。', duration: 10, restTime: 5, price: 300, imageUrl: '', videoUrl: '' }, 'rec_experience_30': { id: 'rec_experience_30', name: '體驗 (30分)', description: '基礎體驗，針對單一部位進行放鬆。', duration: 30, restTime: 10, price: 800, imageUrl: 'https://placehold.co/600x400/dbeafe/1e40af?text=Relaxation', videoUrl: '' }, } }, 'half_body': { title: '系統性半身放鬆', plans: { 'rec_half_body': { id: 'rec_half_body', name: '系統性半身放鬆 (60分)', description: '針對上半身或下半身進行系統性の調理與放鬆。', duration: 60, restTime: 15, price: 1500, imageUrl: '', videoUrl: '' }, } }, 'full_body': { title: '全身完整放鬆', plans: { 'rec_full_body': { id: 'rec_full_body', name: '全身完整放鬆 (120分)', description: '從頭到腳，進行一次全面性の深度調理，徹底釋放壓力。', duration: 120, restTime: 20, price: 2800, imageUrl: '', videoUrl: '' } } } },
  defaultSchedule: { 1: { isOpen: true, slots: [{ start: '09:00', end: '19:00' }] }, 2: { isOpen: true, slots: [{ start: '09:00', end: '19:00' }] }, 3: { isOpen: true, slots: [{ start: '09:00', end: '19:00' }] }, 4: { isOpen: true, slots: [{ start: '09:00', end: '19:00' }] }, 5: { isOpen: true, slots: [{ start: '09:00', end: '19:00' }] }, 6: { isOpen: true, slots: [{ start: '09:00', end: '19:00' }] }, 0: { isOpen: false, slots: [] } }
};
export const MOCK_INITIAL_BOOKINGS = [ { id: 'booking1', planId: 'rec_half_body', planName: '系統性半身放鬆 (60分)', duration: 60, restTime: 15, startTime: '2025-08-10T10:00:00', name: '陳先生', contact: '0912345678', contactType: 'phone', isRead: true, completionStatus: 'pending', formAnswers: [{question: 'q1', answer: 'a1'}], attendees: 1, createdAt: new Date().toISOString() }, ];
export const MOCK_INITIAL_ADMIN_AVAILABILITY = { '2025-08-09': { type: 'rest' }, '2025-08-10': { type: 'open', slots: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '20:00' }] }, '2025-08-11': { type: 'open', slots: [{ start: '09:00', end: '17:00' }] }, };


// --- UI Styles ---
export const styles = {
  card: "bg-white rounded-lg shadow-lg p-6 animate-fade-in",
  modalBackdrop: "fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in",
  modalContent: "bg-white rounded-lg shadow-xl w-full max-h-[90vh] flex flex-col transform transition-all animate-scale-in",
  input: "mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500",
  pageHeader: "flex justify-between items-center mb-6 pb-4 border-b",
  editorSection: "p-4 border rounded-lg bg-gray-50",
  formOptionButton: "w-full p-4 bg-gray-100 hover:bg-blue-100 border border-gray-200 rounded-lg transition-all duration-200 text-lg text-center",
  mainContainer: "bg-white rounded-xl shadow-lg p-4 sm:p-6 animate-fade-in",
  adminDashboardCard: "p-6 border rounded-lg flex flex-col items-center justify-center text-center transition-all",
  bookingListItem: "p-4 border rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3",
  calendarContainer: "pb-4 border rounded-lg bg-white overflow-auto max-h-[70vh]",
  calendarGrid: "grid grid-cols-[auto_repeat(7,_minmax(80px,_1fr))] sm:grid-cols-[auto_repeat(7,_minmax(110px,_1fr))] min-w-[600px] sm:min-w-[800px]",
  stickyTimeHeader: "sticky top-0 left-0 bg-white z-20 p-2 text-xs sm:text-base border-r",
  stickyDateHeader: "text-center py-2 border-b border-l font-medium text-gray-600 sticky top-0 bg-white z-20",
  stickyTimeCell: "text-center text-xs sm:text-sm text-gray-500 py-2 border-r border-t pr-2 sticky left-0 bg-white z-10 flex items-center justify-center",
};

// --- Time & Booking Logic ---
export const timeUtils = {
    formatDate: (date, fmt = 'yyyy-MM-dd') => format(date, fmt, { locale: zhTW }),
    parseDate: parseISO,
    getToday: () => set(new Date(), { hours: 0, minutes: 0, seconds: 0, milliseconds: 0 }),
};

export const getEffectiveAvailability = (day, adminAvailability, defaultSchedule) => {
    const dateKey = timeUtils.formatDate(day);
    const specificSetting = adminAvailability[dateKey];
    if (specificSetting) return specificSetting;

    if (defaultSchedule) {
        const dayOfWeek = getDay(day);
        const defaultDay = defaultSchedule[dayOfWeek];
        if (defaultDay) {
            return defaultDay.isOpen 
                ? { type: 'open', slots: defaultDay.slots } 
                : { type: 'rest' };
        }
    }
    return { type: 'open', slots: [{ start: '09:00', end: '22:00' }] };
};

export const hasBookingConflict = (startTime, endTime, dayBookings) => {
    return dayBookings.some(booking => {
        if (!booking.startTime) return false;
        const bookingStartTime = timeUtils.parseDate(booking.startTime);
        const bookingEndTime = addMinutes(bookingStartTime, booking.duration + booking.restTime);
        return isBefore(startTime, bookingEndTime) && isAfter(endTime, bookingStartTime);
    });
};

export const checkEveningRules = (slotTime, plan, dayBookings) => {
    if (getHours(slotTime) < 19) return true;
    const eveningBookings = dayBookings.filter(b => b.startTime && getHours(timeUtils.parseDate(b.startTime)) >= 19);
    if (plan.duration >= 60 && eveningBookings.length > 0) return false;
    if (eveningBookings.some(b => b.duration >= 60)) return false;
    return true;
};

export const isSlotAvailable = (slotTime, plan, bookings, adminAvailability, formSystem) => {
    if (!slotTime || !plan || isBefore(slotTime, new Date())) return false;
    if (isAfter(slotTime, endOfDay(addDays(timeUtils.getToday(), BOOKING_WINDOW_DAYS - 1)))) return false;

    const dayAvailability = getEffectiveAvailability(slotTime, adminAvailability, formSystem?.defaultSchedule);
    if (dayAvailability.type === 'rest') return false;
    
    const totalEndTime = addMinutes(slotTime, plan.duration + plan.restTime);
    
    const inAdminHours = dayAvailability.slots.some(adminSlot => {
        const dateKey = timeUtils.formatDate(slotTime);
        const adminSlotStart = timeUtils.parseDate(`${dateKey}T${adminSlot.start}:00`);
        const adminSlotEnd = timeUtils.parseDate(`${dateKey}T${adminSlot.end}:00`);
        return !isBefore(slotTime, adminSlotStart) && !isAfter(totalEndTime, adminSlotEnd);
    });
    if (!inAdminHours) return false;
    
    const dateKey = timeUtils.formatDate(slotTime);
    const dayBookings = bookings.filter(b => b.startTime && timeUtils.formatDate(timeUtils.parseDate(b.startTime)) === dateKey);
    if (hasBookingConflict(slotTime, totalEndTime, dayBookings)) return false;
    
    if (!checkEveningRules(slotTime, plan, dayBookings)) return false;
    
    return true;
};

export const generateAvailableTimeSlotsForHour = (hourStart, plan, bookings, adminAvailability, formSystem) => {
    if (!hourStart || !plan) return [];
    const slotsInHour = [];
    for (let i = 0; i < (60 / TIME_SLOT_INTERVAL); i++) {
        const slotStartTime = addMinutes(hourStart, i * TIME_SLOT_INTERVAL);
        if (isSlotAvailable(slotStartTime, plan, bookings, adminAvailability, formSystem)) {
            slotsInHour.push(slotStartTime);
        }
    }
    return slotsInHour;
};

export const getHourSummary = (day, hour, plan, bookings, adminAvailability, formSystem) => {
    const slotDateTimeStart = set(day, { hours: hour, minutes: 0, seconds: 0, milliseconds: 0 });
    if (isBefore(slotDateTimeStart, new Date()) || isAfter(slotDateTimeStart, endOfDay(addDays(timeUtils.getToday(), BOOKING_WINDOW_DAYS - 1)))) {
        return { status: 'unavailable', text: isBefore(slotDateTimeStart, new Date()) ? '已過期' : '未開放' };
    }
    const dayAvailability = getEffectiveAvailability(day, adminAvailability, formSystem?.defaultSchedule);
    if (dayAvailability.type === 'rest') return { status: 'rest', text: '休息' };

    const isHourInAdminSlots = dayAvailability.slots.some(slot => {
        const startHour = parseInt(slot.start.split(':')[0], 10);
        const endHour = parseInt(slot.end.split(':')[0], 10);
        const effectiveEndHour = endHour === 0 ? 24 : endHour;
        return hour >= startHour && hour < effectiveEndHour;
    });
    if (!isHourInAdminSlots) return { status: 'rest', text: '休息' };

    const planToCheck = plan || { duration: 10, restTime: 5 };
    const availableSlots = generateAvailableTimeSlotsForHour(slotDateTimeStart, planToCheck, bookings, adminAvailability, formSystem);
    return availableSlots.length > 0 ? { status: 'available', count: availableSlots.length } : { status: 'full', text: '已額滿' };
};

// --- Firebase Utils ---
export const createFirebaseUtils = (db, showNotification) => ({
    getBasePath: (appId) => `artifacts/${appId}/public/data`,
    handleError: (message, error) => {
        if (process.env.NODE_ENV !== 'production') {
            console.error(message, error);
        }
        showNotification(`${message}，請稍後再試。`, 'error');
    },
    async addDoc(collectionPath, data) {
        try {
            return await addDoc(collection(db, collectionPath), data);
        } catch (error) {
            this.handleError("新增資料失敗", error);
            return null;
        }
    },
    async updateDoc(docPath, data) {
        try {
            await updateDoc(doc(db, docPath), data);
            return true;
        } catch (error) {
            this.handleError("更新資料失敗", error);
            return false;
        }
    },
    async setDoc(docPath, data, options = {}) {
        try {
            await setDoc(doc(db, docPath), data, options);
            return true;
        } catch (error) {
            this.handleError("儲存資料失敗", error);
            return false;
        }
    },
    async deleteDoc(docPath) {
        try {
            await deleteDoc(doc(db, docPath));
            return true;
        } catch (error) {
            this.handleError("刪除資料失敗", error);
            return false;
        }
    },
    async writeBatch(operations) {
        const batch = writeBatch(db);
        operations.forEach(op => {
            const docRef = doc(db, op.path);
            if (op.type === 'update') {
                batch.update(docRef, op.data);
            }
        });
        try {
            await batch.commit();
            return true;
        } catch (error) {
            this.handleError("批次更新失敗", error);
            return false;
        }
    }
});

// --- CSV Utils ---
export const csvUtils = {
    convertBookingsToCSV: (bookings) => {
        const headers = ['預約ID', '預約時間', '客戶姓名', '聯絡方式類型', '聯絡方式', '方案名稱', '時長(分鐘)', '狀態', '建立時間', '問卷內容'];
        const rows = bookings.map(booking => {
            const formAnswersText = booking.formAnswers?.map(qa => `${qa.question}: ${qa.answer}`).join(' | ') || '無問卷資料';
            return [
                booking.id,
                booking.startTime ? timeUtils.formatDate(timeUtils.parseDate(booking.startTime), 'yyyy/MM/dd HH:mm') : '未知',
                booking.name || '',
                CONTACT_TYPES.find(type => type.id === booking.contactType)?.label || '手機',
                booking.contact || '',
                booking.planName || '',
                booking.duration || '',
                booking.completionStatus === 'completed' ? '已完成' : '待完成',
                booking.createdAt ? timeUtils.formatDate(timeUtils.parseDate(booking.createdAt), 'yyyy/MM/dd HH:mm') : '未知',
                formAnswersText
            ];
        });
        const csvContent = [headers, ...rows].map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')).join('\n');
        return '\uFEFF' + csvContent;
    },
    downloadCSV: (csvContent, filename) => {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

// --- Sound Effect ---
let audioCtx;
export const playClickSound = () => {
    try {
        if (typeof window === 'undefined') return;
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.1);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.1);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) {
        if (process.env.NODE_ENV !== 'production') {
            console.error("Could not play sound:", e);
        }
    }
};

// --- Misc Utils ---
export const getPlaceholderByContactType = (contactType) => ({ 
    phone: '請輸入手機號碼', 
    email: '請輸入電子郵件地址', 
    line: '請輸入 Line ID', 
    ig: '請輸入 Instagram 帳號', 
    twitter: '請輸入 Twitter 帳號', 
    fb: '請輸入 Facebook 帳號或連結' 
}[contactType] || '請輸入聯絡方式');
