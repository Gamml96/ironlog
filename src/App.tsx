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
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, subDays, startOfWeek, endOfWeek, isToday, isYesterday, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import confetti from 'canvas-confetti';

import { 
  initDB, 
  seedDatabase, 
  WorkoutPlan, 
  WorkoutSession, 
  Exercise, 
  WorkoutPlanExercise,
  ExerciseLog,
  SetLog,
  DEFAULT_EXERCISES
} from './lib/db';

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
  const [activeTab, setActiveTab] = useState<'hoje' | 'treinos' | 'progresso' | 'exercicios' | 'stats' | 'config'>('hoje');
  const [dbReady, setDbReady] = useState(false);
  const [activeWorkout, setActiveWorkout] = useState<WorkoutSession | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    seedDatabase().then(() => setDbReady(true));
  }, []);

  if (!dbReady) return (
    <div className="flex flex-col items-center justify-center h-screen bg-bg-base">
      <Dumbbell className="w-12 h-12 text-brand-primary animate-pulse mb-4" />
      <h1 className="text-2xl font-display text-white italic">Carregando IronLog...</h1>
    </div>
  );

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto relative overflow-hidden bg-bg-base">
      <main className="flex-1 overflow-y-auto pb-32 pt-safe px-4">
        <AnimatePresence mode="wait">
          {activeTab === 'hoje' && <HojeView key={refreshKey} onStartWorkout={(w) => setActiveWorkout(w)} onSetActiveTab={setActiveTab} />}
          {activeTab === 'treinos' && <TreinosView />}
          {activeTab === 'progresso' && <ProgressoView />}
          {activeTab === 'exercicios' && <ExerciciosView />}
          {activeTab === 'stats' && <StatsView />}
          {activeTab === 'config' && <SettingsView onBack={() => setActiveTab('hoje')} />}
        </AnimatePresence>
      </main>

      {/* Persistent Active Workout Bar */}
      {activeWorkout && (
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-20 left-4 right-4 z-50 pointer-events-none"
        >
          <div 
            onClick={() => setActiveWorkout(activeWorkout)} // Open Fullscreen Workout (TODO)
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
        <div className="flex items-center justify-around h-20 max-w-md mx-auto">
          <NavButton icon={<LayoutDashboard />} label="Hoje" active={activeTab === 'hoje'} onClick={() => setActiveTab('hoje')} />
          <NavButton icon={<Dumbbell />} label="Treinos" active={activeTab === 'treinos'} onClick={() => setActiveTab('treinos')} />
          <NavButton icon={<TrendingUp />} label="Evolução" active={activeTab === 'progresso'} onClick={() => setActiveTab('progresso')} />
          <NavButton icon={<Library />} label="Biblioteca" active={activeTab === 'exercicios'} onClick={() => setActiveTab('exercicios')} />
          <NavButton icon={<History />} label="Estatísticas" active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} />
        </div>
      </nav>

      {/* Workout Session Modal (if active) */}
      {activeWorkout && (
        <ActiveWorkoutOverlay 
          session={activeWorkout} 
          onClose={() => setActiveWorkout(null)} 
          onSave={async (w) => {
             const db = await initDB();
             await db.put('sessions', w);
             setActiveWorkout(null);
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

// --- View: Hoje (Main Dashboard) ---

function HojeView({ onStartWorkout, onSetActiveTab }: { onStartWorkout: (w: WorkoutSession) => void, onSetActiveTab: (v: any) => void, key?: React.Key }) {
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([]);
  const [streak, setStreak] = useState(0);
  const [weeklyGoal, setWeeklyGoal] = useState(5);
  const [completedThisWeek, setCompletedThisWeek] = useState(0);

  async function load() {
    const db = await initDB();
    const allPlans = await db.getAll('plans');
    const allSessions = await db.getAllFromIndex('sessions', 'by-date');
    const settings = await db.get('settings', 'user-settings');
    
    setPlans(allPlans.sort((a,b) => a.order - b.order));
    setRecentSessions(allSessions.slice(-3).reverse());
    
    if (settings?.weeklyGoal) {
      setWeeklyGoal(settings.weeklyGoal);
    }

    // Calculate Weekly Progress (Unique days in current week)
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
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

    // Calculate Streak
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
          
          if (diff <= 1.5) { // Allowance for slight variations
            currentStreak++;
          } else {
            break;
          }
        }
        setStreak(currentStreak);
      } else {
        setStreak(0);
      }
    }
  }

  useEffect(() => {
    load();
  }, []);

  const skipWorkout = async (plan: WorkoutPlan) => {
    if (plans.length < 2) return;
    
    const db = await initDB();
    const tx = db.transaction('plans', 'readwrite');
    const store = tx.objectStore('plans');
    
    // Current plan goes to the end
    // Shift others forward
    const remainingPlans = plans.filter(p => p.id !== plan.id);
    const reordered: WorkoutPlan[] = [...remainingPlans, plan];
    
    for (let i = 0; i < reordered.length; i++) {
      reordered[i].order = i;
      await store.put(reordered[i]);
    }
    
    await tx.done;
    await load();
    
    confetti({
      particleCount: 40,
      spread: 20,
      origin: { y: 0.8 },
      colors: ['#8E8E93']
    });
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

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6 py-4"
    >
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl italic font-black text-brand-primary">IronLog</h1>
          <p className="text-muted text-[10px] uppercase font-bold tracking-[0.1em]">{format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
        </div>
        <div className="flex items-center gap-3">
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
          <Card onClick={() => startEmptyWorkout(plans[0])} borderAccent className="relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-active:opacity-10 transition-opacity">
               <Dumbbell size={100} />
            </div>
            <h3 className="text-3xl italic font-black mb-1">{plans[0].name}</h3>
            <div className="flex items-center gap-2 mb-6">
              <span className="text-muted text-xs font-bold uppercase tracking-wider">{plans[0].exercises.length} Exercícios</span>
              <div className="w-1 h-1 bg-muted/40 rounded-full" />
              <span className="text-muted text-xs font-bold uppercase tracking-wider">~45 min</span>
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
        <h2 className="text-lg">Atividade Recente</h2>
        {recentSessions.length > 0 ? (
          recentSessions.map(session => (
            <Card key={session.id} className="flex items-center gap-4">
               <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-brand-primary">
                 <History size={24} />
               </div>
               <div className="flex-1">
                  <div className="flex justify-between items-start">
                     <h4 className="font-bold text-sm">{session.workoutPlanName}</h4>
                     <span className="text-[10px] text-gray-500 uppercase">{isToday(session.date) ? 'Hoje' : isYesterday(session.date) ? 'Ontem' : format(session.date, 'dd/MM')}</span>
                  </div>
                  <p className="text-xs text-gray-500">Volume: {session.totalVolume}kg • {session.exercises.length} ex.</p>
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
    loadPlans();
  }, []);

  async function loadPlans() {
    const db = await initDB();
    const all = await db.getAll('plans');
    setPlans(all.sort((a,b) => a.order - b.order));
  }

  const createPlan = async () => {
    const newPlan: WorkoutPlan = {
      id: crypto.randomUUID(),
      name: 'Novo Treino ' + String.fromCharCode(65 + plans.length),
      exercises: [],
      order: plans.length
    };
    const db = await initDB();
    await db.put('plans', newPlan);
    loadPlans();
    setIsEditing(newPlan);
  };

  const deletePlan = async (id: string) => {
    const db = await initDB();
    await db.delete('plans', id);
    loadPlans();
  };

  if (isEditing) {
    return <EditPlanView plan={isEditing} onSave={(p) => { setIsEditing(null); loadPlans(); }} onCancel={() => setIsEditing(null)} />;
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
            <div className="flex flex-wrap gap-2 text-xs text-gray-500">
               {plan.exercises.length > 0 ? (
                 plan.exercises.slice(0, 3).map((ex, i) => (
                   <span key={i} className="bg-white/5 px-2 py-1 rounded">{i === 2 && plan.exercises.length > 3 ? '...' : 'Exercício ' + (i+1)}</span>
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
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExGroup, setNewExGroup] = useState('Peito');
  const [defaultRest, setDefaultRest] = useState(60);

  useEffect(() => {
    loadExercises();
    loadSettings();
  }, []);

  async function loadSettings() {
    const db = await initDB();
    const settings = await db.get('settings', 'user-settings');
    if (settings?.defaultRestTime) {
      setDefaultRest(settings.defaultRestTime);
    }
  }

  async function loadExercises() {
    const db = await initDB();
    const all = await db.getAll('exercises');
    setExercises(all);
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
    const db = await initDB();
    await db.put('exercises', newEx);
    await loadExercises();
    addExercise(newEx);
    setIsAddingCustom(false);
    setNewExName('');
  };

  const filteredExercises = exercises.filter(ex => 
    ex.name.toLowerCase().includes(exSearch.toLowerCase()) ||
    ex.muscleGroup.toLowerCase().includes(exSearch.toLowerCase())
  );

  const removeExercise = (idx: number) => {
    setEditedPlan(prev => ({
      ...prev,
      exercises: prev.exercises.filter((_, i) => i !== idx)
    }));
  };

  const persist = async () => {
    const db = await initDB();
    await db.put('plans', editedPlan);
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
                          <input 
                            type="text"
                            value={ex.targetReps}
                            onChange={(e) => {
                              const newExs = [...editedPlan.exercises];
                              newExs[idx].targetReps = e.target.value;
                              setEditedPlan({...editedPlan, exercises: newExs});
                            }}
                            className="w-14 h-8 bg-white/5 border border-white/10 rounded text-center text-xs text-white"
                          />
                          <span className="text-[9px] uppercase font-bold text-gray-500">reps</span>
                        </div>

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

function ActiveWorkoutOverlay({ session, onClose, onSave }: { session: WorkoutSession, onClose: () => void, onSave: (w: WorkoutSession) => void }) {
  const [currentSession, setCurrentSession] = useState<WorkoutSession>(JSON.parse(JSON.stringify(session)));
  const [previousData, setPreviousData] = useState<Record<string, ExerciseLog | null>>({});
  const [exerciseDetails, setExerciseDetails] = useState<Record<string, Exercise>>({});
  const [startTime] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [restTime, setRestTime] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);
  const [showIncompleteWarning, setShowIncompleteWarning] = useState(false);

  useEffect(() => {
    async function loadData() {
      const db = await initDB();
      
      // Load exercise details
      const allExercises = await db.getAll('exercises');
      const exMap: Record<string, Exercise> = {};
      allExercises.forEach(ex => exMap[ex.id] = ex);
      setExerciseDetails(exMap);

      const allSessions = await db.getAllFromIndex('sessions', 'by-date');
      const latestData: Record<string, ExerciseLog | null> = {};
      
      for (const ex of currentSession.exercises) {
        // Find most recent session that included this exercise
        const prevSession = allSessions.reverse().find(s => 
          s.id !== currentSession.id && s.exercises.some(e => e.exerciseId === ex.exerciseId)
        );
        latestData[ex.exerciseId] = prevSession?.exercises.find(e => e.exerciseId === ex.exerciseId) || null;
      }
      setPreviousData(latestData);
    }
    loadData();
  }, [currentSession.id]);

  useEffect(() => {
    const itv = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(itv);
  }, [startTime]);

  useEffect(() => {
    if (restTime > 0) {
      const itv = setInterval(() => {
        setRestTime(prev => {
          if (prev <= 1) {
            if (window.navigator.vibrate) window.navigator.vibrate([200, 100, 200]);
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

  const updateSet = (exIdx: number, setIdx: number, field: 'weight' | 'reps', value: number) => {
    const newSession = { ...currentSession };
    newSession.exercises[exIdx].sets[setIdx][field] = value;
    setCurrentSession(newSession);
  };

  const finishWorkout = () => {
    const totalVol = currentSession.exercises.reduce((acc, ex) => {
      return acc + ex.sets.reduce((sAcc, s) => s.completed ? sAcc + (s.weight * s.reps) : sAcc, 0);
    }, 0);
    
    onSave({
      ...currentSession,
      totalVolume: totalVol,
      duration: elapsed,
      isCompleted: true,
      date: Date.now()
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
         <Button variant="ghost" size="sm" onClick={onClose} className="text-muted border border-white/10 h-10 px-4">Sair</Button>
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
                 <span>Meta: {ex.sets.length} SxR</span>
                 <div className="w-1 h-1 bg-muted/40 rounded-full mt-1.5" />
                 <span>{detail?.muscleGroup || 'Muscle'}</span>
               </div>

               {/* Last session summary */}
               {previousData[ex.exerciseId] ? (
                 <div className="bg-brand-primary/5 border border-dashed border-brand-primary/30 p-4 rounded-xl text-[10px] text-gray-400 flex flex-col gap-2 mb-8">
                    <div className="flex flex-col gap-1">
                       <span className="uppercase font-black text-brand-primary tracking-widest">Última sessão:</span>
                       <span className="text-white font-medium text-xs">
                          {previousData[ex.exerciseId]?.sets.map(s => `${s.weight}kg x ${s.reps}`).join(' | ')}
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
                    <div className="text-center">Peso kg</div>
                    <div className="text-center">Reps</div>
                    <div></div>
                  </div>
                  {ex.sets.map((set, setIdx) => (
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
                           inputMode="numeric"
                           value={set.reps || ''}
                           onChange={(e) => updateSet(exIdx, setIdx, 'reps', parseInt(e.target.value))}
                           className="w-full h-12 bg-transparent border-none rounded-lg text-center text-xl font-display font-black text-white focus:ring-0"
                           placeholder="--"
                         />
                       </div>
                       <button 
                         onClick={() => toggleSet(exIdx, setIdx)}
                         className={`h-10 w-10 flex items-center justify-center rounded-full transition-all border-2 ${set.completed ? 'bg-brand-secondary border-brand-secondary text-black' : 'bg-transparent border-muted/20 text-muted'}`}
                       >
                         {set.completed ? <CheckCircle2 size={24} strokeWidth={3} /> : <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                       </button>
                    </div>
                  ))}
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

function SettingsView({ onBack }: { onBack: () => void }) {
  const [defaultRest, setDefaultRest] = useState(60);
  const [weeklyGoal, setWeeklyGoal] = useState(5);

  useEffect(() => {
    async function load() {
      const db = await initDB();
      const settings = await db.get('settings', 'user-settings');
      if (settings?.defaultRestTime) {
        setDefaultRest(settings.defaultRestTime);
      }
      if (settings?.weeklyGoal) {
        setWeeklyGoal(settings.weeklyGoal);
      }
    }
    load();
  }, []);

  const saveSettings = async (updates: any) => {
    const db = await initDB();
    const current = await db.get('settings', 'user-settings') || { id: 'user-settings' };
    const newData = { ...current, ...updates };
    await db.put('settings', newData);
    
    if (updates.defaultRestTime !== undefined) setDefaultRest(updates.defaultRestTime);
    if (updates.weeklyGoal !== undefined) setWeeklyGoal(updates.weeklyGoal);
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
        <h1 className="text-3xl italic font-black uppercase">Configurações</h1>
      </header>

      <section className="space-y-6">
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

        <Card className="border-dashed border-white/10 opacity-50">
           <p className="text-[10px] uppercase font-bold text-center py-4 tracking-widest">Mais configurações em breve...</p>
        </Card>
      </section>

      <div className="pt-10 text-center">
         <p className="text-[10px] text-muted uppercase font-bold tracking-widest">IronLog v1.2.0 • Build 2026</p>
      </div>
    </motion.div>
  );
}

function StatsView() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);

  useEffect(() => {
    async function load() {
      const db = await initDB();
      const allS = await db.getAll('sessions');
      const allE = await db.getAll('exercises');
      setSessions(allS.sort((a,b) => a.date - b.date));
      setExercises(allE);
    }
    load();
  }, []);

  const dataLines = sessions.map(s => ({
    date: format(s.date, 'dd/MM'),
    volume: s.totalVolume
  })).slice(-10);

  // Calculate Muscle Distribution
  const muscleCount: Record<string, number> = {};
  let totalSets = 0;

  // Filter sessions from last 30 days for distribution
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const recentSessions = sessions.filter(s => s.date >= thirtyDaysAgo);

  recentSessions.forEach(s => {
    s.exercises.forEach(exLog => {
      const exDetail = exercises.find(e => e.id === exLog.exerciseId);
      if (exDetail) {
        const completedSets = exLog.sets.filter(st => st.completed).length;
        muscleCount[exDetail.muscleGroup] = (muscleCount[exDetail.muscleGroup] || 0) + completedSets;
        totalSets += completedSets;
      }
    });
  });

  const muscleStats = Object.entries(muscleCount)
    .map(([m, count]) => ({
      m,
      p: totalSets > 0 ? Math.round((count / totalSets) * 100) : 0
    }))
    .sort((a, b) => b.p - a.p);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="py-4 space-y-6"
    >
      <header>
        <h1 className="text-3xl italic">Estatísticas</h1>
        <p className="text-gray-500 text-sm italic uppercase tracking-widest font-bold">Resumo Geral</p>
      </header>

      <div className="grid grid-cols-2 gap-4">
        <Card className="flex flex-col items-center">
           <p className="text-[10px] text-gray-500 uppercase font-black mb-1">Total Treinos</p>
           <span className="text-3xl font-display leading-none">{sessions.length}</span>
        </Card>
        <Card className="flex flex-col items-center">
           <p className="text-[10px] text-gray-500 uppercase font-black mb-1">Carga Total (KG)</p>
           <span className="text-3xl font-display leading-none text-brand-primary">{Math.round(sessions.reduce((a,b) => a + b.totalVolume, 0) / 1000)}k</span>
        </Card>
      </div>

      <section className="space-y-3">
         <h2 className="text-lg italic">Volume por Sessão</h2>
         <Card className="h-64 pt-6 text-[10px]">
            {dataLines.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataLines}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                   <XAxis dataKey="date" stroke="#4a4a4a" tick={{ fill: '#8E8E93' }} />
                   <YAxis stroke="#4a4a4a" tick={{ fill: '#8E8E93' }} />
                   <Tooltip 
                     contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                     cursor={{ fill: 'rgba(255,94,26,0.1)' }}
                   />
                   <Bar dataKey="volume" fill="#FF5E1A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted italic">Aguardando dados...</div>
            )}
         </Card>
      </section>

      <section className="space-y-3">
         <div className="flex items-center justify-between">
            <h2 className="text-lg italic">Músculos Ativos</h2>
            <Badge variant="secondary">Últimos 30 Dias</Badge>
         </div>
         <div className="grid grid-cols-2 gap-2">
            {muscleStats.length > 0 ? muscleStats.map(item => (
              <div key={item.m} className="bg-bg-card p-4 rounded-2xl flex flex-col gap-2 border border-white/5">
                 <div className="flex justify-between text-[10px] uppercase font-bold tracking-widest text-gray-500">
                    <span>{item.m}</span>
                    <span>{item.p}%</span>
                 </div>
                 <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-primary rounded-full transition-all duration-1000" style={{ width: `${item.p}%` }} />
                 </div>
              </div>
            )) : (
              <p className="col-span-2 text-center text-muted italic text-sm py-4">Inicie um treino para ver a distribuição.</p>
            )}
         </div>
      </section>
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
    const db = await initDB();
    const all = await db.getAll('exercises');
    setExercises(all);
  }

  const createCustom = async () => {
    if (!newExName.trim()) return;
    const newEx: Exercise = {
      id: crypto.randomUUID(),
      name: newExName.trim(),
      muscleGroup: newExGroup,
      isCustom: true
    };
    const db = await initDB();
    await db.put('exercises', newEx);
    await loadExercises();
    setIsAddingCustom(false);
    setNewExName('');
  };

  const groups = ['Todos', 'Peito', 'Costas', 'Pernas', 'Ombros', 'Braços', 'Core'];

  const filtered = exercises.filter(ex => {
    const matchesSearch = ex.name.toLowerCase().includes(search.toLowerCase());
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
               <h2 className="text-lg italic uppercase">Recordes Recentes</h2>
            </div>
            <div className="space-y-3">
               {[
                  { name: 'Supino Reto', val: '80kg', date: 'Há 2 dias', diff: '+2.5kg' },
                  { name: 'Agachamento Livre', val: '120kg', date: 'Hoje', diff: '+5kg' },
                  { name: 'Desenvolvimento', val: '24kg', date: 'Há 5 dias', diff: '+2kg' }
               ].map((record, i) => (
                  <Card key={i} className="flex p-0 overflow-hidden">
                     <div className="w-1.5 bg-brand-primary" />
                     <div className="p-4 flex-1 flex items-center justify-between">
                        <div>
                           <p className="text-xs text-gray-500 uppercase font-black">{record.date}</p>
                           <h4 className="font-display italic text-lg">{record.name}</h4>
                        </div>
                        <div className="text-right">
                           <p className="text-2xl font-display tracking-tight text-brand-primary leading-none">{record.val}</p>
                           <p className="text-[10px] text-brand-secondary font-bold uppercase">{record.diff}</p>
                        </div>
                     </div>
                  </Card>
               ))}
            </div>
         </section>

         <section className="space-y-4">
            <div className="flex items-center justify-between">
               <h2 className="text-lg italic uppercase">Peso Corporal</h2>
               <Button variant="secondary" size="sm">Registrar</Button>
            </div>
            <Card className="h-48 text-[10px] pt-4">
               <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[
                     { d: '01/04', w: 82.5 }, { d: '08/04', w: 82.1 }, { d: '15/04', w: 81.8 }, { d: '22/04', w: 81.5 }
                  ]}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                     <XAxis dataKey="d" stroke="#4a4a4a" />
                     <YAxis domain={['dataMin - 1', 'dataMax + 1']} stroke="#4a4a4a" />
                     <Tooltip contentStyle={{ backgroundColor: '#1A1A1A', border: 'none', borderRadius: '12px' }} />
                     <Line type="monotone" dataKey="w" stroke="#FF5E1A" strokeWidth={3} dot={{ fill: '#FF5E1A', r: 4 }} />
                  </LineChart>
               </ResponsiveContainer>
            </Card>
         </section>
      </motion.div>
   );
}
