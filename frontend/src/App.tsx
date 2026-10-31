import React, { useState, useEffect, Suspense, lazy } from 'react';
import { api } from './services/api';
import { LoginResponse } from './types';
import { ArrowLeft } from 'lucide-react';
import { SpeedInsights } from '@vercel/speed-insights/react';

const PatientPortal = lazy(() => import('./pages/PatientPortal').then(m => ({ default: m.PatientPortal })));
const HospitalDashboard = lazy(() => import('./pages/HospitalDashboard').then(m => ({ default: m.HospitalDashboard })));
const PlatformAdminDashboard = lazy(() => import('./pages/PlatformAdminDashboard').then(m => ({ default: m.PlatformAdminDashboard })));
const LandingPage = lazy(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })));

const PageLoadingFallback: React.FC = () => (
  <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
    <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-4" />
    <span className="text-slate-400 text-sm font-medium tracking-wide">Loading CityCare...</span>
  </div>
);

function getSlugFromUrl(): string {
  const path = window.location.pathname;
  const match = path.match(/^\/(?:h|patient)\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return match[1];

  const params = new URLSearchParams(window.location.search);
  const qSlug = params.get('slug') || params.get('hospital');
  if (qSlug) return qSlug;

  return '';
}

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<LoginResponse | null>(() => api.getCurrentUser());
  const [pathname, setPathname] = useState<string>(window.location.pathname);
  const [hospitalSlug, setHospitalSlug] = useState<string>(getSlugFromUrl());

  // Super Admin inspecting a specific hospital context
  const [superAdminSelectedHospital, setSuperAdminSelectedHospital] = useState<{
    id: string;
    name: string;
    slug: string;
  } | null>(null);

  const navigate = (to: string) => {
    window.history.pushState({}, '', to);
    setPathname(to.split('?')[0]);
    setHospitalSlug(getSlugFromUrl());
  };

  useEffect(() => {
    const user = api.getCurrentUser();
    if (user) {
      setCurrentUser(user);
    }

    const handlePopState = () => {
      setPathname(window.location.pathname);
      setHospitalSlug(getSlugFromUrl());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleLoginSuccess = (user: LoginResponse) => {
    setCurrentUser(user);
    if (user.role === 'SUPER_ADMIN') {
      navigate('/admin');
    } else {
      navigate('/dashboard');
    }
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
    setSuperAdminSelectedHospital(null);
    navigate('/hospital-admin');
  };

  const handleSelectHospitalFromSuperAdmin = (hospitalId: string, hospitalName: string, hospitalSlug: string) => {
    setSuperAdminSelectedHospital({ id: hospitalId, name: hospitalName, slug: hospitalSlug });
    setHospitalSlug(hospitalSlug);
  };

  // Determine active user payload for hospital dashboard (including Super Admin in preview mode)
  const activeDashboardUser: LoginResponse | null = currentUser
    ? currentUser.role === 'SUPER_ADMIN' && superAdminSelectedHospital
      ? {
          ...currentUser,
          hospitalId: superAdminSelectedHospital.id,
          hospitalName: superAdminSelectedHospital.name,
          hospitalSlug: superAdminSelectedHospital.slug,
        }
      : currentUser
    : null;

  // ROUTE 1: Dedicated Hospital Admin & Staff Login Page (/hospital-admin, /login, /admin-login)
  const isHospitalAdminRoute = 
    pathname === '/hospital-admin' || 
    pathname === '/login' || 
    pathname === '/admin-login';

  const renderContent = () => {
    if (isHospitalAdminRoute) {
      // If already logged in, redirect directly to dashboard or admin
      if (currentUser) {
        if (currentUser.role === 'SUPER_ADMIN') {
          navigate('/admin');
        } else {
          navigate('/dashboard');
        }
        return null;
      }

      return (
        <LandingPage
          onLoginSuccess={handleLoginSuccess}
          onSelectHospital={(slug) => navigate(`/patient?slug=${encodeURIComponent(slug)}`)}
        />
      );
    }

    // ROUTE 2: Super Admin inspecting a hospital dashboard
    if (currentUser?.role === 'SUPER_ADMIN' && superAdminSelectedHospital && activeDashboardUser) {
      return (
        <div className="min-h-screen flex flex-col font-sans">
          <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-black flex items-center justify-between border-b border-amber-600">
            <span>👑 Super Admin Preview Scope: {superAdminSelectedHospital.name} (/h/{superAdminSelectedHospital.slug})</span>
            <button
              onClick={() => setSuperAdminSelectedHospital(null)}
              className="bg-slate-950 text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-slate-800 transition cursor-pointer flex items-center space-x-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Master Admin</span>
            </button>
          </div>
          <HospitalDashboard
            currentUser={activeDashboardUser}
            onLogout={handleLogout}
            onOpenPatientPortal={() => window.open(`/h/${activeDashboardUser.hospitalSlug}`, '_blank')}
          />
        </div>
      );
    }

    // ROUTE 3: Platform Super Admin Master Dashboard (/admin)
    if (pathname === '/admin') {
      if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
        navigate('/hospital-admin');
        return null;
      }

      return (
        <PlatformAdminDashboard
          currentUser={currentUser}
          onLogout={handleLogout}
          onSelectHospitalDashboard={handleSelectHospitalFromSuperAdmin}
          onOpenPatientPortal={(slug) => {
            window.open(`/h/${slug}`, '_blank');
          }}
        />
      );
    }

    // ROUTE 4: Authenticated Hospital Staff on /dashboard
    if (pathname === '/dashboard') {
      if (!currentUser || !activeDashboardUser) {
        navigate('/hospital-admin');
        return null;
      }

      return (
        <HospitalDashboard
          currentUser={activeDashboardUser}
          onLogout={handleLogout}
          onOpenPatientPortal={() => window.open(`/h/${activeDashboardUser.hospitalSlug}`, '_blank')}
        />
      );
    }

    // ROUTE 5: Root URL without hospital slug (/) -> Render Main Opening Landing Page
    if (!hospitalSlug) {
      return (
        <LandingPage
          onLoginSuccess={handleLoginSuccess}
          onSelectHospital={(slug) => navigate(`/patient?slug=${encodeURIComponent(slug)}`)}
        />
      );
    }

    // ROUTE 6: Specific hospital slug provided (/patient?slug=:slug or /h/:slug): Isolated Patient Portal
    return (
      <PatientPortal 
        initialSlug={hospitalSlug} 
        currentUser={currentUser}
        onDashboardClick={() => {
          if (currentUser?.role === 'SUPER_ADMIN') {
            navigate('/admin');
          } else {
            navigate('/dashboard');
          }
        }}
      />
    );
  };

  return (
    <>
      <Suspense fallback={<PageLoadingFallback />}>
        {renderContent()}
      </Suspense>
      <SpeedInsights />
    </>
  );
};

export default App;
