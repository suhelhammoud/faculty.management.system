import { useMemo, useState, type ReactNode } from 'react';
import { LanguageContext, type Language } from './language-context';

const arabic: Record<string, string> = {
  Facilities: 'المرافق',
  'Physical spaces': 'المساحات والمرافق',
  'Facilities configuration': 'إعدادات المرافق',
  Rooms: 'الغرف',
  Settings: 'الإعدادات',
  'Sign in': 'تسجيل الدخول',
  'Use the account provided by your administrator.': 'استخدم الحساب الذي قدمه مسؤول النظام.',
  Username: 'اسم المستخدم',
  Password: 'كلمة المرور',
  'Sign out': 'تسجيل الخروج',
  'Change password': 'تغيير كلمة المرور',
  'Current password': 'كلمة المرور الحالية',
  'New password': 'كلمة المرور الجديدة',
  'Confirm password': 'تأكيد كلمة المرور',
  'Passwords do not match.': 'كلمتا المرور غير متطابقتين.',
  'Use 12–128 characters.': 'استخدم من 12 إلى 128 محرفاً.',
  'Awaiting approval': 'بانتظار الموافقة',
  'Your account is disabled.': 'حسابك معطل.',
  'Contact your administrator.': 'تواصل مع مسؤول النظام.',
  'Check again': 'تحقق مجدداً',
  'Loading…': 'جارٍ التحميل…',
  Retry: 'إعادة المحاولة',
  'Overview of registered spaces and room availability.':
    'نظرة عامة على المساحات المسجلة والغرف المتاحة.',
  'Total rooms': 'إجمالي الغرف',
  Classrooms: 'القاعات الدراسية',
  Laboratories: 'المختبرات',
  Theaters: 'المدرجات',
  classroom: 'قاعة دراسية',
  laboratory: 'مختبر',
  theater: 'مدرج',
  Search: 'بحث',
  'Search rooms': 'البحث في الغرف',
  Building: 'المبنى',
  Floor: 'الطابق',
  'Room type': 'نوع الغرفة',
  Status: 'الحالة',
  All: 'الكل',
  Active: 'نشطة',
  Inactive: 'غير نشطة',
  Code: 'الرمز',
  Name: 'الاسم',
  Capacity: 'السعة',
  'Available / maximum': 'المتاح / الإجمالي',
  Actions: 'الإجراءات',
  Edit: 'تعديل',
  'Add room': 'إضافة غرفة',
  'Edit room': 'تعديل الغرفة',
  'Room code': 'رمز الغرفة',
  Title: 'العنوان',
  'Maximum student capacity': 'السعة القصوى للطلاب',
  'Current available student capacity': 'السعة المتاحة حالياً للطلاب',
  'Save room': 'حفظ الغرفة',
  Cancel: 'إلغاء',
  'Room saved.': 'تم حفظ الغرفة.',
  'No rooms found.': 'لم يتم العثور على غرف.',
  'Create building': 'إضافة مبنى',
  'Create floor': 'إضافة طابق',
  'Create room type': 'إضافة نوع غرفة',
  'Create record': 'إنشاء سجل',
  'Edit record': 'تعديل سجل',
  'Saving…': 'جارٍ الحفظ…',
  Buildings: 'المباني',
  Floors: 'الطوابق',
  'Room types': 'أنواع الغرف',
  'Building code': 'رمز المبنى',
  Address: 'العنوان',
  'Floor number': 'رقم الطابق',
  Description: 'الوصف',
  Save: 'حفظ',
  'Saved successfully.': 'تم الحفظ بنجاح.',
  'No records yet.': 'لا توجد سجلات بعد.',
  'Select…': 'اختر…',
  'All buildings': 'كل المباني',
  'All floors': 'كل الطوابق',
  'All room types': 'كل أنواع الغرف',
  'Enter a valid capacity.': 'أدخل سعة صالحة.',
  'Available capacity cannot exceed maximum capacity.':
    'لا يمكن أن تتجاوز السعة المتاحة السعة القصوى.',
  'Your session expired. Please sign in again.': 'انتهت جلستك. يرجى تسجيل الدخول مجدداً.',
  'Invalid username or password.': 'اسم المستخدم أو كلمة المرور غير صحيحة.',
  'Sign in again with your new password.': 'سجل الدخول مجدداً بكلمة المرور الجديدة.',
  'You do not have permission, or your account is restricted.':
    'لا تملك الصلاحية المطلوبة أو أن حسابك مقيد.',
  'Record not found.': 'السجل غير موجود.',
  'A record with these values already exists.': 'يوجد سجل بهذه القيم بالفعل.',
  'Unable to reach the server.': 'تعذر الاتصال بالخادم.',
  'Unable to complete the request.': 'تعذر إكمال الطلب.',
  'Page not found': 'الصفحة غير موجودة',
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      return localStorage.getItem('faculty-facilities-language') === 'ar' ? 'ar' : 'en';
    } catch {
      return 'en';
    }
  });
  const setLanguage = (next: Language) => {
    try {
      localStorage.setItem('faculty-facilities-language', next);
    } catch {
      // Storage can be unavailable in restricted browser contexts.
    }
    setLanguageState(next);
  };
  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: (text: string) => (language === 'ar' ? arabic[text] || text : text),
    }),
    [language],
  );
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
