import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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

// Import hooks from the single hooks file
import { useNotification, useModalState, useAuth, useBookingFlow, useFirebaseData } from './hooks'; 

// Import all necessary functions and variables from utils.js
import { 
    getFirebaseConfig, appId, timeUtils, getEffectiveAvailability, isSlotAvailable, 
    getHourSummary, createFirebaseUtils, csvUtils, playClickSound, styles, 
    CONTACT_TYPES, getPlaceholderByContactType, generateAvailableTimeSlotsForHour
} from './utils';

// --- UI Components (All component definitions are now included here) ---

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError(error) { return { hasError: true }; }
    componentDidCatch(error, errorInfo) { console.error('Error caught by boundary:', error, errorInfo); }
    render() {
        if (this.state.hasError) {
            return <div className="text-center p-10 bg-red-50 text-red-700 rounded-lg"><h1>系統發生錯誤，請重新整理頁面。</h1></div>;
        }
        return this.props.children;
    }
}

const Button = ({ variant = 'primary', size = 'md', children, onClick, className = '', ...props }) => {
  const baseClasses = "font-semibold rounded-md transition-colors flex items-center justify-center shadow-sm disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = { primary: "bg-blue-600 text-white hover:bg-blue-700", secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50", danger: "bg-red-600 text-white hover:bg-red-700", success: "bg-green-600 text-white hover:bg-green-700", ghost: "bg-transparent text-gray-600 hover:bg-gray-100", link: "bg-transparent text-blue-600 hover:text-blue-800 p-0 h-auto shadow-none", outline: "bg-transparent border border-blue-500 text-blue-600 hover:bg-blue-50", };
  const sizes = { sm: "px-3 py-1.5 text-sm", md: "px-4 py-2 text-base", lg: "px-6 py-3 text-lg", icon: "p-2" };
  const combinedClasses = `${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`;
  const handleClick = (e) => { playClickSound(); if (onClick) onClick(e); };
  return <button className={combinedClasses} onClick={handleClick} {...props}>{children}</button>;
};

const FormInput = ({ label, type = "text", value, onChange, icon: Icon, id, ...props }) => (
  <div>
    <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
      {Icon && <Icon size={16} className="mr-2 text-gray-500"/>}
      {label}
    </label>
    <input type={type} id={id} value={value} onChange={onChange} className={styles.input} {...props} />
  </div>
);

const Modal = ({ isOpen, onClose, title, children, maxWidth = "lg" }) => {
  if (!isOpen) return null;
  const maxWidthClasses = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg", xl: "max-w-xl", "2xl": "max-w-2xl", "3xl": "max-w-3xl" };
  return (
    <div className={styles.modalBackdrop}>
      <div className={`${styles.modalContent} ${maxWidthClasses[maxWidth] || 'max-w-lg'}`}>
        <div className="p-6 border-b flex justify-between items-center flex-shrink-0">
          <h3 className="text-xl font-bold text-gray-800">{title}</h3>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="關閉"><X size={24} /></Button>
        </div>
        {children}
      </div>
    </div>
  );
};

const NotificationComponent = ({ notification, onClose }) => {
    if (!notification.message) return null;
    const isError = notification.type === 'error';
    const bgColor = isError ? 'bg-red-100' : 'bg-green-100';
    const borderColor = isError ? 'border-red-500' : 'border-green-500';
    const textColor = isError ? 'text-red-700' : 'text-green-700';

    useEffect(() => {
        const timer = setTimeout(onClose, 5000);
        return () => clearTimeout(timer);
    }, [notification, onClose]);

    return (
        <div className={`fixed bottom-5 right-5 max-w-sm w-full p-4 rounded-lg shadow-lg border-l-4 animate-fade-in-up ${bgColor} ${borderColor} ${textColor}`}>
            <div className="flex items-start">
                <AlertCircle size={20} className="mr-3" />
                <p className="flex-grow">{notification.message}</p>
                <button onClick={onClose} className="ml-4"><X size={18} /></button>
            </div>
        </div>
    );
};

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, children }) => {
    if (!isOpen) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="sm">
            <div className="p-6">{children}</div>
            <div className="p-4 bg-gray-50 flex justify-end space-x-3">
                <Button variant="secondary" onClick={onClose}>取消</Button>
                <Button variant="danger" onClick={onConfirm}>確認</Button>
            </div>
        </Modal>
    );
};

const MediaDisplay = ({ imageUrl, videoUrl }) => {
    if (videoUrl) {
        const isYoutube = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
        if (isYoutube) {
            const videoId = videoUrl.split('v=')[1]?.split('&')[0] || videoUrl.split('/').pop();
            return (
                <div className="aspect-w-16 aspect-h-9 mb-4 rounded-lg overflow-hidden shadow-md">
                    <iframe src={`https://www.youtube.com/embed/${videoId}`} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full h-full" title="嵌入式 YouTube 影片"></iframe>
                </div>
            );
        }
        return (
            <video controls className="w-full mb-4 rounded-lg shadow-md">
                <source src={videoUrl} type="video/mp4" />您的瀏覽器不支援影像標籤。
            </video>
        );
    }
    if (imageUrl) {
        return <img src={imageUrl} alt="相關媒體內容" className="w-full h-auto object-cover mb-4 rounded-lg shadow-md" onError={(e) => { e.target.style.display = 'none'; }} />;
    }
    return null;
};

function AdminDashboard({ onNavigate, unreadCount, pendingCount }) {
    const CUSTOMER_DATA_CENTER_URL = "https://your-customer-data-center.com";
    return (
        <div className={`${styles.card} p-6 sm:p-10 max-w-5xl mx-auto`}>
            <h1 className="text-2xl sm:text-3xl font-bold text-center mb-8 text-gray-800">管理員儀表板</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <button onClick={() => { playClickSound(); onNavigate('admin_editor'); }} className={`${styles.adminDashboardCard} bg-green-50 hover:bg-green-100 border-green-200`}>
                    <GitBranch className="w-12 h-12 text-green-600 mb-2" />
                    <span className="text-lg font-semibold text-green-800">系統資訊管理</span>
                    <p className="text-sm text-gray-500 mt-1">編輯問卷與方案</p>
                </button>
                <button onClick={() => { playClickSound(); onNavigate('calendar'); }} className={`${styles.adminDashboardCard} bg-blue-50 hover:bg-blue-100 border-blue-200 relative`}>
                    {unreadCount > 0 && <span className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold">{unreadCount}</span>}
                    <Calendar className="w-12 h-12 text-blue-600 mb-2" />
                    <span className="text-lg font-semibold text-blue-800">行事曆管理</span>
                    <p className="text-sm text-gray-500 mt-1">查看與設定時段</p>
                </button>
                <button onClick={() => { playClickSound(); onNavigate('admin_pending_list'); }} className={`${styles.adminDashboardCard} bg-yellow-50 hover:bg-yellow-100 border-yellow-200 relative`}>
                    {pendingCount > 0 && <span className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-white text-xs font-bold">{pendingCount}</span>}
                    <Inbox className="w-12 h-12 text-yellow-600 mb-2" />
                    <span className="text-lg font-semibold text-yellow-800">待完成預約</span>
                    <p className="text-sm text-gray-500 mt-1">管理待處理預約</p>
                </button>
                <button onClick={() => { playClickSound(); onNavigate('history_bookings'); }} className={`${styles.adminDashboardCard} bg-purple-50 hover:bg-purple-100 border-purple-200`}>
                    <FileText className="w-12 h-12 text-purple-600 mb-2" />
                    <span className="text-lg font-semibold text-purple-800">歷史預約紀錄</span>
                    <p className="text-sm text-gray-500 mt-1">查看所有預約資料</p>
                </button>
                <button onClick={() => { playClickSound(); window.open(CUSTOMER_DATA_CENTER_URL, '_blank'); }} className={`${styles.adminDashboardCard} bg-indigo-50 hover:bg-indigo-100 border-indigo-200`}>
                    <Users className="w-12 h-12 text-indigo-600 mb-2" />
                    <span className="text-lg font-semibold text-indigo-800">顧客資料中心</span>
                    <p className="text-sm text-gray-500 mt-1">管理顧客資訊</p>
                </button>
            </div>
        </div>
    );
}

function AdminEditor({ formSystem: initialFormSystem, onUpdate, onExit, setConfirmation }) {
    const [internalFormSystem, setInternalFormSystem] = useState(() => JSON.parse(JSON.stringify(initialFormSystem)));
    const updateField = (path, value) => {
        setInternalFormSystem(prev => {
            const keys = path.split('.');
            let current = JSON.parse(JSON.stringify(prev));
            let obj = current;
            for (let i = 0; i < keys.length - 1; i++) {
                obj = obj[keys[i]] = obj[keys[i]] || {};
            }
            obj[keys[keys.length - 1]] = value;
            return current;
        });
    };
    const handleSave = () => onUpdate(internalFormSystem);
    const handleRemoveQuestion = (questionId) => {
        setConfirmation({
            isOpen: true, title: '確認刪除問題', message: '您確定要刪除這個問題嗎？所有指向此問題的選項都需要手動修改。此變更將在儲存後生效。',
            onConfirm: () => {
                setInternalFormSystem(prev => {
                    const newQuestions = { ...prev.questions };
                    delete newQuestions[questionId];
                    const newStartQuestionId = prev.startQuestionId === questionId ? Object.keys(newQuestions)[0] || '' : prev.startQuestionId;
                    return { ...prev, questions: newQuestions, startQuestionId: newStartQuestionId };
                });
                setConfirmation(c => ({...c, isOpen: false}));
            }
        });
    };

    return (
        <div className={styles.card}>
            <div className={`${styles.pageHeader} flex-col sm:flex-row items-start sm:items-center gap-4`}>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800">系統資訊編輯器</h2>
                <div className="flex-shrink-0 flex gap-2">
                    <Button variant="secondary" size="sm" onClick={onExit}>返回儀表板</Button>
                    <Button variant="primary" size="sm" onClick={handleSave}><Save className="w-4 h-4 mr-2"/>儲存變更</Button>
                </div>
            </div>
            <div className="space-y-8">
                <BusinessInfoEditor formSystem={internalFormSystem} updateField={updateField} />
                <DefaultScheduleEditor formSystem={internalFormSystem} updateField={updateField} />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <FormStructureEditor formSystem={internalFormSystem} updateField={updateField} setInternalFormSystem={setInternalFormSystem} onRemoveQuestion={handleRemoveQuestion} />
                    <PlanDetailsEditor formSystem={internalFormSystem} updateField={updateField} />
                </div>
            </div>
        </div>
    );
}

function BusinessInfoEditor({ formSystem, updateField }) {
    const info = formSystem.businessInfo || {};
    return (
        <div className={styles.editorSection}>
            <h3 className="text-xl font-semibold mb-4 text-gray-700">商家與聯絡資訊</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormInput label="地址" value={info.address || ''} onChange={e => updateField('businessInfo.address', e.target.value)} />
                <FormInput label="Google 地圖連結" value={info.mapLink || ''} onChange={e => updateField('businessInfo.mapLink', e.target.value)} />
                <FormInput label="Instagram 連結" value={info.igLink || ''} onChange={e => updateField('businessInfo.igLink', e.target.value)} />
                <FormInput label="Instagram 名稱 (e.g., @your_name)" value={info.igName || ''} onChange={e => updateField('businessInfo.igName', e.target.value)} />
                <div className="md:col-span-2"><FormInput label="預約成功頁面圖片網址" value={info.successImageUrl || ''} onChange={e => updateField('businessInfo.successImageUrl', e.target.value)} /></div>
                <div className="md:col-span-2"><FormInput label="背景音樂網址 (MP3, WAV...)" value={info.backgroundMusicUrl || ''} onChange={e => updateField('businessInfo.backgroundMusicUrl', e.target.value)} placeholder="https://..." /></div>
            </div>
        </div>
    );
}

function DefaultScheduleEditor({ formSystem, updateField }) {
    const dayNames = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
    const schedule = formSystem.defaultSchedule || {};
    const handleDayToggle = (dayIndex) => updateField(`defaultSchedule.${dayIndex}.isOpen`, !schedule[dayIndex]?.isOpen);
    const handleTimeChange = (field, value) => {
        const newSchedule = JSON.parse(JSON.stringify(schedule));
        Object.keys(newSchedule).forEach(dayIndex => {
            if (newSchedule[dayIndex].isOpen) {
                if (!newSchedule[dayIndex].slots?.length) newSchedule[dayIndex].slots = [{ start: '09:00', end: '19:00' }];
                newSchedule[dayIndex].slots[0][field] = value;
            }
        });
        updateField('defaultSchedule', newSchedule);
    };
    const firstOpenDaySlot = Object.values(schedule).find(d => d.isOpen && d.slots?.length > 0)?.slots[0] || { start: '09:00', end: '19:00' };

    return (
        <div className={styles.editorSection}>
            <h3 className="text-xl font-semibold mb-4 text-gray-700">預設營業時間</h3>
            <p className="text-sm text-gray-500 mb-4">設定一週內每天的預設營業或休息狀態。此設定將套用至所有未單獨設定的日期。</p>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mb-4">
                {dayNames.map((name, dayIndex) => (
                    <button key={dayIndex} onClick={() => handleDayToggle(dayIndex)} className={`p-2 text-sm rounded transition-colors ${schedule[dayIndex]?.isOpen ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'}`}>
                        {name}
                    </button>
                ))}
            </div>
            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">統一營業時段</label>
                <div className="flex items-center space-x-2 max-w-sm">
                    <input type="time" value={firstOpenDaySlot.start} onChange={e => handleTimeChange('start', e.target.value)} className={styles.input} />
                    <span>-</span>
                    <input type="time" value={firstOpenDaySlot.end} onChange={e => handleTimeChange('end', e.target.value)} className={styles.input} />
                </div>
                <p className="text-xs text-gray-500">註：此時段設定將套用至上方所有標示為「營業」的日子。</p>
            </div>
        </div>
    );
}

function FormStructureEditor({ formSystem, updateField, setInternalFormSystem, onRemoveQuestion }) {
    const addQuestion = () => { const newId = `q_${Date.now()}`; setInternalFormSystem(prev => ({ ...prev, questions: { ...prev.questions, [newId]: { id: newId, text: '新的問題', imageUrl: '', videoUrl: '', options: [{ text: '選項 1', next: '' }] }}})); };
    const addOption = (qId) => updateField(`questions.${qId}.options`, [...formSystem.questions[qId].options, { text: '新的選項', next: '' }]);
    const removeOption = (qId, optIdx) => updateField(`questions.${qId}.options`, formSystem.questions[qId].options.filter((_, i) => i !== optIdx));
    const allNextOptions = useMemo(() => [
        ...Object.values(formSystem.questions).map(q => ({ value: q.id, label: `問題: ${q.text.substring(0, 15)}...` })),
        ...Object.values(formSystem.recommendations).flatMap(cat => Object.values(cat.plans)).map(p => ({ value: p.id, label: `方案: ${p.name}` }))
    ], [formSystem.questions, formSystem.recommendations]);

    return (
        <div>
            <h3 className="text-xl font-semibold mb-4 text-gray-700">問卷流程</h3>
            <div className="space-y-6">
                {Object.values(formSystem.questions).map(q => (
                    <div key={q.id} className={styles.editorSection}>
                        <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center flex-grow"><GitBranch className="w-5 h-5 mr-2 text-gray-500" /><input value={q.text} onChange={e => updateField(`questions.${q.id}.text`, e.target.value)} className="text-lg font-semibold w-full p-1 rounded border border-transparent hover:border-gray-300 focus:border-blue-500" /></div>
                            <Button variant="ghost" size="icon" onClick={() => onRemoveQuestion(q.id)} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></Button>
                        </div>
                        <div className="space-y-2 pl-7 mb-3">
                            <div className="flex items-center text-sm space-x-2"> <ImageIcon size={16} className="text-gray-500"/> <input value={q.imageUrl || ''} placeholder="圖片網址 (e.g., https://...)" onChange={e => updateField(`questions.${q.id}.imageUrl`, e.target.value)} className="w-full p-1 rounded border text-xs" /> </div>
                            <div className="flex items-center text-sm space-x-2"> <Video size={16} className="text-gray-500"/> <input value={q.videoUrl || ''} placeholder="影片網址 (e.g., YouTube, .mp4)" onChange={e => updateField(`questions.${q.id}.videoUrl`, e.target.value)} className="w-full p-1 rounded border text-xs" /> </div>
                        </div>
                        <div className="space-y-2 pl-7">
                            {q.options.map((opt, i) => (
                                <div key={i} className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                                    <input value={opt.text} onChange={e => updateField(`questions.${q.id}.options.${i}.text`, e.target.value)} className="w-full sm:w-1/3 p-1 rounded border" />
                                    <Link2 className="w-4 h-4 text-gray-400 hidden sm:block" />
                                    <select value={opt.next} onChange={e => updateField(`questions.${q.id}.options.${i}.next`, e.target.value)} className="w-full sm:w-2/3 p-1 rounded border">
                                        <option value="">選擇下一個步驟...</option>
                                        {allNextOptions.map(nextOpt => <option key={nextOpt.value} value={nextOpt.value}>{nextOpt.label}</option>)}
                                    </select>
                                    <Button variant="ghost" size="icon" onClick={() => removeOption(q.id, i)} className="text-red-400 hover:text-red-600 flex-shrink-0"><X size={16} /></Button>
                                </div>
                            ))}
                            <Button variant="link" size="sm" onClick={() => addOption(q.id)}><PlusCircle className="w-4 h-4 mr-1"/>新增選項</Button>
                        </div>
                    </div>
                ))}
                <Button variant="outline" onClick={addQuestion} className="w-full py-2 border-dashed"><PlusCircle className="w-5 h-5 mr-2"/>新增問題</Button>
            </div>
        </div>
    );
}

function PlanDetailsEditor({ formSystem, updateField }) {
    return (
        <div>
            <h3 className="text-xl font-semibold mb-4 text-gray-700">方案內容</h3>
            <div className="space-y-4">
                {Object.entries(formSystem.recommendations).map(([categoryKey, category]) => (
                    <div key={categoryKey} className={styles.editorSection}>
                        <input value={category.title} onChange={e => updateField(`recommendations.${categoryKey}.title`, e.target.value)} className="text-lg font-bold w-full p-1 rounded border border-transparent hover:border-gray-300 focus:border-blue-500 mb-3" />
                        {Object.values(category.plans).map(plan => (
                            <div key={plan.id} className="space-y-2 p-3 border-t">
                                <div className="flex items-center"><ShoppingBag className="w-4 h-4 mr-2 text-gray-500"/><input value={plan.name} onChange={e => updateField(`recommendations.${categoryKey}.plans.${plan.id}.name`, e.target.value)} className="p-1 w-full border rounded font-medium"/></div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <div className="flex items-center"><Clock className="w-4 h-4 mr-2 text-gray-500"/><input type="number" value={plan.duration} onChange={e => updateField(`recommendations.${categoryKey}.plans.${plan.id}.duration`, Number(e.target.value))} className="p-1 w-full border rounded"/> <span className="text-xs ml-1">分</span></div>
                                    <div className="flex items-center"><Tag className="w-4 h-4 mr-2 text-gray-500"/>$<input type="number" value={plan.price} onChange={e => updateField(`recommendations.${categoryKey}.plans.${plan.id}.price`, Number(e.target.value))} className="p-1 w-full border rounded"/></div>
                                    <div className="flex items-center"><span className="text-xs mr-1">緩衝</span><input type="number" value={plan.restTime} onChange={e => updateField(`recommendations.${categoryKey}.plans.${plan.id}.restTime`, Number(e.target.value))} className="p-1 w-full border rounded"/> <span className="text-xs ml-1">分</span></div>
                                </div>
                                <div className="flex items-start"><FileText className="w-4 h-4 mr-2 mt-1 text-gray-500"/><textarea value={plan.description} onChange={e => updateField(`recommendations.${categoryKey}.plans.${plan.id}.description`, e.target.value)} className="w-full p-1 border rounded text-sm" rows="2"/></div>
                                <div className="flex items-center text-sm space-x-2 mt-2"> <ImageIcon size={16} className="text-gray-500"/> <input value={plan.imageUrl || ''} placeholder="圖片網址 (e.g., https://...)" onChange={e => updateField(`recommendations.${categoryKey}.plans.${plan.id}.imageUrl`, e.target.value)} className="w-full p-1 rounded border text-xs" /> </div>
                                <div className="flex items-center text-sm space-x-2"> <Video size={16} className="text-gray-500"/> <input value={plan.videoUrl || ''} placeholder="影片網址 (e.g., YouTube, .mp4)" onChange={e => updateField(`recommendations.${categoryKey}.plans.${plan.id}.videoUrl`, e.target.value)} className="w-full p-1 rounded border text-xs" /> </div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

function PendingBookingsList({ bookings, onMarkAsCompleted, onBack }) {
    const [isQuestionnaireModalOpen, setIsQuestionnaireModalOpen] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const pendingBookings = useMemo(() => bookings.filter(b => b.completionStatus !== 'completed').sort((a, b) => {
        const dateA = a.startTime ? timeUtils.parseDate(a.startTime) : 0;
        const dateB = b.startTime ? timeUtils.parseDate(b.startTime) : 0;
        return dateA - dateB;
    }), [bookings]);
    const handleViewQuestionnaire = (booking) => { setSelectedBooking(booking); setIsQuestionnaireModalOpen(true); };

    return (
        <div className={`${styles.card} p-6 sm:p-8 max-w-4xl mx-auto`}>
            <div className="flex items-center justify-between mb-6 pb-4 border-b">
                <Button variant="ghost" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1"/>返回儀表板</Button>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">待完成預約 ({pendingBookings.length})</h1>
                <div className="w-32"></div>
            </div>
            <div className="space-y-4">
                {pendingBookings.length > 0 ? (
                    pendingBookings.map(booking => (
                        <div key={booking.id} className={`${styles.editorSection} flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4`}>
                            <div>
                                <p className="font-bold text-gray-800">{booking.startTime ? timeUtils.formatDate(timeUtils.parseDate(booking.startTime), 'yyyy/MM/dd HH:mm') : '時間未知'} - {booking.name}</p>
                                <p className="text-sm text-gray-600">{booking.planName} ({booking.duration}分)</p>
                                <p className="text-sm text-gray-500">{(CONTACT_TYPES.find(type => type.id === booking.contactType)?.label || '手機')}: {booking.contact}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <Button variant="outline" size="sm" onClick={() => handleViewQuestionnaire(booking)}>查看問卷</Button>
                                <Button variant="success" size="sm" onClick={() => onMarkAsCompleted(booking.id)}><CheckCircle size={16} className="mr-1.5" />標示為已完成</Button>
                            </div>
                        </div>
                    ))
                ) : <p className="text-center text-gray-500 py-10">太棒了！沒有待處理的預約。</p>}
            </div>
            {isQuestionnaireModalOpen && selectedBooking && <QuestionnaireModal isOpen={isQuestionnaireModalOpen} onClose={() => setIsQuestionnaireModalOpen(false)} booking={selectedBooking} />}
        </div>
    );
}

function HistoryBookingsPage({ bookings, onBack, onExport, onClearAll }) {
    const sortedBookings = useMemo(() => [...bookings].sort((a, b) => {
        const dateA = a.startTime ? timeUtils.parseDate(a.startTime) : 0;
        const dateB = b.startTime ? timeUtils.parseDate(b.startTime) : 0;
        return dateB - dateA;
    }), [bookings]);
    const [isQuestionnaireModalOpen, setIsQuestionnaireModalOpen] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const handleViewQuestionnaire = (booking) => { setSelectedBooking(booking); setIsQuestionnaireModalOpen(true); };

    return (
        <div className={`${styles.card} p-6 sm:p-8 max-w-6xl mx-auto`}>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b">
                <Button variant="ghost" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1"/>返回儀表板</Button>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">歷史預約紀錄 ({bookings.length})</h1>
                <div className="flex gap-2">
                    <Button variant="primary" size="sm" onClick={onExport}><Download className="w-4 h-4 mr-1"/>匯出紀錄</Button>
                    <Button variant="danger" size="sm" onClick={onClearAll}><Trash2 className="w-4 h-4 mr-1"/>清除所有資料</Button>
                </div>
            </div>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                {sortedBookings.length > 0 ? (
                    sortedBookings.map(booking => (
                        <div key={booking.id} className={`${styles.editorSection} flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4`}>
                            <div className="flex-grow">
                                <div className="flex items-center gap-3">
                                    <p className="font-bold text-gray-800">{booking.startTime ? timeUtils.formatDate(timeUtils.parseDate(booking.startTime), 'yyyy/MM/dd HH:mm') : '時間未知'}</p>
                                    <span className={`px-2 py-1 text-xs rounded-full ${booking.completionStatus === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                        {booking.completionStatus === 'completed' ? '已完成' : '待完成'}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">{booking.name} - {(CONTACT_TYPES.find(type => type.id === booking.contactType)?.label || '手機')}: {booking.contact}</p>
                                <p className="text-sm text-gray-500">{booking.planName} ({booking.duration}分)</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <Button variant="outline" size="sm" onClick={() => handleViewQuestionnaire(booking)}>查看問卷</Button>
                            </div>
                        </div>
                    ))
                ) : <p className="text-center text-gray-500 py-10">尚無預約紀錄。</p>}
            </div>
            {isQuestionnaireModalOpen && selectedBooking && <QuestionnaireModal isOpen={isQuestionnaireModalOpen} onClose={() => setIsQuestionnaireModalOpen(false)} booking={selectedBooking} />}
        </div>
    );
}

function VisitorForm({ formSystem, onComplete, setFormAnswers, onFirstInteraction }) {
    const [currentQuestionId, setCurrentQuestionId] = useState(formSystem.startQuestionId);
    const [history, setHistory] = useState([]);
    const [answers, setAnswers] = useState([]);
    const handleOptionClick = (option) => {
        onFirstInteraction();
        const currentQuestion = formSystem.questions[currentQuestionId];
        const newAnswers = [...answers, { question: currentQuestion.text, answer: option.text }];
        setAnswers(newAnswers);
        setFormAnswers(newAnswers);
        setHistory([...history, currentQuestionId]);
        const nextId = option.next;
        if (nextId.startsWith('q')) setCurrentQuestionId(nextId);
        else if (nextId.startsWith('rec')) onComplete(nextId);
    };
    const handleBack = () => {
        if (history.length > 0) {
            const prevId = history.pop();
            setHistory(history.slice(0, -1));
            setCurrentQuestionId(prevId);
            const newAnswers = answers.slice(0, -1);
            setAnswers(newAnswers);
            setFormAnswers(newAnswers);
        }
    };
    const currentQuestion = formSystem.questions[currentQuestionId];
    if (!currentQuestion) return <div>問卷載入錯誤，請重整頁面。</div>;
    const progress = (history.length / Object.keys(formSystem.questions).length) * 100;
    return (
        <div className={`${styles.card} p-6 sm:p-10 max-w-2xl mx-auto`}>
            <MediaDisplay imageUrl={currentQuestion.imageUrl} videoUrl={currentQuestion.videoUrl} />
            <div className="mb-8">
                {history.length > 0 && <Button variant="ghost" onClick={handleBack}><ArrowLeft className="w-4 h-4 mr-1"/>返回</Button>}
                <div className="w-full bg-gray-200 rounded-full h-2.5 my-4"><div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div></div>
                <h2 className="text-2xl font-semibold text-gray-800 text-center">{currentQuestion.text}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {currentQuestion.options.map((option, index) => (
                    <button key={index} onClick={() => { playClickSound(); handleOptionClick(option); }} className={`${styles.formOptionButton} ${currentQuestion.options.length % 2 !== 0 && index === currentQuestion.options.length - 1 ? 'sm:col-span-2' : ''}`}>
                        {option.text}
                    </button>
                ))}
            </div>
        </div>
    );
}

function PlanSelectionPage({ formSystem, recommendedPlanId, onPlanSelect, onBack }) {
    const findRecommendationCategory = useCallback((recId) => {
        for (const categoryKey in formSystem.recommendations) {
            if (formSystem.recommendations[categoryKey].plans[recId]) return categoryKey;
        }
        return null;
    }, [formSystem.recommendations]);
    
    const [expandedCategory, setExpandedCategory] = useState(() => findRecommendationCategory(recommendedPlanId));
    const categoryOrder = useMemo(() => ['experience', 'half_body', 'full_body'], []);

    return (
        <div className="max-w-3xl mx-auto animate-fade-in">
            <div className="flex justify-center mb-6"><Button variant="danger" size="lg" onClick={onBack} className="w-full md:w-auto"><ArrowLeft className="w-5 h-5 mr-2"/>重新填寫問卷</Button></div>
            <h1 className="text-2xl sm:text-3xl font-bold text-center mb-2">方案總覽</h1>
            <p className="text-center text-gray-600 mb-8">這是我們為您推薦的方案，您也可以選擇其他方案進行預約。</p>
            <div className="space-y-4">
                {Object.entries(formSystem.recommendations).sort(([keyA], [keyB]) => categoryOrder.indexOf(keyA) - categoryOrder.indexOf(keyB)).map(([categoryKey, category]) => {
                    const isRecommended = categoryKey === findRecommendationCategory(recommendedPlanId);
                    const isExpanded = expandedCategory === categoryKey;
                    return (
                        <div key={categoryKey} className={`${styles.card} p-0 transition-all duration-300 border-2 ${isRecommended ? 'border-blue-500' : 'border-transparent'}`}>
                            <div className="p-4 cursor-pointer flex justify-between items-center" onClick={() => { playClickSound(); setExpandedCategory(isExpanded ? null : categoryKey); }}>
                                <div className="flex items-center"><h2 className="text-xl font-bold">{category.title}</h2>{isRecommended && <span className="ml-3 bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center"><Star className="w-3 h-3 mr-1"/>推薦</span>}</div>
                                <div className="flex items-center">{!isExpanded && Object.values(category.plans).map(plan => (<span key={plan.id} className="hidden sm:block text-sm text-gray-600 ml-4">{plan.duration}分/${plan.price}</span>))}{isExpanded ? <ChevronDown className="w-6 h-6 ml-4 text-gray-500"/> : <ChevronRight className="w-6 h-6 ml-4 text-gray-500"/>}</div>
                            </div>
                            {isExpanded && (
                                <div className="p-4 border-t animate-fade-in">
                                    {Object.values(category.plans).map(plan => (
                                        <div key={plan.id} className={`mb-2 p-4 rounded-md bg-gray-50 ${recommendedPlanId === plan.id ? 'ring-2 ring-blue-400' : ''}`}>
                                            <MediaDisplay imageUrl={plan.imageUrl} videoUrl={plan.videoUrl} />
                                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                                                <div className="flex-grow mb-4 md:mb-0 md:mr-4">
                                                    <h3 className="font-bold text-lg text-gray-800">{plan.name}</h3>
                                                    <p className="text-gray-600 mt-1">{plan.description}</p>
                                                    <p className="text-gray-800 mt-2 font-semibold">{plan.duration}分鐘 / NT$ {plan.price}</p>
                                                </div>
                                                <Button variant="success" onClick={() => onPlanSelect(plan)} className="w-full md:w-auto flex-shrink-0">預約此方案</Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

const BookingSystem = ({ formSystem, selectedPlan, bookings, adminAvailability, onAddNewBooking, onCancelBooking = () => {}, onUpdateAdminAvailability, onBack, isAdmin, onMarkAsRead = () => {}, onMarkAsCompleted = () => {}, rescheduleBooking, onRescheduleBooking, onRescheduleSubmit, onCancelReschedule }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isBookingListModalOpen, setIsBookingListModalOpen] = useState(false);
    const [isAvailabilityModalOpen, setIsAvailabilityModalOpen] = useState(false);
    const [selectedDateTime, setSelectedDateTime] = useState(null);
    const [weekOffset, setWeekOffset] = useState(0);
    const displayStartDate = useMemo(() => addDays(timeUtils.getToday(), 7 * weekOffset), [weekOffset]);
    const goToPrevWeek = () => setWeekOffset(prev => Math.max(0, prev - 1));
    const goToNextWeek = () => setWeekOffset(prev => Math.min(2, prev + 1));

    const handleSlotClick = (dateTime) => {
        setSelectedDateTime(dateTime);
        if (isAdmin && !rescheduleBooking) setIsBookingListModalOpen(true);
        else setIsModalOpen(true);
    };
    const handleBackClick = () => { if (rescheduleBooking) onCancelReschedule(); onBack(); };
    const handleAdminDayClick = (date) => { setSelectedDateTime(date); setIsAvailabilityModalOpen(true); };
    const handleAdminViewBookings = (date) => { setSelectedDateTime(date); setIsBookingListModalOpen(true); };
    const handleRescheduleAndCloseModal = (booking) => { onRescheduleBooking(booking); setIsBookingListModalOpen(false); };

    return (
        <div className={styles.mainContainer}>
            <div className={styles.pageHeader}>
                <Button variant="ghost" size="sm" onClick={handleBackClick}><ArrowLeft className="w-4 h-4 mr-1"/>{isAdmin ? (rescheduleBooking ? '返回行事曆' : '返回儀表板') : '返回方案選擇'}</Button>
                <h2 className="text-xl font-bold text-center text-gray-800">{isAdmin ? (rescheduleBooking ? `更改 ${rescheduleBooking.name} 的預約` : '行事曆管理') : (selectedPlan ? `預約：${selectedPlan.name}`: '選擇預約')}</h2>
                <div className="w-auto">{formSystem?.businessInfo?.igLink && <a href={formSystem.businessInfo.igLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-pink-600 hover:text-white hover:bg-pink-500 transition-all duration-300 px-3 py-1.5 rounded-lg border border-pink-200 hover:border-pink-500" title="查看 Instagram"><span className="font-semibold hidden sm:inline">筋伸自在</span><Instagram size={20} /></a>}</div>
            </div>
            <div>
                <div className="flex justify-between items-center mb-4">
                    <Button variant="outline" onClick={goToPrevWeek} disabled={weekOffset === 0}><ChevronLeft size={16} className="mr-1" />上一週</Button>
                    <span className="font-semibold text-gray-700">{format(displayStartDate, 'yyyy / MM / dd')} ~ {format(addDays(displayStartDate, 6), 'MM / dd')}</span>
                    <Button variant="outline" onClick={goToNextWeek} disabled={weekOffset >= 2}>下一週<ChevronRight size={16} className="ml-1" /></Button>
                </div>
                <WeeklyView 
                    startDate={displayStartDate} 
                    bookings={bookings} 
                    adminAvailability={adminAvailability} 
                    onSlotClick={handleSlotClick} 
                    isAdmin={isAdmin} 
                    onAdminDayClick={handleAdminDayClick} 
                    onAdminViewBookings={handleAdminViewBookings} 
                    selectedPlan={selectedPlan || (rescheduleBooking ? { duration: rescheduleBooking.duration, restTime: rescheduleBooking.restTime } : null)} 
                    formSystem={formSystem} />
            </div>
            <BookingModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} selectedDateTime={selectedDateTime} selectedPlan={selectedPlan} bookings={bookings} adminAvailability={adminAvailability} onSubmitBooking={(data) => { if (rescheduleBooking) onRescheduleSubmit(data, rescheduleBooking.id); else onAddNewBooking(data); setIsModalOpen(false); }} formSystem={formSystem} rescheduleBooking={rescheduleBooking} isAdmin={isAdmin} />
            <BookingListModal isOpen={isAdmin && isBookingListModalOpen} onClose={() => setIsBookingListModalOpen(false)} date={selectedDateTime} bookings={bookings} cancelBooking={onCancelBooking} onMarkAsRead={onMarkAsRead} onMarkAsCompleted={onMarkAsCompleted} onRescheduleBooking={handleRescheduleAndCloseModal} />
            <AdminAvailabilityModal isOpen={isAdmin && isAvailabilityModalOpen} onClose={() => setIsAvailabilityModalOpen(false)} selectedDate={selectedDateTime} currentAvailability={selectedDateTime ? adminAvailability[timeUtils.formatDate(selectedDateTime)] : null} onSave={(date, avail) => { onUpdateAdminAvailability(date, avail); setIsAvailabilityModalOpen(false); }} formSystem={formSystem} />
        </div>
    );
};

const WeeklyView = ({ startDate, bookings, adminAvailability, onSlotClick, isAdmin, onAdminDayClick, onAdminViewBookings, selectedPlan, formSystem }) => {
    const today = timeUtils.getToday();
    const days = useMemo(() => Array.from({ length: 7 }).map((_, i) => addDays(startDate, i)), [startDate]);
    const hours = useMemo(() => {
        let min = 22, max = 9;
        days.forEach(day => {
            const avail = getEffectiveAvailability(day, adminAvailability, formSystem?.defaultSchedule);
            if (avail.type === 'open' && avail.slots?.length > 0) {
                avail.slots.forEach(slot => {
                    min = Math.min(min, parseInt(slot.start.split(':')[0], 10));
                    max = Math.max(max, parseInt(slot.end.split(':')[0], 10) || 24);
                });
            }
        });
        return Array.from({ length: Math.max(0, max - min) }, (_, i) => min + i);
    }, [days, adminAvailability, formSystem]);
    
    return (
        <div className={styles.calendarContainer}>
            <div className={styles.calendarGrid}>
                <div className={styles.stickyTimeHeader}>時間</div>
                {days.map(day => (
                    <div key={day.toISOString()} className={styles.stickyDateHeader}>
                        <span className={`text-xs sm:text-sm ${isEqual(day, today) ? 'text-blue-600 font-bold' : ''}`}>{['日', '一', '二', '三', '四', '五', '六'][getDay(day)]}</span>
                        <p className={`text-base sm:text-lg ${isEqual(day, today) ? 'text-blue-600 font-bold' : ''}`}>{format(day, 'M/d')}</p>
                        {isAdmin && <div className="flex justify-center space-x-1 mt-1"><Button variant="ghost" size="icon" onClick={() => onAdminDayClick(day)} title="設定本日時段"><Settings size={14} /></Button><Button variant="ghost" size="icon" onClick={() => onAdminViewBookings(day)} title="查看本日預約"><Calendar size={14} /></Button></div>}
                    </div>
                ))}
                {hours.map((hour, hourIndex) => (
                    <React.Fragment key={hour}>
                        <div className={styles.stickyTimeCell}>{`${hour}:00`}</div>
                        {days.map(day => {
                            if (isEqual(day, today)) {
                                if (hourIndex === 0) return <div key={day.toISOString()} className="h-full border-b border-l border-t p-2 text-center flex items-center justify-center bg-yellow-50 text-yellow-800" style={{ gridRow: `span ${hours.length || 1}` }}><div className="flex flex-col items-center justify-center gap-4"><p className="font-semibold text-center">今日預約請私訊確認</p>{formSystem.businessInfo?.igLink && <a href={formSystem.businessInfo.igLink} target="_blank" rel="noopener noreferrer" className="p-2 bg-white rounded-full text-pink-500 hover:bg-pink-100 shadow" onClick={(e) => e.stopPropagation()} title="私訊 Instagram"><Instagram size={24} /></a>}</div></div>;
                                return null;
                            }
                            const info = getHourSummary(day, hour, selectedPlan, bookings, adminAvailability, formSystem);
                            const isClickable = info.status === 'available';
                            return <div key={day.toISOString() + hour} className={`h-20 border-b border-l border-t p-2 text-center flex items-center justify-center transition-colors duration-200 ${isClickable ? 'bg-green-50 text-green-800 hover:bg-green-100 cursor-pointer' : `bg-gray-100 text-gray-400 cursor-not-allowed ${info.status === 'full' ? 'bg-gray-200 text-gray-500' : ''}`}`} onClick={() => {if(isClickable) { playClickSound(); onSlotClick(set(day, { hours: hour })); }}}>{isClickable ? <div className="text-xs sm:text-sm">可預約時段: <span className="font-bold text-sm sm:text-base">{info.count}</span></div> : info.text}</div>;
                        })}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};

const BookingModal = ({ isOpen, onClose, selectedDateTime, selectedPlan, bookings, adminAvailability, onSubmitBooking, formSystem, rescheduleBooking, isAdmin }) => {
    const [name, setName] = useState('');
    const [contact, setContact] = useState('');
    const [contactType, setContactType] = useState('phone');
    const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isRescheduleFlow = !!rescheduleBooking;

    const availableTimeSlots = useMemo(() => {
         if (!isOpen || !selectedDateTime || !selectedPlan) return [];
         return generateAvailableTimeSlotsForHour(set(selectedDateTime, { minutes: 0, seconds: 0 }), selectedPlan, bookings, adminAvailability, formSystem);
     }, [isOpen, selectedDateTime, selectedPlan, bookings, adminAvailability, formSystem]);

    useEffect(() => {
        if (isOpen) {
            setSelectedTimeSlot(null);
            setError('');
            setIsSubmitting(false);
            setName(rescheduleBooking?.name || '');
            setContact(rescheduleBooking?.contact || '');
            setContactType(rescheduleBooking?.contactType || 'phone');
        }
    }, [isOpen, rescheduleBooking]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        if (!selectedTimeSlot) { setError('請選擇一個確切的時間'); setIsSubmitting(false); return; }
        if (!isSlotAvailable(selectedTimeSlot, selectedPlan, bookings, adminAvailability, formSystem)) {
            setError('抱歉，此時段已被預約，請重新選擇。'); setSelectedTimeSlot(null); setIsSubmitting(false); return;
        }
        if (!isAdmin && (!name || !contact)) { setError('請填寫姓名與聯絡方式'); setIsSubmitting(false); return; }
        setError('');
        const bookingData = { startTime: selectedTimeSlot.toISOString(), name: isRescheduleFlow ? rescheduleBooking.name : name, contact: isRescheduleFlow ? rescheduleBooking.contact : contact, contactType: isRescheduleFlow ? rescheduleBooking.contactType || 'phone' : contactType };
        await onSubmitBooking(bookingData);
        setIsSubmitting(false);
    };

    if (!isOpen || !selectedPlan || !selectedDateTime) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isRescheduleFlow ? `更改預約時段` : `預約 ${selectedPlan.name}`} maxWidth="lg">
            <form onSubmit={handleSubmit}>
                <div className="p-6 space-y-4">
                    <p className="text-gray-600">{timeUtils.formatDate(selectedDateTime, 'yyyy年M月d日')} {format(selectedDateTime, 'HH:00')} 時段</p>
                    {isRescheduleFlow && <div className="bg-blue-50 p-3 rounded-lg text-blue-800 text-sm"><p>正在為 <strong>{rescheduleBooking.name}</strong> 更改預約。</p><p>原時段: {timeUtils.formatDate(timeUtils.parseDate(rescheduleBooking.startTime), 'yyyy/MM/dd HH:mm')}</p></div>}
                    <div>
                        <h4 className="font-semibold text-gray-700 mb-3">選擇可預約時段：</h4>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {availableTimeSlots.length > 0 ? availableTimeSlots.map(slot => <Button key={slot.toISOString()} type="button" variant="outline" size="sm" onClick={() => { setError(''); setSelectedTimeSlot(slot); }} className={`w-full ${selectedTimeSlot && isEqual(slot, selectedTimeSlot) ? '!bg-blue-600 !text-white' : ''}`}>{format(slot, 'HH:mm')}</Button>) : <p className="col-span-full text-gray-500">此方案在此時段已無足夠長的空檔。</p>}
                        </div>
                    </div>
                    {!isRescheduleFlow && (
                        <div className="space-y-4">
                            <FormInput id="name" label="姓名" icon={User} value={name} onChange={e => setName(e.target.value)} required />
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">聯絡方式類型</label>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {CONTACT_TYPES.map(({id, label, icon: Icon}) => <button key={id} type="button" onClick={() => setContactType(id)} className={`flex items-center px-3 py-1.5 text-sm rounded-md border transition-colors ${contactType === id ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'}`}><Icon size={14} className="mr-1" />{label}</button>)}
                                </div>
                            </div>
                            <FormInput id="contact" label="聯絡方式" icon={CONTACT_TYPES.find(t => t.id === contactType)?.icon || Phone} value={contact} onChange={e => setContact(e.target.value)} required placeholder={getPlaceholderByContactType(contactType)} />
                        </div>
                    )}
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                </div>
                <div className="p-6 border-t bg-gray-50"><Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>{isSubmitting ? '處理中...' : (isRescheduleFlow ? '確認更改時段' : '確認預約')}</Button></div>
            </form>
        </Modal>
    );
};

const AdminAvailabilityModal = ({ isOpen, onClose, selectedDate, currentAvailability, onSave, formSystem }) => {
    const [type, setType] = useState('open');
    const [slots, setSlots] = useState([{ start: '09:00', end: '19:00' }]);

    useEffect(() => {
        if (isOpen && selectedDate) {
            const effective = getEffectiveAvailability(selectedDate, { [timeUtils.formatDate(selectedDate)]: currentAvailability }, formSystem?.defaultSchedule);
            setType(effective.type || 'open');
            setSlots(effective.slots?.length > 0 ? effective.slots : [{ start: '09:00', end: '19:00' }]);
        }
    }, [currentAvailability, selectedDate, isOpen, formSystem]);

    const handleSlotChange = (index, field, value) => setSlots(slots.map((s, i) => i === index ? { ...s, [field]: value } : s));
    const addSlot = () => setSlots([...slots, { start: '14:00', end: '18:00' }]);
    const removeSlot = (index) => setSlots(slots.filter((_, i) => i !== index));
    const handleSave = () => onSave(selectedDate, type === 'open' ? { type, slots } : { type });

    if (!isOpen) {
        return null;
    }
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`設定 ${selectedDate ? timeUtils.formatDate(selectedDate) : ''} 時段`} maxWidth="md">
            <div className="p-6 space-y-4">
                <div className="flex space-x-4">
                    <button onClick={() => setType('open')} className={`flex-1 py-2 rounded-md ${type === 'open' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>開放</button>
                    <button onClick={() => setType('rest')} className={`flex-1 py-2 rounded-md ${type === 'rest' ? 'bg-red-500 text-white' : 'bg-gray-200'}`}>休息</button>
                </div>
                {type === 'open' && (
                    <div className="space-y-3">
                        {slots.map((slot, index) => (
                            <div key={index} className="flex items-center space-x-2">
                                <input type="time" step="900" value={slot.start} onChange={e => handleSlotChange(index, 'start', e.target.value)} className={styles.input} />
                                <span>-</span>
                                <input type="time" step="900" value={slot.end} onChange={e => handleSlotChange(index, 'end', e.target.value)} className={styles.input} />
                                {slots.length > 1 && <Button variant="ghost" size="icon" onClick={() => removeSlot(index)} className="text-red-500 hover:text-red-700"><Trash2 size={18} /></Button>}
                            </div>
                        ))}
                        <Button variant="link" size="sm" onClick={addSlot}><PlusCircle size={16} className="mr-1" /> 新增時段</Button>
                    </div>
                )}
            </div>
            <div className="p-6 border-t bg-gray-50"><Button onClick={handleSave} size="lg" className="w-full">儲存設定</Button></div>
        </Modal>
    );
};

const BookingListModal = ({ isOpen, onClose, date, bookings, cancelBooking, onMarkAsRead, onMarkAsCompleted, onRescheduleBooking }) => {
    const [isQuestionnaireModalOpen, setIsQuestionnaireModalOpen] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const dayBookings = useMemo(() => { if (!date) return []; const dateKey = timeUtils.formatDate(date); return bookings.filter(b => b.startTime && timeUtils.formatDate(timeUtils.parseDate(b.startTime)) === dateKey).sort((a, b) => timeUtils.parseDate(a.startTime) - timeUtils.parseDate(b.startTime)); }, [date, bookings]);
    useEffect(() => { if (isOpen && dayBookings.length > 0) { const unreadIds = dayBookings.filter(b => !b.isRead).map(b => b.id); if (unreadIds.length > 0) onMarkAsRead(unreadIds); } }, [isOpen, dayBookings, onMarkAsRead]);
    const handleViewQuestionnaire = (booking) => { setSelectedBooking(booking); setIsQuestionnaireModalOpen(true); };
    if (!isOpen || !date) return null;
    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title={`${timeUtils.formatDate(date)} 的預約列表`} maxWidth="3xl">
                <div className="flex-grow overflow-y-auto p-6">
                    {dayBookings.length > 0 ? (
                        <ul className="space-y-4">
                            {dayBookings.map(booking => {
                                const isPending = booking.completionStatus !== 'completed';
                                const startTime = timeUtils.parseDate(booking.startTime);
                                return (
                                <li key={booking.id} className={styles.bookingListItem}>
                                    <div className="flex-grow flex items-center">
                                        {!booking.isRead && <span className="w-2.5 h-2.5 bg-blue-500 rounded-full mr-3 flex-shrink-0" title="新預約"></span>}
                                        <div className={booking.isRead ? 'ml-[22px]' : ''}>
                                            <p className="font-semibold">{format(startTime, 'HH:mm')} - {format(addMinutes(startTime, booking.duration), 'HH:mm')}</p>
                                            <p className="text-sm text-gray-600">{booking.planName} ({booking.duration}分)</p>
                                            <p className="text-sm text-gray-800 mt-1">{booking.name} - {(CONTACT_TYPES.find(t => t.id === booking.contactType)?.label || '手機')}: {booking.contact}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                                        <Button variant="outline" size="sm" onClick={() => handleViewQuestionnaire(booking)}>問卷</Button>
                                        <Button variant="outline" size="sm" onClick={() => onRescheduleBooking(booking)} className="text-blue-600 border-blue-300 hover:bg-blue-50">更改時段</Button>
                                        {isPending ? <Button variant="success" size="sm" onClick={() => onMarkAsCompleted(booking.id)}>完成</Button> : <span className="px-3 py-1.5 text-sm text-gray-500 flex items-center"><CheckCircle size={16} className="mr-1.5"/>已完成</span>}
                                        <Button variant="ghost" size="icon" onClick={() => cancelBooking(booking.id)} className="text-red-500 hover:text-red-700"><Trash2 size={18} /></Button>
                                    </div>
                                </li>
                            )})}
                        </ul>
                    ) : <p className="text-center text-gray-500 py-8">本日沒有預約。</p>}
                </div>
            </Modal>
            {isQuestionnaireModalOpen && selectedBooking && <QuestionnaireModal isOpen={isQuestionnaireModalOpen} onClose={() => setIsQuestionnaireModalOpen(false)} booking={selectedBooking} />}
        </>
    );
};

const AdminLoginModal = ({ isOpen, onClose, onLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const handleSubmit = async (e) => { e.preventDefault(); setError(''); if (!await onLogin(email, password)) setError('登入失敗，請檢查您的帳號密碼。'); };
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="管理員登入" maxWidth="sm">
            <form onSubmit={handleSubmit}>
                <div className="p-6 space-y-4">
                    <FormInput id="email" label="電子郵件" type="email" icon={Mail} value={email} onChange={e => setEmail(e.target.value)} required />
                    <FormInput id="password" label="密碼" type="password" icon={Lock} value={password} onChange={e => { setPassword(e.target.value); setError(''); }} required />
                    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                </div>
                <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3"><Button type="button" variant="secondary" onClick={onClose}>取消</Button><Button type="submit">登入</Button></div>
            </form>
        </Modal>
    );
};

const QuestionnaireModal = ({ isOpen, onClose, booking }) => {
    if (!isOpen || !booking) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="問卷內容" maxWidth="lg">
             <div className="flex-grow overflow-y-auto p-6 space-y-4">
                <p className="text-gray-600 -mt-4">預約者: {booking.name}</p>
                {booking.formAnswers?.length > 0 ? (
                    booking.formAnswers.map((item, index) => (
                        <div key={index}>
                            <p className="font-semibold text-gray-500">{item.question}</p>
                            <p className="text-lg text-gray-800 pl-4 border-l-4 border-blue-200 mt-1">{item.answer}</p>
                        </div>
                    ))
                ) : <p className="text-gray-500">沒有找到此預約的問卷內容。</p>}
            </div>
            <div className="p-4 bg-gray-50 text-right border-t"><Button variant="secondary" onClick={onClose}>關閉</Button></div>
        </Modal>
    );
};

const BookingSuccessModal = ({ isOpen, booking, businessInfo, onClose }) => {
    const cardRef = useRef(null);
    const [notification, setNotification] = useState('');

    const handleSaveAsImage = () => {
        if (cardRef.current && window.html2canvas) {
            window.html2canvas(cardRef.current, { useCORS: true, backgroundColor: '#ffffff' })
                .then(canvas => {
                    const link = document.createElement('a');
                    link.download = `booking-confirmation-${booking.name}.png`;
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                })
                .catch(err => { console.error("Could not save image: ", err); setNotification("圖片儲存失敗，請手動截圖。"); });
        } else {
            setNotification("圖片儲存功能載入中，請稍候再試。");
        }
    };
    if (!isOpen || !booking || !businessInfo) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="預約成功！" maxWidth="md">
            <div className="flex-grow overflow-y-auto p-2 bg-gray-50">
                <p className="text-center text-gray-600 -mt-4 mb-4">感謝您的預約，請留存此畫面。</p>
                <div ref={cardRef} className="bg-white p-6 rounded-lg shadow-inner">
                    {businessInfo.successImageUrl && <img src={businessInfo.successImageUrl} alt="預約成功" className="w-full h-auto object-cover rounded-md mb-4" crossOrigin="anonymous"/>}
                    <div className="space-y-4 text-gray-700">
                        <div><p className="font-semibold text-sm text-gray-500">預約時間</p><p className="text-xl font-bold text-blue-600">{timeUtils.formatDate(timeUtils.parseDate(booking.startTime), 'yyyy年M月d日 (eeee) HH:mm')}</p></div>
                        <div><p className="font-semibold text-sm text-gray-500">預約方案</p><p>{booking.planName}</p></div>
                        <div><p className="font-semibold text-sm text-gray-500">地點</p><p>{businessInfo.address}</p></div>
                        <div className="flex flex-col sm:flex-row gap-2 mt-2">
                            {businessInfo.mapLink && <a href={businessInfo.mapLink} target="_blank" rel="noopener noreferrer" className="flex-1 text-center px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"><MapPin size={16}/>查看地圖</a>}
                            {businessInfo.igLink && <a href={businessInfo.igLink} target="_blank" rel="noopener noreferrer" className="flex-1 text-center px-4 py-2 bg-pink-500 text-white rounded-lg font-semibold hover:bg-pink-600 transition-colors flex items-center justify-center gap-2"><Instagram className="w-5 h-5"/>{businessInfo.igName || 'Instagram'}</a>}
                        </div>
                    </div>
                </div>
            </div>
            {notification && <p className="text-center text-red-500 text-sm p-2">{notification}</p>}
            <div className="p-4 bg-gray-100 border-t flex flex-col sm:flex-row gap-2">
                <Button onClick={handleSaveAsImage} size="lg" className="w-full flex-1"><Download size={20} className="mr-2"/>儲存圖片</Button>
                <Button onClick={onClose} size="lg" className="w-full flex-1">完成</Button>
            </div>
        </Modal>
    );
};


// --- 主 App 組件 ---
export default function App() {
    // --- Firebase 初始化 ---
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);

    // --- FIX: Corrected useEffect to comply with Rules of Hooks ---
    useEffect(() => {
        const firebaseConfig = getFirebaseConfig();
        // If config is available, initialize Firebase.
        // If not, db and auth will remain null, and the downstream hooks will handle it.
        if (firebaseConfig) {
            try {
                const app = initializeApp(firebaseConfig);
                setDb(getFirestore(app));
                setAuth(getAuth(app));
            } catch (error) {
                console.error("Firebase initialization failed:", error);
            }
        } else {
            console.error("Firebase config not found. Running in offline/mock mode.");
        }
    }, []); // Empty dependency array ensures this runs only once.

    // --- 使用自定義 Hooks 管理狀態 (These are now called unconditionally) ---
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
        return createFirebaseUtils(db, (message, type) => showNotification(message, type));
    }, [db, showNotification]);

    // --- 使用 useFirebaseData 獲取資料 ---
    const { formSystem, bookings, adminAvailability, loading } = useFirebaseData(db, fbUtils, appId);

    // --- 其他狀態和 Refs ---
    const [isMuted, setIsMuted] = useState(false);
    const [hasInteracted, setHasInteracted] = useState(false);
    const audioRef = useRef(null);

    // --- 衍生狀態 (Derived State) ---
    const unreadCount = useMemo(() => bookings.filter(b => !b.isRead).length, [bookings]);
    const pendingCount = useMemo(() => bookings.filter(b => b.completionStatus === 'pending' || !b.completionStatus).length, [bookings]);

    // --- Effects ---
    useEffect(() => {
        document.title = "筋伸自在預約系統";
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
        script.async = true;
        document.body.appendChild(script);
        return () => { if (document.body.contains(script)) document.body.removeChild(script); }
    }, []);
    
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
    const handleFirstInteraction = () => {
        if (hasInteracted) return;
        setHasInteracted(true);
        const audio = audioRef.current;
        if (audio && !isMuted) {
            audio.volume = 0;
            audio.play().catch(e => console.error("Audio play failed:", e));
            const fadeAudio = setInterval(() => {
                const newVolume = audio.volume + 0.05;
                if (newVolume < 1.0) audio.volume = newVolume;
                else { audio.volume = 1.0; clearInterval(fadeAudio); }
            }, 100);
        }
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

    const addRescheduleBooking = async (newBookingData, originalBookingId) => {
        if (!fbUtils || !selectedPlan) return;
        const newBooking = { ...newBookingData, planId: selectedPlan.id, planName: selectedPlan.name, duration: selectedPlan.duration, restTime: selectedPlan.restTime, formAnswers, isRead: false, completionStatus: 'pending', createdAt: new Date().toISOString() };
        const docRef = await fbUtils.addDoc(`${fbUtils.getBasePath(appId)}/bookings`, newBooking);
        if (docRef) {
            await fbUtils.deleteDoc(`${fbUtils.getBasePath(appId)}/bookings/${originalBookingId}`);
            setSuccessfulBooking({ ...newBooking, id: docRef.id });
            setRescheduleBooking(null);
            showNotification('預約時段已更改成功！', 'success');
        }
    };
    
    const addNewBooking = async (newBookingData) => {
        if (!fbUtils || !selectedPlan || !db) return;
        try {
            const newDocData = await runTransaction(db, async (transaction) => {
                const bookingsRef = collection(db, `${fbUtils.getBasePath(appId)}/bookings`);
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
                if (await fbUtils.deleteDoc(`${fbUtils.getBasePath(appId)}/bookings/${bookingId}`)) {
                    showNotification('預約已成功取消。', 'success');
                }
                setConfirmation(c => ({...c, isOpen: false}));
            }
        });
    };

    const updateAdminAvailability = async (date, newAvailability) => {
        if (!fbUtils) return;
        await fbUtils.setDoc(`${fbUtils.getBasePath(appId)}/availability/${timeUtils.formatDate(date)}`, newAvailability);
    };

    const updateFormSystem = async (newFormSystem) => {
        if (!fbUtils) return;
        if (await fbUtils.setDoc(`${fbUtils.getBasePath(appId)}/systems/formSystem`, newFormSystem, { merge: true })) {
            showNotification('系統資訊已更新！', 'success');
        }
    };

    const handleMarkAsCompleted = async (bookingId) => {
        if (!fbUtils) return;
        if (await fbUtils.updateDoc(`${fbUtils.getBasePath(appId)}/bookings/${bookingId}`, { completionStatus: 'completed' })) {
            playClickSound();
        }
    };

    const handleMarkAsRead = useCallback(async (bookingIds) => {
        if (!fbUtils || bookingIds.length === 0) return;
        const operations = bookingIds.map(id => ({ type: 'update', path: `${fbUtils.getBasePath(appId)}/bookings/${id}`, data: { isRead: true } }));
        await fbUtils.writeBatch(operations);
    }, [fbUtils]);
    
    const handleExportBookings = () => {
        try {
            const sortedBookings = [...bookings].sort((a, b) => {
                const dateA = a.startTime ? timeUtils.parseDate(a.startTime) : 0;
                const dateB = b.startTime ? timeUtils.parseDate(b.startTime) : 0;
                return dateB - dateA;
            });
            const csvContent = csvUtils.convertBookingsToCSV(sortedBookings);
            csvUtils.downloadCSV(csvContent, `預約紀錄_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.csv`);
            showNotification('預約紀錄已匯出完成！', 'success');
        } catch (error) {
            console.error("CSV Export failed:", error);
            showNotification('匯出失敗，請稍後再試。', 'error');
        }
    };
    
    const clearAllBookings = () => {
        if (!fbUtils || !db) return;
        setConfirmation({
            isOpen: true,
            title: '確認清除所有預約資料',
            message: '您確定要清除所有預約資料嗎？此操作將永久刪除所有預約紀錄，無法復原。',
            onConfirm: async () => {
                const batch = writeBatch(db);
                const bookingsRef = collection(db, `${fbUtils.getBasePath(appId)}/bookings`);
                try {
                    const snapshot = await getDocs(bookingsRef);
                    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
                    await batch.commit();
                    showNotification('所有預約資料已清除完成！', 'success');
                } catch (error) {
                    fbUtils.handleError("清除預約資料失敗", error);
                }
                setConfirmation(c => ({...c, isOpen: false}));
            }
        });
    };

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

        if (isAdmin) {
            switch (currentView) {
                case 'admin_dashboard': return <AdminDashboard onNavigate={setCurrentView} unreadCount={unreadCount} pendingCount={pendingCount} />;
                case 'history_bookings': return <HistoryBookingsPage bookings={bookings} onBack={() => setCurrentView('admin_dashboard')} onExport={handleExportBookings} onClearAll={clearAllBookings} />;
                case 'admin_editor': return <AdminEditor formSystem={formSystem} onUpdate={updateFormSystem} onExit={() => setCurrentView('admin_dashboard')} setConfirmation={setConfirmation} />;
                case 'calendar': return <BookingSystem formSystem={formSystem} selectedPlan={selectedPlan} bookings={bookings} adminAvailability={adminAvailability} onAddNewBooking={addNewBooking} onCancelBooking={cancelBooking} onUpdateAdminAvailability={updateAdminAvailability} onBack={handleBackFromCalendar} isAdmin={true} onMarkAsRead={handleMarkAsRead} onMarkAsCompleted={handleMarkAsCompleted} rescheduleBooking={rescheduleBooking} onRescheduleBooking={handleRescheduleBooking} onRescheduleSubmit={addRescheduleBooking} onCancelReschedule={() => { setRescheduleBooking(null); resetFlow(); }} />;
                case 'admin_pending_list': return <PendingBookingsList bookings={bookings} onMarkAsCompleted={handleMarkAsCompleted} onBack={() => setCurrentView('admin_dashboard')} />;
                default: return <AdminDashboard onNavigate={setCurrentView} unreadCount={unreadCount} pendingCount={pendingCount} />;
            }
        }
        switch (currentView) {
            case 'form': return <VisitorForm formSystem={formSystem} onComplete={handleFormComplete} setFormAnswers={setFormAnswers} onFirstInteraction={handleFirstInteraction} />;
            case 'plans': return <PlanSelectionPage formSystem={formSystem} recommendedPlanId={recommendedPlanId} onPlanSelect={handlePlanSelect} onBack={resetFlow} />;
            case 'calendar': return <BookingSystem formSystem={formSystem} selectedPlan={selectedPlan} bookings={bookings} adminAvailability={adminAvailability} onAddNewBooking={addNewBooking} onCancelBooking={cancelBooking} onUpdateAdminAvailability={updateAdminAvailability} onBack={() => setCurrentView('plans')} isAdmin={false} />;
            default: return <VisitorForm formSystem={formSystem} onComplete={handleFormComplete} setFormAnswers={setFormAnswers} onFirstInteraction={handleFirstInteraction} />;
        }
    };

    // --- JSX 渲染 ---
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
                    {renderContent()}
                </ErrorBoundary>
                <AdminLoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} onLogin={handleLogin} />
                <NotificationComponent notification={notification} onClose={clearNotification} />
                <ConfirmationModal isOpen={confirmation.isOpen} onClose={() => setConfirmation(c => ({...c, isOpen: false}))} onConfirm={confirmation.onConfirm} title={confirmation.title}>
                    <p>{confirmation.message}</p>
                </ConfirmationModal>
            </div>
        </div>
    );
}
