import React, { useState, useEffect } from 'react';
import { Globe, Check } from 'lucide-react';

export interface LanguageToggleProps {
  className?: string;
}

const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिंदी' },
  { code: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
];

function getCookie(name: string): string {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : '';
}

function setGoogleTranslateCookie(langCode: string) {
  const domain = window.location.hostname;
  const cookieValue = `/en/${langCode}`;
  document.cookie = `googtrans=${cookieValue}; path=/; domain=${domain};`;
  document.cookie = `googtrans=${cookieValue}; path=/;`;
}

export const LanguageToggle: React.FC<LanguageToggleProps> = ({ className = '' }) => {
  const [currentLang, setCurrentLang] = useState<string>('en');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const raw = getCookie('googtrans');
    if (raw) {
      const parts = raw.split('/');
      const target = parts[parts.length - 1];
      if (target) {
        setCurrentLang(target);
      }
    }
  }, []);

  const switchLanguage = (code: string) => {
    setCurrentLang(code);
    setIsOpen(false);

    // Try finding the Google Translate combo in DOM
    const combo = document.querySelector('.goog-te-combo') as HTMLSelectElement | null;
    if (combo) {
      combo.value = code;
      combo.dispatchEvent(new Event('change'));
    } else {
      setGoogleTranslateCookie(code);
      window.location.reload();
    }
  };

  // 1-Tap Toggle between English and Hindi
  const handleQuickToggle = () => {
    const target = currentLang === 'hi' ? 'en' : 'hi';
    switchLanguage(target);
  };

  return (
    <div className={`relative inline-block text-left ${className}`}>
      <div className="flex items-center space-x-1">
        {/* Primary 1-Tap Toggle Button (Always visible on mobile & desktop) */}
        <button
          type="button"
          onClick={handleQuickToggle}
          className="bg-emerald-800/90 hover:bg-emerald-900 active:scale-95 text-xs sm:text-sm font-bold text-white px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border border-emerald-600 transition flex items-center space-x-1.5 shadow-xs cursor-pointer flex-shrink-0"
          title="Switch Language / भाषा बदलें"
        >
          <Globe className="w-3.5 h-3.5 text-emerald-300 flex-shrink-0" />
          <span>{currentLang === 'hi' ? 'English' : 'हिंदी'}</span>
        </button>

        {/* Multi-Language Dropdown Chevron */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="bg-emerald-800/90 hover:bg-emerald-900 active:scale-95 text-xs font-bold text-emerald-200 px-2 py-1.5 sm:py-2 rounded-xl border border-emerald-600 transition flex items-center justify-center cursor-pointer shadow-xs flex-shrink-0"
          title="More Indian Languages"
        >
          <span className="text-[10px]">▼</span>
        </button>
      </div>

      {/* Dropdown Menu for all languages */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-white shadow-xl border border-slate-200 py-1.5 z-50 text-xs">
            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
              Language / भाषा
            </div>
            {SUPPORTED_LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => switchLanguage(l.code)}
                className="w-full text-left px-3.5 py-2 hover:bg-emerald-50 flex items-center justify-between transition cursor-pointer text-slate-700 hover:text-emerald-900"
              >
                <div className="flex items-center space-x-2">
                  <span className="font-bold">{l.native}</span>
                  <span className="text-[10px] text-slate-400">({l.label})</span>
                </div>
                {currentLang === l.code && (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
