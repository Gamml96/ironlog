import React, { useState, useEffect } from 'react';
import { 
  Dumbbell, 
  LayoutDashboard, 
  TrendingUp, 
  Users, 
  Timer,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { onAuthStateChanged, User as FirebaseUser, signOut } from 'firebase/auth';
import confetti from 'canvas-confetti';

// Types
import { 
  WorkoutSession, 
  Group 
} from './lib/db';

// Firebase & Lib
import { 
  auth, 
  loginWithGoogle, 
  db, 
  getCollectionRef,
  getDocRef,
  saveToCloud,
  onSnapshot,
  query,
  where,
  collection,
  deleteSession,
  updateUserStats,
  updatePersonalRecords
} from './lib/firebase';
import { rotateWorkoutPlans } from './lib/workout-utils';

// UI Components
import { Button } from './components/ui/Button';
import { Card } from './components/ui/Card';
import { ActiveWorkoutOverlay } from './components/ActiveWorkoutOverlay';
import { TutorialOverlay } from './components/TutorialOverlay';

// Views
import { HojeView } from './components/views/HojeView';
import { TreinosView } from './components/views/TreinosView';
import { ProgressoView } from './components/views/ProgressoView';
import { ExerciciosView } from './components/views/ExerciciosView';
import { GruposView } from './components/views/GruposView';
import { SettingsView } from './components/views/SettingsView';

export default function App() {
  const [activeTab, setActiveTab] = useState<'hoje' | 'treinos' | 'progresso' | 'exercicios' | 'grupos' | 'config'>('hoje');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [activeWorkout, setActiveWorkout] = useState<WorkoutSession | null>(null);
  const [isWorkoutModalOpen, setIsWorkoutModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, volume: number, date: number } | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [weightIncrement, setWeightIncrement] = useState(2.5);
  const [userGroups, setUserGroups] = useState<Group[]>([]);

  // Connection monitoring
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // PWA Install Logic
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstallable(false);
    }
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setIsInstallable(false);
    setDeferredPrompt(null);
  };

  // Auth & Initialization
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setUserGroups([]);
      return;
    }
    const q = query(collection(db, 'groups'), where('memberIds', 'array-contains', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setUserGroups(snap.docs.map(d => ({ id: d.id, ...d.data() } as Group)));
    });

    const unsubSettings = onSnapshot(getDocRef('settings', 'user-settings'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data.defaultWeightIncrement !== undefined) setWeightIncrement(data.defaultWeightIncrement);
      }
    });

    // Restore active session
    const saved = localStorage.getItem('ironlog_active_session');
    if (saved) {
      try {
        const savedData = JSON.parse(saved);
        if (!savedData.isCompleted && Date.now() - savedData.lastUpdated < 12 * 60 * 60 * 1000) {
          const passed = Math.floor((Date.now() - savedData.lastUpdated) / 1000);
          setActiveWorkout({ 
            ...savedData, 
            duration: (savedData.duration || 0) + passed 
          });
          setIsWorkoutModalOpen(true);
        }
      } catch (e) {
        console.error("Failed to restore session", e);
      }
    }

    const hasSeenTutorial = localStorage.getItem('ironlog_tutorial_seen');
    if (!hasSeenTutorial) setShowTutorial(true);

    return () => {
      unsub();
      unsubSettings();
    };
  }, [user]);

  // Navigation
  const navigateTab = (tab: typeof activeTab) => {
    setActiveTab(tab);
    window.history.pushState({ tab, workoutOpen: false }, '');
  };

  const openWorkoutLayer = (w: WorkoutSession) => {
    setActiveWorkout(w);
    setIsWorkoutModalOpen(true);
    window.history.pushState({ tab: activeTab, workoutOpen: true }, '');
  };

  const closeWorkoutLayer = () => {
    setIsWorkoutModalOpen(false);
  };

  const closeTutorial = () => {
    localStorage.setItem('ironlog_tutorial_seen', 'true');
    setShowTutorial(false);
  };

  const handleDeleteSession = async (sessionId: string, volume: number, date: number) => {
    setDeleteConfirm({ id: sessionId, volume, date });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm || !user) return;
    try {
      await deleteSession(user.uid, deleteConfirm.id, deleteConfirm.volume, deleteConfirm.date);
      setRefreshKey(k => k + 1);
      setDeleteConfirm(null);
    } catch (err) {
      console.error(err);
    }
  };

  if (authLoading) return (
    <div className="flex flex-col items-center justify-center h-screen bg-bg-base">
      <Dumbbell className="w-12 h-12 text-brand-primary animate-pulse mb-4" />
      <h1 className="text-2xl font-display text-white italic">Carregando IronLog...</h1>
    </div>
  );

  if (!user) return <LoginScreen onLogin={loginWithGoogle} />;

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto relative overflow-hidden bg-bg-base">
      <main className="flex-1 overflow-y-auto pb-32 pt-safe px-4">
        <AnimatePresence mode="wait">
          {activeTab === 'hoje' && (
            <HojeView 
              key={refreshKey} 
              onStartWorkout={(w) => {
                if (activeWorkout && !activeWorkout.isCompleted) {
                  if (confirm("Você já tem um treino em andamento. Deseja descartá-lo e começar um novo?")) {
                    openWorkoutLayer(w);
                  }
                } else {
                  openWorkoutLayer(w);
                }
              }} 
              onEditSession={openWorkoutLayer}
              onDeleteSession={handleDeleteSession}
              onSetActiveTab={navigateTab} 
              user={user} 
            />
          )}
          {activeTab === 'treinos' && (
            <TreinosView 
              onStartWorkout={(w) => {
                if (activeWorkout && !activeWorkout.isCompleted) {
                  if (confirm("Você já tem um treino em andamento. Deseja descartá-lo e começar um novo?")) {
                    openWorkoutLayer(w);
                  }
                } else {
                  openWorkoutLayer(w);
                }
              }}
            />
          )}
          {activeTab === 'progresso' && <ProgressoView />}
          {activeTab === 'exercicios' && <ExerciciosView />}
          {activeTab === 'grupos' && <GruposView currentUser={user} />}
          {activeTab === 'config' && (
            <SettingsView 
              onBack={() => navigateTab('hoje')} 
              onLogout={() => signOut(auth)} 
              isInstallable={isInstallable}
              onInstall={handleInstallClick}
            />
          )}
        </AnimatePresence>
      </main>

      {/* Persistent Active Workout Bar */}
      {activeWorkout && !isWorkoutModalOpen && (
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-24 left-4 right-4 z-50 pointer-events-none"
        >
          <div 
            onClick={() => setIsWorkoutModalOpen(true)} 
            className="bg-brand-primary text-black p-4 rounded-2xl flex items-center justify-between shadow-2xl pointer-events-auto cursor-pointer active:scale-95 transition-transform"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-black/20 rounded-full flex items-center justify-center animate-[spin_4s_linear_infinite]">
                <Timer className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-black/60 leading-none mb-1">Treino em Andamento</p>
                <p className="font-black italic text-lg leading-none uppercase tracking-tight">{activeWorkout.workoutPlanName}</p>
              </div>
            </div>
            <ArrowRight className="w-6 h-6" />
          </div>
        </motion.div>
      )}

      {/* Bottom Navigation */}
      {!isOnline && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60]">
          <div className="bg-amber-500 text-black px-4 py-1.5 rounded-full flex items-center gap-2 shadow-lg text-[10px] font-black uppercase italic">
            <AlertTriangle size={14} /> Modo Offline
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-bg-card/90 backdrop-blur-xl border-t border-white/5 pb-safe z-40">
        <div className="flex items-center justify-around h-20 max-w-md mx-auto px-2">
          <NavButton icon={<LayoutDashboard />} label="Hoje" active={activeTab === 'hoje'} onClick={() => navigateTab('hoje')} />
          <NavButton icon={<Dumbbell />} label="Treinos" active={activeTab === 'treinos'} onClick={() => navigateTab('treinos')} />
          <NavButton icon={<Users />} label="Grupos" active={activeTab === 'grupos'} onClick={() => navigateTab('grupos')} />
          <NavButton icon={<TrendingUp />} label="Evolução" active={activeTab === 'progresso'} onClick={() => navigateTab('progresso')} />
        </div>
      </nav>

      {/* Modals & Overlays */}
      {activeWorkout && isWorkoutModalOpen && (
        <ActiveWorkoutOverlay 
          session={activeWorkout} 
          weightIncrement={weightIncrement}
          onClose={(updated) => {
            setActiveWorkout(updated);
            closeWorkoutLayer();
          }} 
          onDiscard={() => {
            localStorage.removeItem('ironlog_active_session');
            setActiveWorkout(null);
            closeWorkoutLayer();
          }}
          onSave={async (w) => {
             await saveToCloud('sessions', w);
             if (w.workoutPlanId) await rotateWorkoutPlans(w.workoutPlanId);
             if (user) {
               await updateUserStats(user.uid, w.totalVolume);
               await updatePersonalRecords(user.uid, w);
             }
             localStorage.removeItem('ironlog_active_session');
             setActiveWorkout(null);
             closeWorkoutLayer();
             setRefreshKey(k => k + 1);
             confetti({
               particleCount: 150,
               spread: 70,
               origin: { y: 0.6 },
               colors: ['#FF5E1A', '#39FF14', '#ffffff']
             });
          }}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <Card className="w-full max-w-sm border-brand-primary/20 shadow-2xl">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="text-red-500 w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-black italic uppercase">Excluir Treino?</h3>
                <p className="text-gray-400 text-sm mt-2">Esta ação é permanente. A tonelagem e estatísticas deste treino serão removidas do seu perfil.</p>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <Button variant="danger" className="w-full" onClick={confirmDelete}>Sim, Excluir</Button>
                <Button variant="ghost" className="w-full" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      <AnimatePresence>
        {showTutorial && (
          <TutorialOverlay 
            onClose={closeTutorial} 
            isInstallable={isInstallable} 
            onInstall={handleInstallClick} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function NavButton({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-full h-full transition-all ${active ? 'text-brand-primary' : 'text-white/40'}`}
    >
      <div className={`mb-1 transition-transform ${active ? 'scale-110' : 'scale-100 opacity-60'}`}>{React.cloneElement(icon as React.ReactElement, { size: 22, strokeWidth: active ? 2.5 : 2 })}</div>
      <span className={`text-[9px] font-black uppercase tracking-[0.1em] transition-all ${active ? 'opacity-100' : 'opacity-40'}`}>{label}</span>
    </button>
  );
}

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [loading, setLoading] = useState(false);
  const handleLogin = async () => {
    setLoading(true);
    try { await onLogin(); } catch (err) { console.error(err); setLoading(false); }
  };

  return (
    <div className="h-screen bg-bg-base flex flex-col items-center justify-center p-8 overflow-hidden relative">
      <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-brand-primary/10 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-64 h-64 bg-brand-primary/5 rounded-full blur-[100px]" />
      
      <div className="mb-12 text-center relative">
        <div className="w-24 h-24 bg-brand-primary/20 rounded-3xl flex items-center justify-center mb-6 mx-auto shadow-2xl rotate-3">
          <Dumbbell className="w-12 h-12 text-brand-primary" strokeWidth={2.5} />
        </div>
        <h1 className="text-5xl font-black italic tracking-tighter text-white mb-2 leading-none">IRON<span className="text-brand-primary">LOG</span></h1>
        <p className="text-gray-400 font-bold uppercase tracking-[0.2em] text-[10px]">Domine seu Progresso</p>
      </div>

      <Card className="w-full space-y-6 text-center shadow-2xl relative z-10 border-white/10">
        <div>
          <h2 className="text-xl font-black italic mb-2 uppercase leading-tight">Bem-vindo(a), Guerreiro(a).</h2>
          <p className="text-gray-500 text-sm">Entre com sua conta Google para sincronizar e competir no ranking global.</p>
        </div>
        
        <Button onClick={handleLogin} loading={loading} className="w-full gap-3 h-14 bg-white text-black hover:bg-gray-100 shadow-none normal-case font-bold">
          {!loading && <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="w-5 h-5" referrerPolicy="no-referrer" />}
          Continuar com Google
        </Button>
      </Card>

      <footer className="mt-12 text-[10px] text-gray-700 uppercase font-black tracking-[0.2em] text-center">
        ESTÁVEL 1.2.0 • 2026
      </footer>
    </div>
  );
}
