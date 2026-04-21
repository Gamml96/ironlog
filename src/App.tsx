import React, { useState, useEffect } from 'react';
import { 
  Dumbbell, 
  LayoutDashboard, 
  History, 
  TrendingUp, 
  Library, 
  Plus, 
  ChevronRight, 
  Settings,
  MoreVertical,
  Timer,
  CheckCircle2,
  Trash2,
  Edit2,
  Play,
  ArrowRight,
  Target,
  Trophy,
  Calendar,
  Weight,
  Search,
  ChevronLeft,
  Flame,
  X,
  Check,
  AlertTriangle,
  Activity,
  Info,
  Users,
  Copy,
  LogOut,
  UserPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, subDays, startOfWeek, endOfWeek, isToday, isYesterday, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { onAuthStateChanged, User as FirebaseUser, signOut } from 'firebase/auth';
import confetti from 'canvas-confetti';

import { 
  WorkoutPlan, 
  WorkoutSession, 
  Exercise, 
  WorkoutPlanExercise,
  ExerciseLog,
  SetLog,
  DEFAULT_EXERCISES,
  Group,
  GroupMemberStats
} from './lib/db';
import { 
  auth, 
  loginWithGoogle, 
  db, 
  updateUserStats,
  getCollectionRef,
  getDocRef,
  saveToCloud,
  deleteFromCloud,
  writeBatch,
  getDocs,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateUserDisplayName,
  where,
  logWeight,
  deleteSession,
  updatePersonalRecords,
  arrayUnion,
  arrayRemove,
  setDoc,
  updateDoc
} from './lib/firebase';
import { PersonalRecord } from './lib/db';

// --- Utilities ---

const calculateEstimatedDuration = (plan: WorkoutPlan) => {
  let totalSeconds = 0;
  plan.exercises.forEach((ex, idx) => {
    if (ex.targetDuration && ex.targetDuration > 0) {
      totalSeconds += ex.targetDuration;
    } else {
      const setsNum = ex.targetSets || 1;
      const rest = ex.restTimer || 60;
      const timePerSet = 50; // Estimated execution time in seconds
      totalSeconds += (setsNum * timePerSet) + ((setsNum - 1) * rest);
    }
    
    // Add transition time between exercises (90s)
    if (idx < plan.exercises.length - 1) {
      totalSeconds += 90; 
    }
  });
  return Math.max(5, Math.ceil(totalSeconds / 60));
};

// --- Components ---

const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger', size?: 'sm' | 'md' | 'lg' | 'icon' }) => {
  const base = "inline-flex items-center justify-center font-display font-black uppercase transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 tracking-wider";
  const variants = {
    primary: "bg-brand-primary text-black hover:bg-brand-primary/90 shadow-[0_4px_20px_rgba(255,94,26,0.3)]",
    secondary: "bg-bg-card text-white hover:bg-white/10 border border-white/10",
    ghost: "bg-transparent text-white hover:bg-white/5",
    danger: "bg-red-600/20 text-red-500 hover:bg-red-600/30 border border-red-500/20",
  };
  const sizes = {
    sm: "h-9 px-4 text-xs rounded-xl",
    md: "h-12 px-6 text-sm rounded-2xl",
    lg: "h-14 px-8 text-base rounded-2xl",
    icon: "h-12 w-12 rounded-2xl flex-shrink-0",
  };
  
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
};

const Card = ({ children, className = "", onClick, borderAccent }: { children: React.ReactNode, className?: string, onClick?: () => void, borderAccent?: boolean, key?: React.Key }) => (
  <div 
    onClick={onClick}
    className={`bg-bg-card border-white/5 rounded-[24px] p-6 ${borderAccent ? 'border-l-4 border-l-brand-primary' : 'border'} ${className} ${onClick ? 'active:bg-white/5 transition-colors cursor-pointer shadow-xl' : ''}`}
  >
    {children}
  </div>
);

const Badge = ({ children, variant = 'primary' }: { children: React.ReactNode, variant?: 'primary' | 'secondary' | 'success' }) => (
  <span className={`px-2 py-0.5 rounded-sm text-[11px] font-black uppercase tracking-widest ${
    variant === 'primary' ? 'bg-brand-primary text-black' : 
    variant === 'success' ? 'bg-brand-secondary text-black' :
    'bg-white/10 text-white/40'
  }`}>
    {children}
  </span>
);

// --- App Entry & Navigation ---

export default function App() {
  const [activeTab, setActiveTab] = useState<'hoje' | 'treinos' | 'progresso' | 'exercicios' | 'grupos' | 'config' | 'ranking'>('hoje');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeWorkout, setActiveWorkout] = useState<WorkoutSession | null>(null);
  const [isWorkoutModalOpen, setIsWorkoutModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, volume: number, date: number } | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem('ironlog_tutorial_seen');
    if (!hasSeenTutorial && !authLoading && user) {
      setShowTutorial(true);
    }
  }, [authLoading, user]);

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });

    // Request notification permissions
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => unsubscribe();
  }, []);

  // Restore active session on app load
  useEffect(() => {
    if (!user) return;
    const saved = localStorage.getItem('ironlog_active_session');
    if (saved) {
      try {
        const savedData = JSON.parse(saved);
        // Only resume if it's "recent" (e.g. within 12 hours) and NOT completed
        if (!savedData.isCompleted && Date.now() - savedData.lastUpdated < 12 * 60 * 60 * 1000) {
          const passed = Math.floor((Date.now() - savedData.lastUpdated) / 1000);
          setActiveWorkout({ 
            ...savedData, 
            duration: (savedData.duration || 0) + passed 
          });
          setIsWorkoutModalOpen(true); // Open it if we restored it
        }
      } catch (e) {
        console.error("Failed to restore session", e);
      }
    }
  }, [user]);

  if (authLoading) return (
    <div className="flex flex-col items-center justify-center h-screen bg-bg-base">
      <Dumbbell className="w-12 h-12 text-brand-primary animate-pulse mb-4" />
      <h1 className="text-2xl font-display text-white italic">
        Carregando IronLog...
      </h1>
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
                setActiveWorkout(w);
                setIsWorkoutModalOpen(true);
              }} 
              onEditSession={(s) => {
                setActiveWorkout(s);
                setIsWorkoutModalOpen(true);
              }}
              onDeleteSession={handleDeleteSession}
              onSetActiveTab={setActiveTab} 
              user={user} 
            />
          )}
          {activeTab === 'treinos' && <TreinosView />}
          {activeTab === 'progresso' && <ProgressoView />}
          {activeTab === 'exercicios' && <ExerciciosView />}
          {activeTab === 'grupos' && <GruposView currentUser={user} />}
          {activeTab === 'ranking' && <RankingView currentUser={user} />}
          {activeTab === 'config' && <SettingsView onBack={() => setActiveTab('hoje')} onLogout={() => signOut(auth)} />}
        </AnimatePresence>
      </main>

      {/* Persistent Active Workout Bar */}
      {activeWorkout && !isWorkoutModalOpen && (
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-20 left-4 right-4 z-50 pointer-events-none"
        >
          <div 
            onClick={() => setIsWorkoutModalOpen(true)} 
            className="bg-brand-primary text-black p-4 rounded-2xl flex items-center justify-between shadow-2xl pointer-events-auto cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-black/20 rounded-full flex items-center justify-center animate-spin-slow">
                <Timer className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-black/60">Treino Ativo</p>
                <p className="font-display text-lg">{activeWorkout.workoutPlanName}</p>
              </div>
            </div>
            <ArrowRight className="w-6 h-6" />
          </div>
        </motion.div>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-bg-card/90 backdrop-blur-xl border-t border-white/5 pb-safe z-40">
        <div className="flex items-center justify-around h-20 max-w-md mx-auto px-2">
          <NavButton icon={<LayoutDashboard />} label="Hoje" active={activeTab === 'hoje'} onClick={() => setActiveTab('hoje')} />
          <NavButton icon={<Dumbbell />} label="Treinos" active={activeTab === 'treinos'} onClick={() => setActiveTab('treinos')} />
          <NavButton icon={<Trophy />} label="Geral" active={activeTab === 'ranking'} onClick={() => setActiveTab('ranking')} />
          <NavButton icon={<Users />} label="Grupos" active={activeTab === 'grupos'} onClick={() => setActiveTab('grupos')} />
          <NavButton icon={<TrendingUp />} label="Evolução" active={activeTab === 'progresso'} onClick={() => setActiveTab('progresso')} />
        </div>
      </nav>

      {/* Workout Session Modal (if active) */}
      {activeWorkout && isWorkoutModalOpen && (
        <ActiveWorkoutOverlay 
          session={activeWorkout} 
          onClose={() => setIsWorkoutModalOpen(false)} 
          onDiscard={() => {
            console.log("Discarding workout...");
            localStorage.removeItem('ironlog_active_session');
            setActiveWorkout(null);
            setIsWorkoutModalOpen(false);
          }}
          onSave={async (w) => {
             await saveToCloud('sessions', w);
             if (user) await updatePersonalRecords(user.uid, w);
             localStorage.removeItem('ironlog_active_session');
             setActiveWorkout(null);
             setIsWorkoutModalOpen(false);
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

      {/* Custom Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <Card className="w-full max-w-sm border-brand-primary/20 shadow-2xl">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="text-red-500 w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-black italic uppercase">Excluir Treino?</h3>
                <p className="text-gray-400 text-sm mt-2">
                  Esta ação é permanente. A tonelagem e estatísticas deste treino serão removidas do seu perfil.
                </p>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <Button variant="danger" className="w-full" onClick={confirmDelete}>
                  Sim, Excluir Definitivamente
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => setDeleteConfirm(null)}>
                  Não, Manter Treino
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      <AnimatePresence>
        {showTutorial && <OnboardingOverlay onClose={closeTutorial} />}
      </AnimatePresence>
    </div>
  );
}

function NavButton({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-full h-full transition-all ${active ? 'text-brand-primary' : 'text-muted'}`}
    >
      <div className={`mb-1.5 transition-transform ${active ? 'scale-110' : 'scale-100 opacity-60'}`}>{React.cloneElement(icon as React.ReactElement, { size: 24, strokeWidth: active ? 2.5 : 2 })}</div>
      <span className={`text-[10px] font-black uppercase tracking-[0.08em] transition-all ${active ? 'opacity-100' : 'opacity-40'}`}>{label}</span>
    </button>
  );
}

// --- View: Login ---

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="h-screen bg-bg-base flex flex-col items-center justify-center p-8 overflow-hidden relative">
      <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-brand-primary/10 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-64 h-64 bg-brand-primary/5 rounded-full blur-[100px]" />
      
      <div className="mb-12 text-center relative">
        <div className="w-24 h-24 bg-brand-primary/20 rounded-3xl flex items-center justify-center mb-6 mx-auto shadow-2xl rotate-3">
          <Dumbbell className="w-12 h-12 text-brand-primary" strokeWidth={2.5} />
        </div>
        <h1 className="text-5xl font-black italic tracking-tighter text-white mb-2">IRON<span className="text-brand-primary">LOG</span></h1>
        <p className="text-gray-400 font-bold uppercase tracking-[0.2em] text-xs">Domine seu Progresso</p>
      </div>

      <Card className="w-full space-y-6 text-center shadow-2xl relative z-10 border-white/10">
        <div>
          <h2 className="text-xl font-black italic mb-2 uppercase">Bem-vindo(a), Guerreiro(a).</h2>
          <p className="text-gray-400 text-sm">Entre com sua conta Google para sincronizar seus treinos e competir no ranking global.</p>
        </div>
        
        <Button onClick={onLogin} className="w-full gap-3 h-14 bg-white text-black hover:bg-gray-100 shadow-none">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" referrerPolicy="no-referrer" />
          Continuar com Google
        </Button>
      </Card>

      <footer className="mt-12 text-[10px] text-gray-600 uppercase font-black tracking-widest text-center">
        Versão Estável 1.2.0 • 2026
      </footer>
    </div>
  );
}

function OnboardingOverlay({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const steps = [
    {
      title: "Planeje sua Batalha",
      description: "Na aba 'Treinos', crie seus planos personalizados. Adicione exercícios da biblioteca ou crie os seus próprios.",
      icon: <Dumbbell className="w-12 h-12" />
    },
    {
      title: "Rastreio em Tempo Real",
      description: "Durante o treino, registre cada série. O app calcula seu volume total automaticamente para você focar no esforço.",
      icon: <Target className="w-12 h-12" />
    },
    {
      title: "Descanso Inteligente",
      description: "O cronômetro te avisa o momento exato de voltar à ação, com alertas visuais e sonoros durante o treino.",
      icon: <Timer className="w-12 h-12" />
    },
    {
      title: "Fique Atento",
      description: "Para garantir que você nunca perca o tempo de descanso, ative as notificações em segundo plano agora mesmo.",
      icon: <CheckCircle2 size={48} />,
      isNotificationStep: true
    },
    {
      title: "Quebre seus Limites",
      description: "Acompanhe seus Recordes Pessoais (PRs) e gráficos de evolução. Veja sua força crescer a cada semana.",
      icon: <TrendingUp className="w-12 h-12" />
    },
    {
      title: "Elite de Ferro",
      description: "Compare sua tonelagem total no Ranking Global. Suba de nível e torne-se uma lenda na comunidade.",
      icon: <Trophy className="w-12 h-12" />
    },
    {
      title: "Sua Experiência",
      description: "Ajuste metas semanais e tempos de descanso padrão nas configurações para moldar o app ao seu estilo.",
      icon: <Settings className="w-12 h-12" />
    }
  ];

  const next = () => {
    if (step < steps.length - 1) setStep(step + 1);
    else onClose();
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6"
    >
      <div className="w-full max-w-sm flex flex-col items-center text-center">
        <button 
          onClick={onClose}
          className="absolute top-8 right-8 text-white/20 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>

        <AnimatePresence mode="wait">
          <motion.div 
            key={step}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.1, y: -20 }}
            className="space-y-8"
          >
            <div className="flex justify-center">
              <div className="w-24 h-24 bg-brand-primary/20 rounded-3xl flex items-center justify-center text-brand-primary shadow-[0_0_50px_rgba(255,94,26,0.3)] rotate-3">
                {steps[step].icon}
              </div>
            </div>
            <div className="px-4 text-center">
              <h2 className="text-3xl font-black italic uppercase italic leading-tight mb-4 tracking-tighter">{steps[step].title}</h2>
              <p className="text-gray-400 text-base leading-relaxed font-medium mb-6">{steps[step].description}</p>
              
              {(steps[step] as any).isNotificationStep && typeof Notification !== 'undefined' && Notification.permission !== 'granted' && (
                <Button 
                  onClick={async () => {
                    const permission = await Notification.requestPermission();
                    if (permission === 'granted') {
                      next();
                    }
                  }}
                  className="w-full bg-brand-secondary text-black h-12 rounded-xl mb-2 font-black italic"
                >
                  ATIVAR ALERTAS
                </Button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="flex gap-2 mt-12 mb-10">
          {steps.map((_, i) => (
            <div 
              key={i} 
              className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-8 bg-brand-primary' : i < step ? 'w-2 bg-brand-primary/40' : 'w-2 bg-white/10'}`} 
            />
          ))}
        </div>

        <Button onClick={next} className="w-full h-14 text-lg font-black italic">
          {step === steps.length - 1 ? "COMEÇAR AGORA" : "PRÓXIMO PASSO"}
        </Button>
        
        {step < steps.length - 1 && (
          <button 
            onClick={onClose}
            className="mt-6 text-[10px] font-black uppercase tracking-[0.2em] text-white/30 hover:text-white transition-colors"
          >
            Pular Tutorial
          </button>
        )}
      </div>
    </motion.div>
  );
}

// --- View: Hoje (Main Dashboard) ---

function HojeView({ onStartWorkout, onEditSession, onDeleteSession, onSetActiveTab, user }: { 
  onStartWorkout: (w: WorkoutSession) => void, 
  onEditSession: (s: WorkoutSession) => void,
  onDeleteSession: (id: string, vol: number, date: number) => void,
  onSetActiveTab: (v: any) => void, 
  user: FirebaseUser, 
  key?: React.Key 
}) {
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([]);
  const [streak, setStreak] = useState(0);
  const [weeklyGoal, setWeeklyGoal] = useState(5);
  const [completedThisWeek, setCompletedThisWeek] = useState(0);
  const [loading, setLoading] = useState(true);

  function calculateStats(allSessions: WorkoutSession[]) {
    // Weekly Goal
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    
    const sessionsThisWeek = allSessions.filter(s => 
      s.isCompleted && s.date >= weekStart.getTime() && s.date <= weekEnd.getTime()
    );
    
    const uniqueDaysThisWeek = new Set(sessionsThisWeek.map(s => {
      const d = new Date(s.date);
      d.setHours(0,0,0,0);
      return d.getTime();
    }));
    
    setCompletedThisWeek(uniqueDaysThisWeek.size);

    // Streak
    const completedSessions = allSessions.filter(s => s.isCompleted);
    if (completedSessions.length > 0) {
      const dates = completedSessions.map(s => {
        const d = new Date(s.date);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      });
      const uniqueDates = Array.from(new Set(dates)).sort((a, b) => b - a);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (uniqueDates[0] >= yesterday.getTime()) {
        let currentStreak = 1;
        for (let i = 0; i < uniqueDates.length - 1; i++) {
          const current = new Date(uniqueDates[i]);
          const prev = new Date(uniqueDates[i + 1]);
          const diff = (current.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
          
          if (diff <= 1.5) {
            currentStreak++;
          } else {
            break;
          }
        }
        setStreak(currentStreak);
      } else {
        setStreak(0);
      }
    } else {
      setStreak(0);
    }
  }

  useEffect(() => {
    setLoading(true);
    // 1. Listen for Plans
    const plansQuery = query(getCollectionRef('plans'), orderBy('order'));
    const unsubPlans = onSnapshot(plansQuery, (snap) => {
      setPlans(snap.docs.map(d => d.data() as WorkoutPlan));
      setLoading(false);
    });

    // 2. Listen for Sessions
    const sessionsQuery = query(getCollectionRef('sessions'), orderBy('date', 'desc'), limit(50));
    const unsubSessions = onSnapshot(sessionsQuery, (snap) => {
      const allSessions = snap.docs.map(d => d.data() as WorkoutSession);
      setRecentSessions(allSessions.slice(0, 3));
      calculateStats(allSessions);
    });

    // 3. Listen for Settings
    const unsubSettings = onSnapshot(getDocRef('settings', 'user-settings'), (doc) => {
      if (doc.exists()) {
        setWeeklyGoal(doc.data().weeklyGoal || 5);
      }
    });

    return () => {
      unsubPlans();
      unsubSessions();
      unsubSettings();
    };
  }, [user.uid]);

  const skipWorkout = async (plan: WorkoutPlan) => {
    if (plans.length < 2) return;
    
    // Cloud sync: Move current plan to end
    const remainingPlans = plans.filter(p => p.id !== plan.id);
    const reordered: WorkoutPlan[] = [...remainingPlans, plan];
    
    const batch = writeBatch(db);
    for (let i = 0; i < reordered.length; i++) {
       batch.update(getDocRef('plans', reordered[i].id), { order: i });
    }
    await batch.commit();
  };

  const startEmptyWorkout = (plan: WorkoutPlan) => {
    const session: WorkoutSession = {
      id: crypto.randomUUID(),
      workoutPlanId: plan.id,
      workoutPlanName: plan.name,
      date: Date.now(),
      exercises: plan.exercises.map(ex => ({
        exerciseId: ex.exerciseId,
        exerciseName: '', // Will be resolved
        restTimer: ex.restTimer,
        targetReps: ex.targetReps,
        targetDuration: ex.targetDuration,
        isVariationPerSet: ex.isVariationPerSet,
        sets: Array.from({ length: ex.targetSets }).map(() => ({
          weight: 0,
          reps: 0,
          completed: false,
          timestamp: Date.now()
        }))
      })),
      totalVolume: 0,
      isCompleted: false
    };
    onStartWorkout(session);
  };

  if (loading) return (
    <div className="flex justify-center items-center h-48">
      <Dumbbell className="animate-spin text-brand-primary" />
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6 py-4"
    >
      <header className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <img src={user.photoURL || ''} alt="" className="w-10 h-10 rounded-xl border border-white/10" referrerPolicy="no-referrer" />
          <div>
            <h1 className="text-2xl italic font-black text-brand-primary leading-none">IronLog</h1>
            <p className="text-muted text-[9px] uppercase font-bold tracking-[0.1em] mt-1">{format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1.5">
             {[...Array(weeklyGoal)].map((_, i) => (
               <div key={i} className={`w-7 h-7 rounded-full border-2 border-bg-base flex items-center justify-center text-[9px] font-black ${i < completedThisWeek ? 'bg-brand-primary text-black' : 'bg-gray-800 text-white/30'}`}>
                  {i + 1}
               </div>
             ))}
          </div>
          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full border border-white/5" onClick={() => onSetActiveTab('config')}>
            <Settings size={16} className="text-muted" />
          </Button>
        </div>
      </header>

      {/* Streak Card */}
      <Card className="bg-gradient-to-br from-brand-primary/10 to-transparent border-brand-primary/20 p-6 flex items-center justify-between">
         <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-brand-primary/20 rounded-2xl flex items-center justify-center text-brand-primary shadow-[0_0_20px_rgba(255,94,26,0.1)]">
               <Flame className="w-6 h-6 fill-current" />
            </div>
            <div>
               <p className="font-display text-xl leading-none font-bold uppercase italic">Sequência: {streak} {streak === 1 ? 'Dia' : 'Dias'}</p>
               <p className="text-muted text-[10px] font-bold uppercase tracking-wider mt-1">{streak > 0 ? 'Imparável!' : 'Comece hoje!'}</p>
            </div>
         </div>
         <div className="bg-brand-primary text-black px-3 py-1 rounded-full font-black italic text-sm">
            +{streak}
         </div>
      </Card>

      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col">
            <span className="text-[10px] text-muted font-bold uppercase tracking-[0.05em] mb-1 leading-none">Treino de Hoje</span>
            <h2 className="text-2xl font-black italic">Peito e Tríceps</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onSetActiveTab('treinos')}>Ver Todos</Button>
        </div>
        
        {plans.length > 0 ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={plans[0].id}
              initial={{ x: 0, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Card onClick={() => startEmptyWorkout(plans[0])} borderAccent className="relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-active:opacity-10 transition-opacity">
                   <Dumbbell size={100} />
                </div>
                <h3 className="text-3xl italic font-black mb-1">{plans[0].name}</h3>
                <div className="flex items-center gap-2 mb-6">
                  <span className="text-muted text-xs font-bold uppercase tracking-wider">{plans[0].exercises.length} Exercícios</span>
                  <div className="w-1 h-1 bg-muted/40 rounded-full" />
                  <span className="text-muted text-xs font-bold uppercase tracking-wider">~{calculateEstimatedDuration(plans[0])} min</span>
                </div>
                <div className="flex items-center text-brand-primary text-sm font-black gap-2 uppercase tracking-tight">
                  Começar Agora <ArrowRight size={18} />
                </div>
                
                {plans.length > 1 && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      skipWorkout(plans[0]);
                    }}
                    className="absolute top-4 right-4 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white py-1 px-3 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10 transition-all z-10"
                  >
                    Pular Treino
                  </button>
                )}
              </Card>
            </motion.div>
          </AnimatePresence>
        ) : (
          <Card className="text-center py-8 flex flex-col items-center">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 text-gray-400">
               <Plus size={32} />
            </div>
            <h3 className="text-md mb-2">Nenhum plano criado</h3>
            <Button size="sm" onClick={() => onSetActiveTab('treinos')}>Criar Meu Primeiro Treino</Button>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-lg italic">Atividade Recente</h2>
          <Button variant="ghost" size="sm" className="text-[10px] uppercase font-bold text-brand-primary" onClick={() => onSetActiveTab('stats')}>Ver Todos</Button>
        </div>
        {recentSessions.length > 0 ? (
          recentSessions.map(session => (
            <Card key={session.id} className="flex items-center gap-4 relative pr-2">
               <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-brand-primary shrink-0">
                 <History size={24} />
               </div>
               <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                     <h4 className="font-bold text-sm truncate">{session.workoutPlanName}</h4>
                     <span className="text-[10px] text-gray-500 uppercase shrink-0">{isToday(session.date) ? 'Hoje' : isYesterday(session.date) ? 'Ontem' : format(session.date, 'dd/MM')}</span>
                  </div>
                  <p className="text-xs text-gray-500 font-mono">Volume: {session.totalVolume}kg • {session.exercises.length} ex.</p>
               </div>
               <div className="flex items-center gap-1 shrink-0">
                  <button 
                    onClick={() => onEditSession(session)} 
                    className="p-2 text-gray-500 hover:text-white transition-colors"
                    title="Editar treino"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button 
                    onClick={() => onDeleteSession(session.id, session.totalVolume, session.date)} 
                    className="p-2 text-gray-500 hover:text-red-500 transition-colors"
                    title="Excluir treino"
                  >
                    <Trash2 size={18} />
                  </button>
               </div>
            </Card>
          ))
        ) : (
          <p className="text-center text-gray-600 text-xs py-4 italic">Nenhum histórico ainda. Hora de suar!</p>
        )}
      </section>
    </motion.div>
  );
}

// --- View: Treinos (Plans Management) ---

function TreinosView() {
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [isEditing, setIsEditing] = useState<WorkoutPlan | null>(null);

  useEffect(() => {
    const q = query(getCollectionRef('plans'), orderBy('order'));
    const unsub = onSnapshot(q, (snap) => {
      setPlans(snap.docs.map(d => d.data() as WorkoutPlan));
    });
    return () => unsub();
  }, []);

  const createPlan = async () => {
    const newPlan: WorkoutPlan = {
      id: crypto.randomUUID(),
      name: 'Novo Treino ' + String.fromCharCode(65 + plans.length),
      exercises: [],
      order: plans.length
    };
    await saveToCloud('plans', newPlan);
    setIsEditing(newPlan);
  };

  const deletePlan = async (id: string) => {
    await deleteFromCloud('plans', id);
  };

  if (isEditing) {
    return <EditPlanView plan={isEditing} onSave={() => setIsEditing(null)} onCancel={() => setIsEditing(null)} />;
  }

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="py-4 space-y-6"
    >
      <header className="flex justify-between items-center">
        <h1 className="text-3xl italic">Meus Planos</h1>
        <Button variant="primary" size="icon" onClick={createPlan}><Plus /></Button>
      </header>

      <div className="space-y-4">
        {plans.map(plan => (
          <Card key={plan.id} className="group overflow-hidden">
            <div className="flex items-center justify-between mb-2">
               <h3 className="text-xl">{plan.name}</h3>
               <div className="flex gap-2">
                 <Button variant="secondary" size="icon" className="h-10 w-10 p-0" onClick={() => setIsEditing(plan)}><Edit2 size={16} /></Button>
                 <Button variant="danger" size="icon" className="h-10 w-10 p-0" onClick={() => deletePlan(plan.id)}><Trash2 size={16} /></Button>
               </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-gray-500 items-center">
               <span className="text-brand-primary font-black uppercase tracking-tighter mr-2">~{calculateEstimatedDuration(plan)} min</span>
               {plan.exercises.length > 0 ? (
                 plan.exercises.slice(0, 3).map((ex, i) => (
                   <span key={i} className="bg-white/5 px-2 py-1 rounded">{i === 2 && plan.exercises.length > 3 ? '...' : 'Ex ' + (i+1)}</span>
                 ))
               ) : (
                 <p className="italic">Vazio. Adicione exercícios.</p>
               )}
            </div>
          </Card>
        ))}
      </div>
    </motion.div>
  );
}

function EditPlanView({ plan, onSave, onCancel }: { plan: WorkoutPlan, onSave: (p: WorkoutPlan) => void, onCancel: () => void }) {
  const [editedPlan, setEditedPlan] = useState<WorkoutPlan>(JSON.parse(JSON.stringify(plan)));
  const [showExPicker, setShowExPicker] = useState(false);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exSearch, setExSearch] = useState('');
  const [exFilter, setExFilter] = useState('Todos');
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExGroup, setNewExGroup] = useState('Peito');
  const [defaultRest, setDefaultRest] = useState(60);

  useEffect(() => {
    loadExercises();
    
    const unsubSettings = onSnapshot(getDocRef('settings', 'user-settings'), (doc) => {
      if (doc.exists()) {
        setDefaultRest(doc.data().defaultRestTime || 60);
      }
    });
    return () => unsubSettings();
  }, []);

  async function loadExercises() {
    try {
      const snap = await getDocs(getCollectionRef('exercises'));
      const custom = snap.docs.map(d => d.data() as Exercise);
      // Sort by name
      const sorted = custom.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setExercises(sorted);
    } catch (err) {
      console.error("Error loading exercises:", err);
      // Fallback is empty if cloud fails and we strictly want cloud
      setExercises([]);
    }
  }

  const addExercise = (ex: Exercise) => {
    setEditedPlan(prev => ({
      ...prev,
      exercises: [...prev.exercises, {
        exerciseId: ex.id,
        targetSets: 3,
        targetReps: '10',
        restTimer: defaultRest
      }]
    }));
    setShowExPicker(false);
    setExSearch('');
  };

  const createCustomAndAdd = async () => {
    if (!newExName.trim()) return;
    const newEx: Exercise = {
      id: crypto.randomUUID(),
      name: newExName.trim(),
      muscleGroup: newExGroup,
      isCustom: true
    };
    await saveToCloud('exercises', newEx);
    await loadExercises();
    addExercise(newEx);
    setIsAddingCustom(false);
    setNewExName('');
  };

  const filteredExercises = exercises.filter(ex => {
    const matchesSearch = (ex.name || '').toLowerCase().includes((exSearch || '').toLowerCase());
    const matchesFilter = exFilter === 'Todos' || ex.muscleGroup === exFilter;
    return matchesSearch && matchesFilter;
  });

  const removeExercise = (idx: number) => {
    setEditedPlan(prev => ({
      ...prev,
      exercises: prev.exercises.filter((_, i) => i !== idx)
    }));
  };

  const persist = async () => {
    await saveToCloud('plans', editedPlan);
    onSave(editedPlan);
  };

  return (
    <div className="py-4 space-y-6">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onCancel}><ChevronLeft /></Button>
        <h1 className="text-2xl flex-1">Editar Plano</h1>
        <Button variant="primary" size="sm" onClick={persist}>Salvar</Button>
      </header>

      <div className="space-y-4">
        <div>
           <label className="text-[10px] uppercase text-gray-500 font-bold block mb-1">Nome do Plano</label>
           <input 
             value={editedPlan.name}
             onChange={(e) => setEditedPlan({...editedPlan, name: e.target.value})}
             className="w-full bg-white/5 border border-white/10 rounded-xl h-12 px-4 focus:border-brand-primary outline-none text-white text-lg font-display"
             placeholder="Ex: Treino A - Superior"
           />
        </div>

        <div className="flex items-center justify-between">
           <h2 className="text-sm uppercase tracking-widest text-white/50">Exercícios ({editedPlan.exercises.length})</h2>
           <Button variant="secondary" size="sm" onClick={() => setShowExPicker(true)}>+ Adicionar</Button>
        </div>

        <div className="space-y-2">
           {editedPlan.exercises.map((ex, idx) => {
             const baseInfo = exercises.find(d => d.id === ex.exerciseId);
             return (
               <div key={idx} className="bg-bg-card border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex-1 overflow-hidden">
                     <p className="font-bold text-sm truncate">{baseInfo?.name || 'Exercício'}</p>
                     <div className="flex flex-wrap gap-2 mt-2">
                        <div className="flex items-center gap-1">
                          <input 
                            type="number"
                            value={ex.targetSets}
                            onChange={(e) => {
                              const newExs = [...editedPlan.exercises];
                              newExs[idx].targetSets = parseInt(e.target.value) || 0;
                              setEditedPlan({...editedPlan, exercises: newExs});
                            }}
                            className="w-10 h-8 bg-white/5 border border-white/10 rounded text-center text-xs text-white"
                          />
                          <span className="text-[9px] uppercase font-bold text-gray-500">séries</span>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          {baseInfo?.muscleGroup === 'Cardio' ? (
                            <div className="flex items-center gap-1">
                              <input 
                                type="number"
                                value={ex.targetDuration ? Math.floor(ex.targetDuration / 60) : ''}
                                onChange={(e) => {
                                  const newExs = [...editedPlan.exercises];
                                  newExs[idx].targetDuration = (parseInt(e.target.value) || 0) * 60;
                                  setEditedPlan({...editedPlan, exercises: newExs});
                                }}
                                className="w-14 h-8 bg-white/5 border border-white/10 rounded text-center text-xs text-white"
                                placeholder="min"
                              />
                              <span className="text-[9px] uppercase font-bold text-gray-500">min</span>
                            </div>
                          ) : (
                            <>
                              <input 
                                type="text"
                                value={ex.targetReps}
                                onChange={(e) => {
                                  const newExs = [...editedPlan.exercises];
                                  newExs[idx].targetReps = e.target.value;
                                  setEditedPlan({...editedPlan, exercises: newExs});
                                }}
                                className="w-16 h-8 bg-white/5 border border-white/10 rounded text-center text-xs text-white"
                                placeholder={ex.isVariationPerSet ? "12,10,8" : "10-12"}
                              />
                              <button 
                                onClick={() => {
                                  const newExs = [...editedPlan.exercises];
                                  newExs[idx].isVariationPerSet = !newExs[idx].isVariationPerSet;
                                  setEditedPlan({...editedPlan, exercises: newExs});
                                }}
                                className={`p-1.5 rounded-lg transition-colors flex items-center justify-center ${ex.isVariationPerSet ? 'bg-brand-primary text-black' : 'bg-white/5 text-gray-500 hover:text-white'}`}
                                title={ex.isVariationPerSet ? "Séries variadas ativas" : "Ativar séries variadas"}
                              >
                                <Activity size={12} />
                              </button>
                              
                              {ex.isVariationPerSet && (
                                <div className="group relative">
                                  <Info size={12} className="text-brand-primary/60 cursor-help" />
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-black border border-white/10 p-2 rounded-lg text-[8px] leading-tight text-gray-400 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity pointer-events-none z-50">
                                    Use vírgulas para separar as repetições de cada série. Ex: <span className="text-brand-primary">12, 10, 8</span>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                        {ex.isVariationPerSet && (
                          <p className="text-[7px] text-brand-primary/50 uppercase font-black tracking-widest mt-1 ml-1">Usar vírgulas: 12,10,8</p>
                        )}

                        <div className="flex items-center gap-1">
                          <input 
                            type="number"
                            value={ex.restTimer}
                            onChange={(e) => {
                              const newExs = [...editedPlan.exercises];
                              newExs[idx].restTimer = parseInt(e.target.value) || 0;
                              setEditedPlan({...editedPlan, exercises: newExs});
                            }}
                            className="w-12 h-8 bg-white/5 border border-white/10 rounded text-center text-xs text-brand-primary font-bold"
                          />
                          <span className="text-[9px] uppercase font-bold text-gray-500">desc.</span>
                        </div>
                     </div>
                  </div>
                  <div className="flex flex-col gap-1 mr-2">
                     <button 
                       disabled={idx === 0}
                       onClick={() => {
                         const newExs = [...editedPlan.exercises];
                         [newExs[idx - 1], newExs[idx]] = [newExs[idx], newExs[idx - 1]];
                         setEditedPlan({...editedPlan, exercises: newExs});
                       }}
                       className="p-1 hover:bg-white/10 rounded disabled:opacity-20"
                     >
                        <Plus className="rotate-45" size={12} />
                     </button>
                     <button 
                       disabled={idx === editedPlan.exercises.length - 1}
                       onClick={() => {
                         const newExs = [...editedPlan.exercises];
                         [newExs[idx + 1], newExs[idx]] = [newExs[idx], newExs[idx + 1]];
                         setEditedPlan({...editedPlan, exercises: newExs});
                       }}
                       className="p-1 hover:bg-white/10 rounded disabled:opacity-20"
                     >
                        <Plus className="rotate-[225deg]" size={12} />
                     </button>
                  </div>
                  <Button variant="danger" size="icon" className="h-8 w-8 bg-transparent hover:bg-red-500/20 text-red-500 border-none" onClick={() => removeExercise(idx)}><X size={16} /></Button>
               </div>
             );
           })}
        </div>
      </div>

      {showExPicker && (
        <div className="fixed inset-0 bg-black/95 z-[150] p-4 flex flex-col pt-safe">
           <header className="flex justify-between items-center mb-4">
              <h2 className="text-xl italic">Selecionar Exercício</h2>
              <Button variant="ghost" size="icon" onClick={() => { setShowExPicker(false); setIsAddingCustom(false); }}><X /></Button>
           </header>
           
           {!isAddingCustom ? (
             <>
               <div className="relative mb-4">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted w-4 h-4" />
                 <input 
                   type="text"
                   placeholder="Buscar exercício..."
                   value={exSearch}
                   onChange={(e) => setExSearch(e.target.value)}
                   className="w-full bg-white/5 border border-white/10 h-12 pl-10 pr-4 rounded-xl outline-none focus:border-brand-primary text-white text-sm"
                 />
               </div>

               <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                  {filteredExercises.length > 0 ? (
                    filteredExercises.map(ex => (
                      <div 
                        key={ex.id} 
                        onClick={() => addExercise(ex)}
                        className="bg-bg-card p-4 rounded-xl flex justify-between items-center active:bg-brand-primary active:text-black transition-colors border border-white/5"
                      >
                         <div>
                            <p className="font-bold text-sm tracking-tight">{ex.name}</p>
                            <p className="text-[10px] uppercase text-muted font-bold tracking-widest">{ex.muscleGroup}</p>
                         </div>
                         <Plus size={16} className="text-brand-primary" />
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted">
                       <p className="text-sm italic mb-2">Exercício não encontrado.</p>
                       <Button size="sm" variant="secondary" onClick={() => setIsAddingCustom(true)}>Cadastrar Personalizado</Button>
                    </div>
                  )}
               </div>
               
               <Button variant="secondary" className="w-full" onClick={() => setIsAddingCustom(true)}>+ Novo Exercício</Button>
             </>
           ) : (
             <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               className="space-y-6"
             >
                <div className="space-y-4 bg-bg-card p-6 rounded-3xl border border-white/10">
                   <h3 className="text-lg italic font-black uppercase text-brand-primary font-display">Cadastrar Personalizado</h3>
                   
                   <div>
                      <label className="text-[10px] uppercase text-muted font-bold block mb-1 tracking-widest">Nome do Exercício</label>
                      <input 
                        value={newExName}
                        onChange={(e) => setNewExName(e.target.value)}
                        autoFocus
                        className="w-full bg-black/40 border border-white/10 rounded-xl h-12 px-4 focus:border-brand-primary outline-none text-white font-bold"
                        placeholder="Ex: Leg Press Articulado"
                      />
                   </div>

                   <div>
                      <label className="text-[10px] uppercase text-muted font-bold block mb-1 tracking-widest">Grupo Muscular Principal</label>
                      <select 
                        value={newExGroup}
                        onChange={(e) => setNewExGroup(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl h-12 px-4 focus:border-brand-primary outline-none text-white text-sm appearance-none"
                      >
                         {['Peito', 'Costas', 'Pernas', 'Ombros', 'Braços', 'Core', 'Cardio'].map(g => (
                           <option key={g} value={g}>{g}</option>
                         ))}
                      </select>
                   </div>

                   <div className="grid grid-cols-2 gap-3 pt-2">
                      <Button variant="ghost" onClick={() => setIsAddingCustom(false)}>Cancelar</Button>
                      <Button onClick={createCustomAndAdd}>Adicionar</Button>
                   </div>
                </div>
             </motion.div>
           )}
        </div>
      )}
    </div>
  );
}

// --- Active Workout Overlay (Session) ---

function ActiveWorkoutOverlay({ session, onClose, onDiscard, onSave }: { session: WorkoutSession, onClose: () => void, onDiscard: () => void, onSave: (w: WorkoutSession) => void }) {
  const isEditing = !!session.isCompleted;
  const [currentSession, setCurrentSession] = useState<WorkoutSession>(JSON.parse(JSON.stringify(session)));
  const [previousData, setPreviousData] = useState<Record<string, ExerciseLog | null>>({});
  const [exerciseDetails, setExerciseDetails] = useState<Record<string, Exercise>>({});
  const [startTime] = useState(isEditing ? (session.date || Date.now()) : (Date.now() - (session.duration || 0) * 1000));
  const [elapsed, setElapsed] = useState(session.duration || 0);
  const [restTime, setRestTime] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);
  const [showIncompleteWarning, setShowIncompleteWarning] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  useEffect(() => {
    async function loadData() {
      // 1. Load Custom Exercises from Cloud
      const snap = await getDocs(getCollectionRef('exercises'));
      const customExs = snap.docs.map(d => d.data() as Exercise);
      const allExs = [...DEFAULT_EXERCISES, ...customExs];
      
      const exMap: Record<string, Exercise> = {};
      allExs.forEach(ex => exMap[ex.id] = ex);
      setExerciseDetails(exMap);

      // 2. Load Recent Sessions from Cloud to get Previous Stats
      const sessionsQuery = query(getCollectionRef('sessions'), orderBy('date', 'desc'), limit(50));
      const sessionsSnap = await getDocs(sessionsQuery);
      const allSessions = sessionsSnap.docs.map(d => d.data() as WorkoutSession);
      
      const latestData: Record<string, ExerciseLog | null> = {};
      for (const ex of currentSession.exercises) {
        const prevSession = allSessions.find(s => 
          s.id !== currentSession.id && s.exercises.some(e => e.exerciseId === ex.exerciseId)
        );
        latestData[ex.exerciseId] = prevSession?.exercises.find(e => e.exerciseId === ex.exerciseId) || null;
      }
      setPreviousData(latestData);
    }
    loadData();
  }, [currentSession.id]);

  // Persist session progress to localStorage
  useEffect(() => {
    if (isEditing) return;
    const sessionData = {
      ...currentSession,
      duration: elapsed,
      lastUpdated: Date.now()
    };
    localStorage.setItem('ironlog_active_session', JSON.stringify(sessionData));
  }, [currentSession, elapsed, isEditing]);

  useEffect(() => {
    if (isEditing) return;
    const itv = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(itv);
  }, [startTime, isEditing]);

  useEffect(() => {
    if (restTime > 0) {
      const itv = setInterval(() => {
        setRestTime(prev => {
          if (prev <= 1) {
            if (window.navigator.vibrate) window.navigator.vibrate([200, 100, 200]);
            
            // Notification when timer ends
            if ('Notification' in window && Notification.permission === 'granted') {
              const notificationTitle = 'IronLog: Descanso Concluído!';
              const notificationOptions = {
                body: 'Hora de esmagar a próxima série!',
                icon: 'https://img.icons8.com/ios-filled/512/dumbbell.png',
                vibrate: [200, 100, 200],
                tag: 'rest-timer',
                renotify: true
              };

              if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                navigator.serviceWorker.ready.then(reg => {
                  reg.showNotification(notificationTitle, notificationOptions);
                });
              } else {
                new Notification(notificationTitle, notificationOptions);
              }
            }
            
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(itv);
    }
  }, [restTime]);

  const toggleSet = (exIdx: number, setIdx: number) => {
    const newSession = { ...currentSession };
    const set = newSession.exercises[exIdx].sets[setIdx];
    const wasCompleted = set.completed;
    set.completed = !set.completed;
    
    if (set.completed) {
      if (window.navigator.vibrate) window.navigator.vibrate(50);
      setRestTime(newSession.exercises[exIdx].restTimer || 60); 
      
      // Check if exercise is completed
      const allSetsDone = newSession.exercises[exIdx].sets.every(s => s.completed);
      if (allSetsDone && window.navigator.vibrate) {
        setTimeout(() => window.navigator.vibrate([100, 50, 100]), 300);
      }
    } else {
      setRestTime(0);
    }
    
    setCurrentSession(newSession);
  };

  const updateSet = (exIdx: number, setIdx: number, field: 'weight' | 'reps' | 'duration', value: number) => {
    const newSession = { ...currentSession };
    newSession.exercises[exIdx].sets[setIdx][field] = value;
    setCurrentSession(newSession);
  };

  const finishWorkout = () => {
    const totalVol = currentSession.exercises.reduce((acc, ex) => {
      const detail = exerciseDetails[ex.exerciseId];
      return acc + ex.sets.reduce((sAcc, s) => {
        if (!s.completed) return sAcc;
        if (detail?.muscleGroup === 'Cardio') {
          return sAcc + (s.weight * (s.duration ? s.duration / 60 : 0));
        }
        return sAcc + (s.weight * s.reps);
      }, 0);
    }, 0);
    
    // Sync to Cloud
    if (!isEditing) {
      updateUserStats(auth.currentUser?.uid || '', totalVol);
    }

    onSave({
      ...currentSession,
      totalVolume: totalVol,
      duration: elapsed,
      isCompleted: true,
      date: isEditing ? currentSession.date : Date.now()
    });
  };

  const handleFinishRequest = () => {
    const hasIncomplete = currentSession.exercises.some(ex => 
      ex.sets.some(s => !s.completed)
    );
    
    if (hasIncomplete) {
      setShowIncompleteWarning(true);
    } else {
      setIsFinishing(true);
    }
  };

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div 
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      className="fixed inset-0 bg-bg-base z-[100] flex flex-col pt-safe no-scrollbar h-full overflow-y-auto"
    >
      <header className="bg-bg-card p-4 flex items-center justify-between sticky top-0 z-[110] border-b border-white/5">
         <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-14 h-14 bg-brand-primary text-black rounded-full flex items-center justify-center font-display font-black italic text-xl shadow-[0_0_20px_rgba(255,94,26,0.2)]">
                {formatTime(elapsed)}
              </div>
            </div>
            <div>
               <h2 className="text-2xl leading-none font-black italic">{currentSession.workoutPlanName}</h2>
               <div className="text-[10px] font-black text-brand-primary uppercase tracking-[0.1em] flex items-center gap-1.5 mt-1.5">
                 Sessão em curso <div className="w-2 h-2 bg-brand-primary rounded-full animate-pulse" />
               </div>
            </div>
         </div>
         <div className="flex items-center gap-2">
            {!isEditing && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDiscardConfirm(true);
                }} 
                className="text-red-500/60 hover:text-red-500 border border-red-500/10 h-10 px-3"
              >
                <Trash2 size={18} />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose} className="text-muted border border-white/10 h-10 px-4">Minimizar</Button>
          </div>
      </header>

      {/* Rest Timer Banner */}
      {restTime > 0 && (
        <motion.div 
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="bg-brand-primary text-black py-3 px-6 flex items-center justify-between sticky top-[88px] z-[105] font-black shadow-[0_8px_30px_rgba(255,94,26,0.3)]"
        >
          <div className="flex items-center gap-3 text-sm uppercase tracking-tighter">
             <Timer size={20} strokeWidth={3} /> <span className="italic">DESCANSANDO:</span>
          </div>
          <div className="text-3xl font-display leading-none italic">
             {restTime}s
          </div>
          <button onClick={() => setRestTime(0)} className="bg-black/10 p-2 rounded-full text-black hover:bg-black/20"><X size={18} strokeWidth={3} /></button>
        </motion.div>
      )}

      {/* Custom Discard Confirmation Overlay */}
      <AnimatePresence>
        {showDiscardConfirm && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm"
            >
              <Card className="border-red-500/20 shadow-2xl">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                    <Trash2 className="text-red-500 w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black italic uppercase">Descartar Treino?</h3>
                    <p className="text-gray-400 text-sm mt-2">
                      Todo o progresso atual deste treino será perdido permanentemente. Esta ação não pode ser desfeita.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 pt-2">
                    <Button 
                      variant="danger" 
                      className="w-full" 
                      onClick={onDiscard}
                    >
                      Sim, Descartar
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="w-full border border-white/5" 
                      onClick={() => setShowDiscardConfirm(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="px-5 py-8 space-y-10 flex-1 pb-40">
        {currentSession.exercises.map((ex, exIdx) => {
          const detail = exerciseDetails[ex.exerciseId];
          const planEx = session.exercises[exIdx]; // Original plan details if needed
          return (
            <div key={exIdx} className="bg-bg-card rounded-[24px] p-6 border-l-4 border-l-brand-primary shadow-xl">
               <div className="flex items-center justify-between mb-4">
                  <h3 className="text-2xl italic font-black leading-tight">{detail?.name || 'Exercício'}</h3>
                  <Badge variant="secondary">{ex.sets.length} séries</Badge>
               </div>
               
               <div className="flex gap-4 text-muted text-xs font-bold uppercase tracking-widest mb-6 px-1">
                 <span>Meta: {ex.sets.length} {detail?.muscleGroup === 'Cardio' ? 'SxT' : 'SxR'}</span>
                 <div className="w-1 h-1 bg-muted/40 rounded-full mt-1.5" />
                 <span>{detail?.muscleGroup || 'Muscle'}</span>
               </div>

               {/* Last session summary */}
               {previousData[ex.exerciseId] ? (
                 <div className="bg-brand-primary/5 border border-dashed border-brand-primary/30 p-4 rounded-xl text-[10px] text-gray-400 flex flex-col gap-2 mb-8">
                    <div className="flex flex-col gap-1">
                       <span className="uppercase font-black text-brand-primary tracking-widest">Última sessão:</span>
                       <span className="text-white font-medium text-xs">
                          {previousData[ex.exerciseId]?.sets.map(s => {
                             if (detail?.muscleGroup === 'Cardio') {
                               return `${s.weight}Lvl x ${s.duration ? Math.floor(s.duration / 60) : 0}min`;
                             }
                             return `${s.weight}kg x ${s.reps}`;
                           }).join(' | ')}
                       </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                       <Badge variant="success">Sugestão: +2.5kg</Badge>
                    </div>
                 </div>
               ) : (
                 <div className="bg-white/5 border border-dashed border-white/10 p-4 rounded-xl text-[10px] text-muted flex justify-center uppercase font-bold tracking-widest mb-8">
                    Início da jornada!
                 </div>
               )}

               <div className="space-y-3">
                  <div className="grid grid-cols-[40px_1fr_1fr_50px] gap-3 px-3 text-[10px] font-black uppercase text-muted tracking-widest">
                    <div className="text-center">Set</div>
                    <div className="text-center">{detail?.muscleGroup === 'Cardio' ? 'Nível/Vel' : 'Peso kg'}</div>
                    <div className="text-center">{detail?.muscleGroup === 'Cardio' ? 'Tempo min' : 'Reps'}</div>
                    <div></div>
                  </div>
                  {ex.sets.map((set, setIdx) => {
                    const getPlaceholder = () => {
                      if (detail?.muscleGroup === 'Cardio') {
                        return ex.targetDuration ? String(Math.floor(ex.targetDuration / 60)) : '--';
                      }
                      if (ex.isVariationPerSet && ex.targetReps) {
                        const parts = ex.targetReps.split(',').map(p => p.trim());
                        return parts[setIdx] || parts[parts.length - 1] || '--';
                      }
                      return ex.targetReps || '--';
                    };

                    return (
                      <div 
                        key={setIdx} 
                        className={`grid grid-cols-[40px_1fr_1fr_50px] items-center gap-3 p-2 rounded-xl transition-all duration-300 ${set.completed ? 'bg-brand-secondary/10 border-brand-secondary/20' : 'bg-[#252525]'}`}
                      >
                         <div className="text-center font-display text-muted text-xl italic font-black">{setIdx + 1}</div>
                         <div className="flex flex-col">
                           <input 
                             type="number"
                             inputMode="decimal"
                             value={set.weight || ''}
                             onChange={(e) => updateSet(exIdx, setIdx, 'weight', parseFloat(e.target.value))}
                             className="w-full h-12 bg-transparent border-none rounded-lg text-center text-xl font-display font-black text-white focus:ring-0"
                             placeholder="--"
                           />
                         </div>
                         <div className="flex flex-col">
                           <input 
                             type="number"
                             inputMode={detail?.muscleGroup === 'Cardio' ? 'decimal' : 'numeric'}
                             value={detail?.muscleGroup === 'Cardio' ? (set.duration ? set.duration / 60 : '') : (set.reps || '')}
                             onChange={(e) => {
                               if (detail?.muscleGroup === 'Cardio') {
                                 updateSet(exIdx, setIdx, 'duration', (parseFloat(e.target.value) || 0) * 60);
                               } else {
                                 updateSet(exIdx, setIdx, 'reps', parseInt(e.target.value) || 0);
                               }
                             }}
                             className="w-full h-12 bg-transparent border-none rounded-lg text-center text-xl font-display font-black text-white focus:ring-0"
                             placeholder={getPlaceholder()}
                           />
                         </div>
                         <button 
                           onClick={() => toggleSet(exIdx, setIdx)}
                           className={`h-10 w-10 flex items-center justify-center rounded-full transition-all border-2 ${set.completed ? 'bg-brand-secondary border-brand-secondary text-black' : 'bg-transparent border-muted/20 text-muted'}`}
                         >
                           {set.completed ? <CheckCircle2 size={24} strokeWidth={3} /> : <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                         </button>
                      </div>
                    );
                  })}
               </div>
            </div>
          );
        })}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-bg-base via-bg-base to-transparent z-[120]">
        <Button size="lg" className="w-full shadow-[0_12px_40px_rgba(255,94,26,0.3)] text-lg font-black italic tracking-tighter" onClick={handleFinishRequest}>
           FINALIZAR TREINO
        </Button>
      </div>

      <AnimatePresence>
        {isFinishing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-6 z-[200]"
          >
             <Card className="w-full max-w-sm space-y-6 text-center border-brand-primary/20">
                <motion.div 
                  initial={{ scale: 0.5, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  className="flex justify-center"
                >
                   <div className="w-20 h-20 bg-brand-primary/20 rounded-full flex items-center justify-center text-brand-primary shadow-[0_0_30px_rgba(255,94,26,0.3)]">
                      <Trophy size={40} className="animate-bounce" />
                   </div>
                </motion.div>
                <div>
                   <h2 className="text-3xl italic font-black uppercase">Parabéns!</h2>
                   <p className="text-gray-400 text-sm font-medium">Treino concluído com sucesso. Deseja registrar a sessão?</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                   <Button variant="secondary" onClick={() => setIsFinishing(false)}>Ainda não</Button>
                   <Button variant="primary" onClick={finishWorkout}>Registrar!</Button>
                </div>
             </Card>
          </motion.div>
        )}

        {showIncompleteWarning && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-6 z-[200]"
          >
             <Card className="w-full max-w-sm space-y-6 text-center border-yellow-500/20">
                <div className="flex justify-center">
                   <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center text-yellow-500">
                      <AlertTriangle size={40} />
                   </div>
                </div>
                <div>
                   <h2 className="text-2xl italic font-black uppercase">Exercícios Incompletos</h2>
                   <p className="text-gray-400 text-sm font-medium">Você ainda possui séries pendentes. Tem certeza que deseja finalizar o treino agora?</p>
                </div>
                <div className="flex flex-col gap-2">
                   <Button variant="primary" onClick={() => {
                     setShowIncompleteWarning(false);
                     setIsFinishing(true);
                   }}>Sim, Finalizar</Button>
                   <Button variant="ghost" onClick={() => setShowIncompleteWarning(false)}>Continuar treinando</Button>
                </div>
             </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// --- View: Settings ---

// --- View: Settings ---

function SettingsView({ onBack, onLogout }: { onBack: () => void, onLogout: () => void }) {
  const [defaultRest, setDefaultRest] = useState(60);
  const [weeklyGoal, setWeeklyGoal] = useState(5);
  const [displayName, setDisplayName] = useState(auth.currentUser?.displayName || '');
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const unsubSettings = onSnapshot(getDocRef('settings', 'user-settings'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data.defaultRestTime) setDefaultRest(data.defaultRestTime);
        if (data.weeklyGoal) setWeeklyGoal(data.weeklyGoal);
      }
    });

    const unsubProfile = onSnapshot(doc(db, 'users', auth.currentUser?.uid || ''), (snap) => {
      if (snap.exists()) {
        setProfile(snap.data());
        setDisplayName(snap.data().displayName);
      }
    });

    return () => {
      unsubSettings();
      unsubProfile();
    };
  }, []);

  const saveSettings = async (updates: any) => {
    await saveToCloud('settings', { id: 'user-settings', ...updates });
  };

  const updateName = async () => {
    if (!displayName.trim() || !auth.currentUser) return;
    try {
      await updateUserDisplayName(auth.currentUser.uid, displayName.trim());
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="py-4 space-y-8"
    >
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}><ChevronLeft /></Button>
        <h1 className="text-3xl italic font-black uppercase tracking-tighter">Ajustes</h1>
      </header>

      <div className="flex items-center gap-4 px-2">
        <img src={auth.currentUser?.photoURL || ''} alt="" className="w-16 h-16 rounded-2xl border-2 border-brand-primary shadow-xl" referrerPolicy="no-referrer" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <input 
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onBlur={updateName}
              className="bg-transparent border-b border-white/10 focus:border-brand-primary outline-none font-display text-xl leading-none italic uppercase w-full py-1"
            />
          </div>
          <p className="text-muted text-xs font-bold truncate max-w-[200px] mt-1">{auth.currentUser?.email}</p>
        </div>
      </div>

      <section className="space-y-4">
        <Card className="space-y-4">
           <div>
              <label className="text-xs uppercase text-muted font-bold block mb-2 tracking-widest">Tempo de Descanso Padrão (segundos)</label>
              <div className="flex items-center gap-4">
                 <input 
                   type="number"
                   value={defaultRest}
                   onChange={(e) => saveSettings({ defaultRestTime: parseInt(e.target.value) || 0 })}
                   className="flex-1 bg-white/5 border border-white/10 rounded-xl h-14 px-4 focus:border-brand-primary outline-none text-white text-xl font-display font-black"
                 />
                 <div className="text-brand-primary font-black italic text-xl w-16">{defaultRest}s</div>
              </div>
           </div>
        </Card>

        <Card className="space-y-4">
           <div>
              <label className="text-xs uppercase text-muted font-bold block mb-2 tracking-widest">Meta de Treinos Semanais (Dias)</label>
              <div className="flex items-center gap-4">
                 <input 
                   type="range"
                   min="1"
                   max="7"
                   step="1"
                   value={weeklyGoal}
                   onChange={(e) => saveSettings({ weeklyGoal: parseInt(e.target.value) })}
                   className="flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-brand-primary"
                 />
                 <div className="text-brand-primary font-black italic text-2xl w-10">{weeklyGoal}</div>
              </div>
              <p className="text-[10px] text-muted mt-2 leading-relaxed uppercase font-bold tracking-tight">
                Quantos dias por semana você pretende treinar? Seus marcadores no topo da página refletirão esse objetivo.
              </p>
           </div>
        </Card>

        <Card className="space-y-4">
           <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs uppercase text-muted font-bold block tracking-widest">Notificações</label>
                <div className={`px-2 py-1 rounded text-[9px] font-black uppercase ${
                  typeof Notification === 'undefined' ? 'bg-gray-500/20 text-gray-500' :
                  Notification.permission === 'granted' ? 'bg-brand-secondary text-black' : 'bg-red-500/20 text-red-500'
                }`}>
                  {typeof Notification === 'undefined' ? 'Não suportado' :
                   Notification.permission === 'granted' ? 'Ativado' : 'Desativado'}
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className="flex-1">
                   <p className="text-[10px] text-muted leading-relaxed uppercase font-bold tracking-tight">
                     Ative as notificações para receber alertas quando o tempo de descanso terminar, mesmo com o app em segundo plano.
                   </p>
                   {window.self !== window.top && (
                     <p className="text-[9px] text-brand-primary mt-1 uppercase font-bold">
                       Importante: Abra o app em uma nova aba para as notificações funcionarem.
                     </p>
                   )}
                </div>
                {typeof Notification !== 'undefined' && Notification.permission !== 'granted' && (
                  <Button 
                    size="sm" 
                    variant="primary" 
                    className="h-10 px-4 text-[10px]"
                    onClick={() => {
                      Notification.requestPermission().then(permission => {
                        if (permission === 'granted') window.location.reload();
                      });
                    }}
                  >
                    Ativar
                  </Button>
                )}
              </div>
           </div>
        </Card>

          <Button variant="danger" className="w-full flex gap-2 h-14" onClick={onLogout}>
            <X className="w-5 h-5" /> Sair da Conta
          </Button>

          <Button 
            variant="ghost" 
            className="w-full text-xs font-bold uppercase tracking-widest opacity-60 hover:opacity-100" 
            onClick={() => {
              localStorage.removeItem('ironlog_tutorial_seen');
              window.location.reload();
            }}
          >
            Ver Tutorial Novamente
          </Button>
        </section>

      <div className="pt-10 text-center">
         <p className="text-[10px] text-muted uppercase font-bold tracking-widest">IronLog v1.2.0 • Build 2026</p>
      </div>
    </motion.div>
  );
}

// --- View: Ranking ---

function RankingView({ currentUser }: { currentUser: FirebaseUser }) {
  const [rankings, setRankings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'weekly' | 'monthly' | 'yearly' | 'total'>('total');
  const [rankingType, setRankingType] = useState<'workouts' | 'frequency'>('workouts');
  const [rankingStats, setRankingStats] = useState<Record<string, number>>({});

  useEffect(() => {
    setLoading(true);
    const now = new Date();
    const periodIds = {
      weekly: format(now, 'yyyy-ww'),
      monthly: format(now, 'yyyy-MM'),
      yearly: format(now, 'yyyy')
    };

    // Pull users with at least one workout
    const q = query(
      collection(db, 'users'), 
      where('totalWorkouts', '>', 0),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      
      const currentId = periodIds[range as keyof typeof periodIds];

      // If frequency is selected, we need to calculate it from sessions
      if (rankingType === 'frequency') {
        const stats: Record<string, number> = {};
        
        await Promise.all(data.map(async (user) => {
          let sessionQuery;
          if (range === 'total') {
            sessionQuery = query(collection(db, 'users', user.uid, 'sessions'), where('isCompleted', '==', true));
          } else {
            // Estimate timestamps for period
            let start, end;
            const now = new Date();
            if (range === 'weekly') { start = startOfWeek(now).getTime(); end = endOfWeek(now).getTime(); }
            else if (range === 'monthly') { start = new Date(now.getFullYear(), now.getMonth(), 1).getTime(); end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23).getTime(); }
            else { start = new Date(now.getFullYear(), 0, 1).getTime(); end = new Date(now.getFullYear(), 11, 31, 23).getTime(); }

            sessionQuery = query(
              collection(db, 'users', user.uid, 'sessions'), 
              where('isCompleted', '==', true),
              where('date', '>=', start),
              where('date', '<=', end)
            );
          }

          const snap = await getDocs(sessionQuery);
          const days = new Set();
          snap.docs.forEach(doc => {
            const sessionData = doc.data() as any;
            days.add(new Date(sessionData.date).toDateString());
          });
          stats[user.uid] = days.size;
        }));
        
        setRankingStats(stats);
        data = data.sort((a, b) => (stats[b.uid] || 0) - (stats[a.uid] || 0)).slice(0, 50);
      } else {
        // Fallback to pre-calculated stats for workouts
        if (range === 'total') {
          data = data.sort((a, b) => (b.totalWorkouts || 0) - (a.totalWorkouts || 0)).slice(0, 50);
        } else {
          data = data.sort((a, b) => {
            const valA = a[range]?.id === currentId ? (a[range]?.workouts || 0) : 0;
            const valB = b[range]?.id === currentId ? (b[range]?.workouts || 0) : 0;
            return valB - valA;
          }).slice(0, 50);
        }
      }
      
      setRankings(data);
      setLoading(false);
    }, (err) => {
      console.error("Ranking query error:", err);
      setRankings([]);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [range, rankingType]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="py-4 space-y-6"
    >
      <header className="relative">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand-primary/10 rounded-full blur-3xl pointer-events-none" />
        <h1 className="text-4xl italic font-black uppercase tracking-tighter leading-tight">Olimpo <span className="text-brand-primary">Iron</span></h1>
        
        {/* Metric Label and Selector */}
        <div className="mt-4 flex items-center justify-between">
           <p className="text-[10px] font-black uppercase tracking-[0.1em] text-gray-500">
             Ranking por {rankingType === 'workouts' ? 'Total de Treinos' : 'Frequência (Dias Únicos)'}
           </p>
           <div className="flex gap-2">
              <button 
                onClick={() => setRankingType('workouts')}
                className={`p-1.5 rounded-lg border transition-all ${rankingType === 'workouts' ? 'border-brand-primary bg-brand-primary/10 text-brand-primary' : 'border-white/5 bg-white/5 text-gray-500 hover:bg-white/10'}`}
              >
                 <Trophy size={14} />
              </button>
              <button 
                onClick={() => setRankingType('frequency')}
                className={`p-1.5 rounded-lg border transition-all ${rankingType === 'frequency' ? 'border-brand-primary bg-brand-primary/10 text-brand-primary' : 'border-white/5 bg-white/5 text-gray-500 hover:bg-white/10'}`}
              >
                 <Calendar size={14} />
              </button>
           </div>
        </div>

        {/* Range Selector */}
        <div className="flex gap-4 mt-4 overflow-x-auto no-scrollbar pb-1">
           {[
             { id: 'weekly', label: 'Semanal' },
             { id: 'monthly', label: 'Mensal' },
             { id: 'yearly', label: 'Anual' },
             { id: 'total', label: 'Geral' }
           ].map(r => (
             <button 
               key={r.id}
               onClick={() => setRange(r.id as any)}
               className={`whitespace-nowrap text-[11px] font-black uppercase italic tracking-tight transition-all pb-1 border-b-2 ${range === r.id ? 'text-white border-brand-primary' : 'text-gray-600 border-transparent hover:text-gray-400'}`}
             >
               {r.label}
             </button>
           ))}
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-20">
          <Dumbbell className="animate-spin text-brand-primary w-10 h-10" />
        </div>
      ) : rankings.length > 0 ? (
        <div className="space-y-3">
          {rankings.map((user, index) => {
            const isMe = user.uid === currentUser.uid;
            return (
              <motion.div
                key={user.uid}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className={`relative flex items-center gap-4 transition-all ${isMe ? 'border-brand-primary bg-brand-primary/5' : 'border-white/5'}`}>
                   <div className="w-8 text-center">
                      {index === 0 ? <Trophy className="w-6 h-6 text-yellow-500 mx-auto" strokeWidth={3} /> :
                       index === 1 ? <Trophy className="w-6 h-6 text-gray-400 mx-auto" strokeWidth={3} /> :
                       index === 2 ? <Trophy className="w-6 h-6 text-amber-700 mx-auto" strokeWidth={3} /> :
                       <span className="text-lg font-black italic text-gray-700">#{index + 1}</span>}
                   </div>
                   
                   <img 
                    src={user.photoURL || 'https://picsum.photos/seed/user/100/100'} 
                    alt="" 
                    className={`w-12 h-12 rounded-xl border-2 ${isMe ? 'border-brand-primary' : 'border-white/10'}`}
                    referrerPolicy="no-referrer"
                   />
                   
                   <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-sm truncate uppercase tracking-tight">{user.displayName}</h4>
                        {isMe && <Badge>Você</Badge>}
                      </div>
                      <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mt-0.5">{user.totalWorkouts} treinos concluídos</p>
                   </div>

                   <div className="text-right">
                       <p className="text-lg font-display font-black italic text-brand-primary leading-none">
                         {rankingType === 'frequency' ? (rankingStats[user.uid] || 0) : (() => {
                            if (range === 'total') return user.totalWorkouts || 0;
                            const now = new Date();
                            const pId = format(now, range === 'weekly' ? 'yyyy-ww' : range === 'monthly' ? 'yyyy-MM' : 'yyyy');
                            return user[range]?.id === pId ? (user[range]?.workouts || 0) : 0;
                         })()}
                       </p>
                       <p className="text-[9px] text-gray-600 uppercase font-bold">
                          {rankingType === 'frequency' ? 'Dias' : (range === 'total' ? 'Treinos' : 'Strikes')}
                       </p>
                    </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
           <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center">
              <Dumbbell className="text-gray-700 w-8 h-8" />
           </div>
           <div>
             <p className="text-sm font-bold uppercase tracking-tight">Nenhum registro para este período</p>
             <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Seja o primeiro a treinar e assuma o topo!</p>
           </div>
        </div>
      )}

      {!rankings.some(u => u.uid === currentUser.uid) && !loading && (
        <p className="text-center text-[10px] text-gray-600 uppercase font-bold py-4">Treine mais para aparecer no Top 50!</p>
      )}
    </motion.div>
  );
}

// --- View: Grupos (Social Competition) ---

function GruposView({ currentUser }: { currentUser: FirebaseUser }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [newGroupStartDate, setNewGroupStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [newGroupEndDate, setNewGroupEndDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [newGroupRankingType, setNewGroupRankingType] = useState<'workouts' | 'frequency'>('workouts');

  useEffect(() => {
    // Listen to groups where user is a member
    const q = query(
      collection(db, 'groups'), 
      where('memberIds', 'array-contains', currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    
    const unsub = onSnapshot(q, (snap) => {
      const updatedGroups = snap.docs.map(d => d.data() as Group);
      setGroups(updatedGroups);
      
      // Sync activeGroup if it's currently open
      setActiveGroup(prevActive => {
        if (!prevActive) return null;
        const fresh = updatedGroups.find(g => g.id === prevActive.id);
        return fresh || null;
      });
      
      setLoading(false);
    }, (err) => {
      console.error("Grupos listener error:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [currentUser.uid]);

  const createGroup = async () => {
    if (!groupName.trim() || !newGroupStartDate || !newGroupEndDate) return;
    const gId = crypto.randomUUID();
    const newGroup: Group = {
      id: gId,
      name: groupName.trim(),
      inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
      creatorId: currentUser.uid,
      memberIds: [currentUser.uid],
      createdAt: Date.now(),
      startDate: new Date(newGroupStartDate + 'T00:00:00').getTime(),
      endDate: new Date(newGroupEndDate + 'T23:59:59').getTime(),
      rankingType: newGroupRankingType
    };
    try {
      await setDoc(doc(db, 'groups', gId), newGroup);
      setGroupName('');
      setShowCreate(false);
      setActiveGroup(newGroup);
    } catch (err) {
      console.error(err);
      alert("Erro ao criar grupo.");
    }
  };

  const joinGroup = async () => {
    if (!inviteCode.trim()) return;
    try {
      const q = query(collection(db, 'groups'), where('inviteCode', '==', inviteCode.trim().toUpperCase()));
      const snap = await getDocs(q);
      if (snap.empty) {
        alert("Código inválido ou grupo não encontrado!");
        return;
      }
      const groupDoc = snap.docs[0];
      const group = groupDoc.data() as Group;
      
      if (group.memberIds.includes(currentUser.uid)) {
        alert("Você já faz parte deste grupo!");
        setActiveGroup(group);
        setShowJoin(false);
        return;
      }

      await updateDoc(doc(db, 'groups', group.id), {
        memberIds: arrayUnion(currentUser.uid)
      });
      
      setInviteCode('');
      setShowJoin(false);
      setActiveGroup({ ...group, memberIds: [...group.memberIds, currentUser.uid] });
    } catch (err: any) {
      console.error("Join Group Error:", err);
      // Fornecer feedback mais específico se possível
      if (err?.code === 'permission-denied') {
        alert("Erro de permissão: Você não tem permissão para entrar neste grupo.");
      } else {
        alert("Erro ao entrar no grupo. Verifique sua conexão ou o código informado.");
      }
    }
  };

  if (activeGroup) {
     return <GroupDetailsView group={activeGroup} onBack={() => setActiveGroup(null)} currentUser={currentUser} />;
  }

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="py-4 space-y-8"
    >
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl italic font-black uppercase tracking-tighter leading-tight">Meus <span className="text-brand-secondary">Grupos</span></h1>
          <p className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mt-1">Competição Privada</p>
        </div>
        <div className="flex gap-2">
           <Button variant="ghost" size="icon" onClick={() => setShowJoin(true)} className="w-10 h-10 border border-white/5"><UserPlus size={18} /></Button>
           <Button variant="primary" size="icon" onClick={() => setShowCreate(true)} className="w-10 h-10"><Plus size={18} /></Button>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-20">
          <Dumbbell className="animate-spin text-brand-primary w-8 h-8" />
        </div>
      ) : groups.length > 0 ? (
        <div className="grid gap-4">
           {groups.map(g => (
             <Card 
               key={g.id} 
               onClick={() => setActiveGroup(g)}
               className="group relative overflow-hidden transition-all hover:border-brand-primary/40 active:scale-[0.98] cursor-pointer"
             >
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                   <Users size={60} />
                </div>
                                 <h3 className="text-xl font-black italic mb-1 uppercase">{g.name}</h3>
                 <div className="flex flex-wrap items-center gap-2 mb-4">
                    <div className="flex items-center gap-1.5 bg-brand-primary/10 px-2 py-1 rounded-lg border border-brand-primary/10">
                       <Calendar size={10} className="text-brand-primary" />
                       <span className="text-[8px] font-black uppercase text-brand-primary">Até {new Date(g.endDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-lg border border-white/5">
                       {g.rankingType === 'workouts' ? <Trophy size={10} className="text-brand-secondary" /> : <Flame size={10} className="text-brand-secondary" />}
                       <span className="text-[8px] font-black uppercase text-muted">{g.rankingType === 'workouts' ? 'Treinos' : 'Frequência'}</span>
                    </div>
                 </div>
                <div className="flex items-center gap-3">
                   <div className="flex -space-x-2">
                      {g.memberIds.slice(0, 4).map((_, i) => (
                        <div key={i} className="w-6 h-6 rounded-full bg-white/10 border border-bg-base flex items-center justify-center text-[8px] font-black italic text-brand-primary">
                          {i === 3 ? `+${g.memberIds.length - 3}` : 'U'}
                        </div>
                      ))}
                   </div>
                   <span className="text-[10px] text-muted uppercase font-bold tracking-widest">{g.memberIds.length} membros</span>
                </div>
             </Card>
           ))}
        </div>
      ) : (
        <div className="text-center py-20 space-y-6">
           <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto text-gray-700">
              <Users size={40} />
           </div>
           <div className="space-y-2">
              <h3 className="text-lg font-black italic uppercase">Treinar em grupo é melhor.</h3>
              <p className="text-gray-500 text-sm px-8 leading-relaxed">Crie um grupo privado e convide seus amigos para comparar treinos e motivar uns aos outros.</p>
           </div>
           <div className="flex flex-col gap-3 px-6">
              <Button onClick={() => setShowCreate(true)}>Criar Grupo</Button>
              <Button variant="secondary" onClick={() => setShowJoin(true)}>Entrar com Código</Button>
           </div>
        </div>
      )}

      {/* MODALS */}
      <AnimatePresence>
        {showCreate && (
           <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm">
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm">
                 <Card className="space-y-6">
                    <div className="flex justify-between items-center">
                       <h2 className="text-xl font-black italic uppercase">Novo Grupo</h2>
                       <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-white"><X /></button>
                    </div>
                    <div className="space-y-4">
                       <div>
                          <label className="text-[10px] uppercase text-muted font-bold block mb-2 tracking-widest">Nome do Grupo</label>
                          <input 
                            autoFocus
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 h-14 px-4 rounded-xl outline-none focus:border-brand-primary text-white font-display text-lg"
                            placeholder="Ex: Monstros da City"
                          />
                       </div>
                       
                       <div className="grid grid-cols-2 gap-3">
                          <div>
                             <label className="text-[10px] uppercase text-muted font-bold block mb-2 tracking-widest">Início</label>
                             <input 
                               type="date"
                               value={newGroupStartDate}
                               onChange={(e) => setNewGroupStartDate(e.target.value)}
                               className="w-full bg-white/5 border border-white/10 h-12 px-4 rounded-xl outline-none focus:border-brand-primary text-white text-xs uppercase"
                             />
                          </div>
                          <div>
                             <label className="text-[10px] uppercase text-muted font-bold block mb-2 tracking-widest">Término</label>
                             <input 
                               type="date"
                               value={newGroupEndDate}
                               onChange={(e) => setNewGroupEndDate(e.target.value)}
                               className="w-full bg-white/5 border border-white/10 h-12 px-4 rounded-xl outline-none focus:border-brand-primary text-white text-xs uppercase"
                             />
                          </div>
                       </div>

                       <div>
                          <label className="text-[10px] uppercase text-muted font-bold block mb-2 tracking-widest">Modalidade do Ranking</label>
                          <div className="grid grid-cols-2 gap-2">
                             <button 
                               onClick={() => setNewGroupRankingType('workouts')}
                               className={`h-12 rounded-xl flex items-center justify-center gap-2 border transition-all ${newGroupRankingType === 'workouts' ? 'border-brand-primary bg-brand-primary/10 text-brand-primary' : 'border-white/5 bg-white/5 text-gray-500 hover:bg-white/10'}`}
                             >
                                <Trophy size={14} />
                                <span className="text-[10px] font-black uppercase tracking-widest text-center">Treinos Totais</span>
                             </button>
                             <button 
                               onClick={() => setNewGroupRankingType('frequency')}
                               className={`h-12 rounded-xl flex items-center justify-center gap-2 border transition-all ${newGroupRankingType === 'frequency' ? 'border-brand-primary bg-brand-primary/10 text-brand-primary' : 'border-white/5 bg-white/5 text-gray-500 hover:bg-white/10'}`}
                             >
                                <Calendar size={14} />
                                <span className="text-[10px] font-black uppercase tracking-widest text-center">Dias Diferentes</span>
                             </button>
                          </div>
                       </div>
                    </div>
                    <Button onClick={createGroup} className="w-full">Criar Desafio</Button>
                 </Card>
              </motion.div>
           </div>
        )}

        {showJoin && (
           <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm">
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm">
                 <Card className="space-y-6">
                    <div className="flex justify-between items-center">
                       <h2 className="text-xl font-black italic uppercase">Entrar no Grupo</h2>
                       <button onClick={() => setShowJoin(false)} className="text-gray-500 hover:text-white"><X /></button>
                    </div>
                    <div>
                       <label className="text-[10px] uppercase text-muted font-bold block mb-2 tracking-widest">Código de Convite</label>
                       <input 
                         autoFocus
                         value={inviteCode}
                         onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                         className="w-full bg-white/5 border border-white/10 h-14 px-4 rounded-xl outline-none focus:border-brand-primary text-white font-display text-2xl text-center tracking-[0.5em]"
                         placeholder="XXXXXX"
                         maxLength={6}
                       />
                    </div>
                    <Button onClick={joinGroup} className="w-full">Entrar Agora</Button>
                 </Card>
              </motion.div>
           </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function GroupDetailsView({ group, onBack, currentUser }: { group: Group, onBack: () => void, currentUser: FirebaseUser }) {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [challengeStats, setChallengeStats] = useState<Record<string, number>>({});
  const [showConfig, setShowConfig] = useState(false);
  const [sDate, setSDate] = useState(group.startDate ? new Date(group.startDate).toISOString().split('T')[0] : '');
  const [eDate, setEDate] = useState(group.endDate ? new Date(group.endDate).toISOString().split('T')[0] : '');

  // Prevenir crash se as datas estiverem faltando (grupos antigos)
  useEffect(() => {
    if (!sDate && group.startDate) setSDate(new Date(group.startDate).toISOString().split('T')[0]);
    if (!eDate && group.endDate) setEDate(new Date(group.endDate).toISOString().split('T')[0]);
  }, [group.startDate, group.endDate]);

  useEffect(() => {
    setLoading(true);
    // Fetch user profiles for all members
    const q = query(collection(db, 'users'), where('uid', 'in', group.memberIds));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => d.data());
      setMembers(data);
      setLoading(false);
    });
    return () => unsub();
  }, [group.id, group.memberIds.join(',')]);

  const leaveGroup = async () => {
    try {
      await updateDoc(doc(db, 'groups', group.id), {
        memberIds: arrayRemove(currentUser.uid)
      });
      onBack();
    } catch (err) {
      console.error(err);
      alert("Erro ao sair do grupo.");
    }
  };

  useEffect(() => {
    if (!group.startDate || !group.endDate || members.length === 0) return;
    
    const fetchChallengeStats = async () => {
      const stats: Record<string, number> = {};
      try {
        await Promise.all(members.map(async (m) => {
          const q = query(
            collection(db, 'users', m.uid, 'sessions'),
            where('isCompleted', '==', true),
            where('date', '>=', group.startDate!),
            where('date', '<=', group.endDate!)
          );
          const snap = await getDocs(q);
          
          if (group.rankingType === 'frequency') {
            // Count distinct days
            const days = new Set();
            snap.docs.forEach(doc => {
              const d = new Date(doc.data().date);
              days.add(d.toDateString());
            });
            stats[m.uid] = days.size;
          } else {
            // Count total workouts
            stats[m.uid] = snap.size;
          }
        }));
        setChallengeStats(stats);
      } catch (e) { console.error(e); }
    };
    fetchChallengeStats();
  }, [group.id, group.startDate, group.endDate, members.length, group.rankingType]);

  const sortedMembers = [...members].sort((a, b) => {
    if (group.startDate && group.endDate) {
      return (challengeStats[b.uid] || 0) - (challengeStats[a.uid] || 0);
    }
    return (b.totalWorkouts || 0) - (a.totalWorkouts || 0);
  });

  const updateChallenge = async () => {
    if (!sDate || !eDate) return;
    try {
      await updateDoc(doc(db, 'groups', group.id), {
        startDate: new Date(sDate + 'T00:00:00').getTime(),
        endDate: new Date(eDate + 'T23:59:59').getTime()
      });
      setShowConfig(false);
    } catch (e) {
      alert("Erro ao salvar desafio.");
    }
  };

  const copyInvite = () => {
    navigator.clipboard.writeText(group.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="py-4 space-y-6">
      <header className="space-y-4">
        <div className="flex justify-between items-center">
           <Button variant="ghost" size="icon" onClick={onBack} className="w-10 h-10"><ChevronLeft /></Button>
           <div className="flex gap-2">
              <button 
                onClick={copyInvite}
                className={`h-10 px-4 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${copied ? 'bg-green-500 text-black' : 'bg-white/5 text-muted border border-white/10 hover:bg-white/10'}`}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copiado!' : group.inviteCode}
              </button>
              <Button variant="danger" size="icon" onClick={leaveGroup} className="w-10 h-10 border-none bg-transparent hover:bg-red-500/10"><LogOut size={18} /></Button>
               {currentUser.uid === group.creatorId && (
                 <Button variant="ghost" size="icon" onClick={() => setShowConfig(!showConfig)} className="ml-2 w-10 h-10 bg-white/5 border border-white/10"><Calendar size={18} className="text-brand-primary" /></Button>
               )}
           </div>
        </div>
        <div>
           <h1 className="text-3xl font-black italic uppercase leading-none">{group.name}</h1>
           {group.startDate && group.endDate ? (
             <div className="mt-3 space-y-2">
               <div className="flex items-center gap-2 bg-brand-primary/10 border border-brand-primary/20 p-2 rounded-xl">
                 <Calendar size={14} className="text-brand-primary" />
                 <p className="text-[10px] font-black uppercase tracking-wider text-brand-primary">
                   Período: {new Date(group.startDate).toLocaleDateString()} - {new Date(group.endDate).toLocaleDateString()}
                 </p>
               </div>
               <div className="flex items-center gap-2 bg-white/5 border border-white/10 p-2 rounded-xl">
                 {group.rankingType === 'workouts' ? <Trophy size={14} className="text-brand-secondary" /> : <Flame size={14} className="text-brand-secondary" />}
                 <p className="text-[10px] font-black uppercase tracking-wider text-muted">
                   Modalidade: {group.rankingType === 'workouts' ? 'Máximo de Treinos' : 'Dias Treinados (Frequência)'}
                 </p>
               </div>
             </div>
           ) : (
             <p className="text-[10px] text-muted font-bold uppercase tracking-[0.2em] mt-2">Leaderboard do Grupo</p>
           )}
        </div>
      </header>

      {showConfig && (
        <Card className="bg-brand-secondary/50 border-brand-primary/20 animate-in fade-in slide-in-from-top-4">
          <h3 className="font-black italic uppercase text-sm mb-4">Configurar Desafio</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-muted">Início</label>
                <input 
                  type="date" 
                  value={sDate}
                  onChange={e => setSDate(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-brand-primary outline-none transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-muted">Fim</label>
                <input 
                  type="date" 
                  value={eDate}
                  onChange={e => setEDate(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-brand-primary outline-none transition-all"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1 text-[10px] font-black uppercase" onClick={updateChallenge}>Ativar Desafio</Button>
              <Button variant="ghost" className="text-[10px] font-black uppercase" onClick={() => setShowConfig(false)}>Cancelar</Button>
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Dumbbell className="animate-spin text-brand-primary w-8 h-8" />
        </div>
      ) : (
        <div className="space-y-3">
           {sortedMembers.map((member, idx) => (
             <Card 
               key={member.uid} 
               className={`flex items-center gap-4 transition-all ${member.uid === currentUser.uid ? 'border-brand-primary bg-brand-primary/5 shadow-[0_0_20px_rgba(255,94,26,0.05)]' : 'border-white/5 opacity-80'}`}
             >
                <div className="w-6 text-center font-black italic text-gray-700">
                   #{idx + 1}
                </div>
                <img 
                  src={member.photoURL || `https://picsum.photos/seed/${member.uid}/100/100`} 
                  alt="" 
                  className={`w-10 h-10 rounded-xl border ${member.uid === currentUser.uid ? 'border-brand-primary' : 'border-white/10'}`} 
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1 min-w-0">
                   <div className="flex items-center gap-1.5">
                      <h4 className="font-bold text-sm truncate uppercase tracking-tight">{member.displayName}</h4>
                      {member.uid === group.creatorId && <div className="p-0.5" title="Criador do Grupo"><Trophy size={10} className="text-yellow-500" /></div>}
                   </div>
                   <div className="flex items-center gap-2">
                      <p className="text-[10px] text-brand-primary font-bold uppercase">
                        {group.rankingType === 'frequency' ? 'Frequência Base' : 'Treinos Realizados'}
                      </p>
                   </div>
                </div>
                <div className="text-right shrink-0">
                   <div className="flex flex-col items-end">
                      <p className="text-[14px] text-brand-primary font-black uppercase leading-none tracking-tighter">
                        { (group.startDate && group.endDate) ? (challengeStats[member.uid] || 0) : (member.totalWorkouts || 0) } <span className="text-[8px] opacity-70">pts</span>
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        <Flame size={10} className={member.uid === currentUser.uid ? 'text-brand-primary' : 'text-gray-700'} />
                        <p className="text-[8px] text-gray-500 font-black uppercase tracking-tighter">{member.streak || 0}d</p>
                      </div>
                   </div>
                </div>
             </Card>
           ))}
        </div>
      )}
    </motion.div>
  );
}

// --- View: Exercises (Library) ---

function ExerciciosView() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExGroup, setNewExGroup] = useState('Peito');

  useEffect(() => {
    loadExercises();
  }, []);

  async function loadExercises() {
    try {
      const snap = await getDocs(getCollectionRef('exercises'));
      const custom = snap.docs.map(d => d.data() as Exercise);
      // Sort by name
      const sorted = custom.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setExercises(sorted);
    } catch (err) {
      console.error("Error loading exercises:", err);
      // No fallback to local since we seed cloud
      setExercises([]);
    }
  }

  const createCustom = async () => {
    if (!newExName.trim()) return;
    const newEx: Exercise = {
      id: crypto.randomUUID(),
      name: newExName.trim(),
      muscleGroup: newExGroup,
      isCustom: true
    };
    await saveToCloud('exercises', newEx);
    await loadExercises();
    setIsAddingCustom(false);
    setNewExName('');
  };

  const groups = ['Todos', 'Peito', 'Costas', 'Pernas', 'Ombros', 'Braços', 'Core'];

  const filtered = exercises.filter(ex => {
    const matchesSearch = (ex.name || '').toLowerCase().includes((search || '').toLowerCase());
    const matchesFilter = filter === 'Todos' || ex.muscleGroup === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="py-4 space-y-6"
    >
      <header className="space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl italic">Biblioteca</h1>
          <Button size="sm" variant="secondary" onClick={() => setIsAddingCustom(true)}>+ Novo</Button>
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
          <input 
            type="text"
            placeholder="Buscar exercício..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-bg-card border border-white/5 h-14 pl-12 pr-4 rounded-2xl outline-none focus:border-brand-primary transition-all text-white"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-2 -mx-4 px-4">
           {groups.map(g => (
             <button 
               key={g} 
               onClick={() => setFilter(g)}
               className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest border transition-all ${filter === g ? 'bg-brand-primary text-black border-brand-primary' : 'bg-transparent text-gray-400 border-white/10'}`}
             >
               {g}
             </button>
           ))}
        </div>
      </header>

      <div className="space-y-2">
         {filtered.map(ex => (
           <Card key={ex.id} className="flex items-center justify-between">
              <div>
                 <h4 className="font-bold text-sm tracking-tight">{ex.name}</h4>
                 <p className="text-[10px] uppercase text-muted font-bold tracking-widest">{ex.muscleGroup}</p>
              </div>
              {ex.isCustom && <Badge variant="secondary">Personalizado</Badge>}
           </Card>
         ))}
      </div>

      <AnimatePresence>
        {isAddingCustom && (
          <div className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-6 backdrop-blur-sm">
             <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: 20 }}
               className="w-full max-w-md bg-bg-card border border-white/10 p-8 rounded-[32px] space-y-6 shadow-2xl"
             >
                <div className="flex justify-between items-center">
                   <h2 className="text-xl italic font-black uppercase text-brand-primary font-display">Novo Exercício</h2>
                   <button onClick={() => setIsAddingCustom(false)} className="text-gray-500 hover:text-white"><X /></button>
                </div>

                <div className="space-y-4">
                   <div>
                      <label className="text-[10px] uppercase text-muted font-bold block mb-1 tracking-widest">Nome do Exercício</label>
                      <input 
                        value={newExName}
                        onChange={(e) => setNewExName(e.target.value)}
                        autoFocus
                        className="w-full bg-black/40 border border-white/10 rounded-xl h-12 px-4 focus:border-brand-primary outline-none text-white font-bold"
                        placeholder="Ex: Rosca Martelo Alternada"
                      />
                   </div>

                   <div>
                      <label className="text-[10px] uppercase text-muted font-bold block mb-1 tracking-widest">Grupo Muscular Principal</label>
                      <select 
                        value={newExGroup}
                        onChange={(e) => setNewExGroup(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl h-12 px-4 focus:border-brand-primary outline-none text-white text-sm appearance-none"
                      >
                         {['Peito', 'Costas', 'Pernas', 'Ombros', 'Braços', 'Core', 'Cardio'].map(g => (
                           <option key={g} value={g}>{g}</option>
                         ))}
                      </select>
                   </div>

                   <div className="flex gap-3 pt-4">
                      <Button variant="ghost" className="flex-1" onClick={() => setIsAddingCustom(false)}>Cancelar</Button>
                      <Button className="flex-1" onClick={createCustom}>Cadastrar</Button>
                   </div>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// --- View: Progresso (More Detailed Charts) ---

function ProgressoView() {
   const [weightHistory, setWeightHistory] = useState<any[]>([]);
   const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([]);
   const [newWeight, setNewWeight] = useState('');
   const [isLogging, setIsLogging] = useState(false);

   useEffect(() => {
      const unsubWeight = onSnapshot(query(getCollectionRef('weight_history'), orderBy('date')), (snap) => {
         setWeightHistory(snap.docs.map(d => d.data()));
      });
      
      const unsubPRs = onSnapshot(query(getCollectionRef('personal_records'), orderBy('exerciseName')), (snap) => {
         setPersonalRecords(snap.docs.map(d => d.data() as PersonalRecord));
      });

      return () => {
        unsubWeight();
        unsubPRs();
      };
   }, []);

   const handleLogWeight = async () => {
      const w = parseFloat(newWeight);
      if (isNaN(w) || w <= 0 || !auth.currentUser) return;
      try {
         await logWeight(auth.currentUser.uid, w);
         setNewWeight('');
         setIsLogging(false);
      } catch (err) {
         console.error(err);
      }
   };

   return (
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="py-4 space-y-8"
      >
         <header>
           <h1 className="text-3xl italic text-brand-primary">Evolução</h1>
           <p className="text-gray-500 text-sm uppercase font-bold">Records & Marcas</p>
         </header>

         <section className="space-y-4">
            <div className="flex items-center gap-2 text-white/50 mb-2">
               <Trophy size={20} className="text-yellow-500" />
               <h2 className="text-lg italic uppercase">Recordes Pessoais</h2>
            </div>
            
            {personalRecords.length > 0 ? (
              <div className="grid grid-cols-1 gap-3">
                {personalRecords.map(pr => (
                  <Card key={pr.exerciseId} className="flex items-center justify-between py-4 px-5 border-l-4 border-l-yellow-500/50">
                    <div>
                      <h4 className="font-bold text-sm tracking-tight text-white/90">{pr.exerciseName}</h4>
                      <p className="text-[10px] text-muted uppercase font-bold tracking-widest mt-0.5">{format(pr.date, 'dd MMM yyyy', { locale: ptBR })}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-brand-primary text-xl font-black italic tabular-nums leading-none">
                        {pr.weight}
                        <span className="text-[10px] ml-0.5 not-italic text-muted">KG</span>
                      </div>
                      <p className="text-[10px] text-muted font-bold tracking-widest leading-none mt-1">{pr.reps} REPS</p>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="text-center py-8">
                <Trophy className="w-10 h-10 text-gray-700 mx-auto mb-2 opacity-20" />
                <p className="text-xs text-muted italic">Complete treinos para registrar seus recordes.</p>
              </Card>
            )}
         </section>

         <section className="space-y-4">
            <div className="flex justify-between items-center mb-2">
               <div className="flex items-center gap-2 text-white/50">
                  <Activity size={20} className="text-brand-primary" />
                  <h2 className="text-lg italic uppercase">Peso Corporal</h2>
               </div>
               
               <div className="flex gap-2">
                  {isLogging ? (
                     <div className="flex gap-2 items-center bg-white/5 p-1 rounded-xl border border-white/10">
                        <input 
                           type="number" 
                           placeholder="75.5" 
                           value={newWeight}
                           onChange={(e) => setNewWeight(e.target.value)}
                           className="w-16 bg-transparent text-sm text-center outline-none text-brand-primary font-bold"
                           autoFocus
                        />
                        <button onClick={handleLogWeight} className="bg-brand-primary text-black p-1.5 rounded-lg active:scale-95 transition-all"><Check size={14} /></button>
                        <button onClick={() => setIsLogging(false)} className="text-gray-500 p-1.5"><X size={14} /></button>
                     </div>
                  ) : (
                     <Button variant="secondary" size="sm" onClick={() => setIsLogging(true)}>+ Registrar</Button>
                  )}
               </div>
            </div>

            <Card className="h-64 text-[10px] pt-6 relative overflow-hidden">
               <div className="absolute top-4 left-4 flex gap-4 text-[10px] text-muted font-bold uppercase tracking-widest z-10">
                  <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-brand-primary" /> Peso (kg)</div>
               </div>
               {weightHistory.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                     <LineChart data={weightHistory.map(w => ({ d: format(w.date, 'dd/MM'), w: w.weight })).slice(-15)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="d" stroke="#4a4a4a" tick={{ fill: '#8E8E93' }} />
                        <YAxis domain={['dataMin - 2', 'dataMax + 2']} stroke="#4a4a4a" tick={{ fill: '#8E8E93' }} />
                        <Tooltip 
                           contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                           labelStyle={{ color: '#8E8E93' }}
                           itemStyle={{ color: '#FF5E1A' }}
                        />
                        <Line type="monotone" dataKey="w" stroke="#FF5E1A" strokeWidth={4} dot={{ fill: '#FF5E1A', r: 4, strokeWidth: 0 }} activeDot={{ r: 6, stroke: '#1A1A1A', strokeWidth: 2 }} />
                     </LineChart>
                  </ResponsiveContainer>
               ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted space-y-4">
                     <p className="italic">Nenhum registro de peso encontrado.</p>
                     <p className="text-[10px] uppercase font-bold text-gray-700">Comece registrando seu peso hoje!</p>
                  </div>
               )}
            </Card>
         </section>
      </motion.div>
   );
}
