import React, { useState, useEffect } from 'react';
import { 
  Flame, 
  Settings, 
  History, 
  Edit2, 
  Trash2, 
  Plus, 
  Dumbbell, 
  CheckCircle2, 
  Target, 
  ArrowRight 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  isToday, 
  isYesterday, 
  formatDistanceToNow 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  onSnapshot, 
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';

import { 
  WorkoutSession, 
  WorkoutPlan 
} from '../../lib/db';
import { 
  getCollectionRef, 
  getDocRef 
} from '../../lib/firebase';
import { 
  calculateEstimatedDuration, 
  rotateWorkoutPlans, 
  startEmptyWorkoutHelper 
} from '../../lib/workout-utils';
import { 
  calculateSessionVolume 
} from '../../lib/utils';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

interface HojeViewProps {
  onStartWorkout: (w: WorkoutSession) => void;
  onEditSession: (s: WorkoutSession) => void;
  onDeleteSession: (id: string, vol: number, date: number) => void;
  onSetActiveTab: (v: string) => void;
  user: FirebaseUser;
  key?: React.Key;
}

export function HojeView({ onStartWorkout, onEditSession, onDeleteSession, onSetActiveTab, user }: HojeViewProps) {
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([]);
  const [streak, setStreak] = useState(0);
  const [weeklyGoal, setWeeklyGoal] = useState(5);
  const [completedThisWeek, setCompletedThisWeek] = useState(0);
  const [loading, setLoading] = useState(true);

  function calculateStats(allSessions: WorkoutSession[]) {
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
    if (!user) return;
    setLoading(true);
    
    const plansQuery = query(getCollectionRef('plans'), orderBy('order'));
    const unsubPlans = onSnapshot(plansQuery, (snap) => {
      setPlans(snap.docs.map(d => d.data() as WorkoutPlan));
      setLoading(false);
    });

    const sessionsQuery = query(getCollectionRef('sessions'), orderBy('date', 'desc'), limit(50));
    const unsubSessions = onSnapshot(sessionsQuery, (snap) => {
      const allSessions = snap.docs.map(d => d.data() as WorkoutSession);
      setRecentSessions(allSessions.slice(0, 3));
      calculateStats(allSessions);
    });

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
    await rotateWorkoutPlans(plan.id);
  };

  const startEmptyWorkout = (plan: WorkoutPlan) => {
    const session = startEmptyWorkoutHelper(plan);
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
      className="space-y-6 py-4 pb-20"
    >
      <header className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <img src={user.photoURL || `https://picsum.photos/seed/${user.uid}/100/100`} alt="" className="w-10 h-10 rounded-xl border border-white/10" referrerPolicy="no-referrer" />
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

      {(recentSessions.length > 0 || plans.length > 0) && (
        <div className="flex items-center justify-center gap-0 mb-8 px-4 max-w-md mx-auto">
          <div className="flex flex-col items-center flex-1 min-w-0">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border transition-all ${recentSessions[0] ? 'bg-white/5 border-white/10 text-muted-foreground' : 'border-dashed border-white/5 text-white/5'}`}>
              <CheckCircle2 size={18} className={recentSessions[0] ? 'text-brand-primary/50' : ''} />
            </div>
            <span className="text-[9px] font-black italic uppercase mt-2 text-muted-foreground truncate w-full text-center px-1">
              {recentSessions[0]?.workoutPlanName || "Vazio"}
            </span>
            <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/40 mt-0.5">
              {recentSessions[0] ? formatDistanceToNow(recentSessions[0].date, { addSuffix: true, locale: ptBR }) : 'Pendente'}
            </span>
          </div>

          <div className="w-8 h-[2px] bg-white/5 mb-6 opacity-50" />

          <div className="flex flex-col items-center flex-1 min-w-0 scale-110">
            <div className="w-14 h-14 rounded-3xl bg-brand-primary text-black flex items-center justify-center shadow-[0_0_30px_rgba(255,94,26,0.3)] relative border-4 border-bg-base">
              <Dumbbell size={24} fill="currentColor" />
              <div className="absolute -bottom-1 -right-1 bg-white text-black rounded-full px-1.5 py-0.5 text-[8px] font-black shadow-lg border border-brand-primary">
                HOJE
              </div>
            </div>
            <span className="text-[10px] font-black italic uppercase mt-3 text-white truncate w-full text-center px-1">
              {plans[0]?.name || "Nenhum"}
            </span>
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-brand-primary mt-1">Ativo</span>
          </div>

          <div className="w-8 h-[2px] bg-white/5 mb-6 opacity-50" />

          <div className="flex flex-col items-center flex-1 min-w-0 opacity-40">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center border border-white/10 bg-white/5 text-muted-foreground">
              <Target size={18} />
            </div>
            <span className="text-[9px] font-black italic uppercase mt-2 text-muted-foreground truncate w-full text-center px-1">
              {plans[1]?.name || "..." }
            </span>
            <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/40 mt-0.5">Próximo</span>
          </div>
        </div>
      )}

      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col">
            <span className="text-[10px] text-muted font-bold uppercase tracking-[0.05em] mb-1 leading-none">Treino de Hoje</span>
            <h2 className="text-2xl font-black italic">{plans[0]?.name || "Nenhum Treino"}</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onSetActiveTab('treinos')} className="italic font-black text-brand-primary uppercase text-[10px]">Ver Todos</Button>
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
              <Card onClick={() => startEmptyWorkout(plans[0])} borderAccent className="relative overflow-hidden group cursor-pointer active:scale-[0.98] transition-all">
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
                    className="absolute top-4 right-4 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white py-1.5 px-3 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10 transition-all z-10"
                  >
                    Pular Treino
                  </button>
                )}
              </Card>
            </motion.div>
          </AnimatePresence>
        ) : (
          <Card className="text-center py-12 flex flex-col items-center border-dashed border-white/10 bg-white/[0.02]">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 text-gray-700">
               <Plus size={32} />
            </div>
            <h3 className="text-sm italic font-black uppercase text-gray-500 mb-4">Nenhum plano criado</h3>
            <Button size="sm" onClick={() => onSetActiveTab('treinos')} className="italic font-black">CRIAR MEU PRIMEIRO TREINO</Button>
          </Card>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h2 className="text-xs font-black uppercase italic tracking-widest text-white/50">Atividade Recente</h2>
          <Button variant="ghost" size="sm" className="text-[10px] uppercase font-black text-brand-primary italic" onClick={() => onSetActiveTab('stats')}>Ver Evolução</Button>
        </div>
        
        {recentSessions.length > 0 ? (
          <div className="space-y-3">
            {recentSessions.map(session => (
              <Card key={session.id} className="flex items-center gap-4 relative pr-2 group hover:border-brand-primary/20 transition-all">
                 <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-brand-primary shrink-0 group-hover:bg-brand-primary/10 transition-colors">
                   <History size={24} />
                 </div>
                 <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                       <h4 className="font-bold text-sm truncate uppercase tracking-tight">{session.workoutPlanName}</h4>
                       <span className="text-[9px] text-gray-600 font-black uppercase shrink-0 tabular-nums">{isToday(session.date) ? 'Hoje' : isYesterday(session.date) ? 'Ontem' : format(session.date, 'dd/MM')}</span>
                    </div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">
                       Volume: <span className="text-white">{(session.totalVolume || calculateSessionVolume(session)).toLocaleString('pt-BR')}kg</span> • {session.exercises.length} ex.
                    </p>
                 </div>
                 <div className="flex items-center gap-1 shrink-0">
                    <button 
                      onClick={() => onEditSession(session)} 
                      className="p-2 text-gray-700 hover:text-white transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => onDeleteSession(session.id, session.totalVolume, session.date)} 
                      className="p-2 text-gray-700 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                 </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 opacity-30">
            <p className="text-[10px] font-black uppercase tracking-widest italic">Nenhum histórico ainda. Hora de suar!</p>
          </div>
        )}
      </section>
    </motion.div>
  );
}
