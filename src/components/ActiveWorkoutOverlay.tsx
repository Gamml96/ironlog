import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Timer, 
  CheckCircle2, 
  AlertTriangle, 
  Trash2, 
  Plus, 
  Search, 
  Trophy, 
  X, 
  ChevronLeft 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  getDocs, 
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore';

import { 
  WorkoutSession, 
  Exercise, 
  ExerciseLog, 
  SetLog, 
  DEFAULT_EXERCISES 
} from '../lib/db';
import { 
  auth, 
  getCollectionRef, 
  updateUserStats 
} from '../lib/firebase';
import { 
  calculateSessionVolume, 
  formatTime 
} from '../lib/utils';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';

interface ActiveWorkoutOverlayProps {
  session: WorkoutSession;
  weightIncrement?: number;
  onClose: (updatedSession: WorkoutSession) => void;
  onDiscard: () => void;
  onSave: (w: WorkoutSession) => void;
}

export function ActiveWorkoutOverlay({ 
  session, 
  weightIncrement = 2.5,
  onClose, 
  onDiscard, 
  onSave 
}: ActiveWorkoutOverlayProps) {
  const isEditing = !!session.isCompleted;
  const [currentSession, setCurrentSession] = useState<WorkoutSession>(JSON.parse(JSON.stringify(session)));
  const [previousData, setPreviousData] = useState<Record<string, ExerciseLog | null>>({});
  const [exerciseDetails, setExerciseDetails] = useState<Record<string, Exercise>>({});
  const [startTime] = useState(isEditing ? (session.date || Date.now()) : (Date.now() - (session.duration || 0) * 1000));
  const [elapsed, setElapsed] = useState(session.duration || 0);
  const [restTime, setRestTime] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showIncompleteWarning, setShowIncompleteWarning] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showExPicker, setShowExPicker] = useState(false);
  const [exSearch, setExSearch] = useState('');

  const addExerciseToSession = (ex: Exercise) => {
    const newExLog: ExerciseLog = {
      exerciseId: ex.id,
      exerciseName: ex.name,
      restTimer: "60",
      targetReps: "10",
      sets: [{
        weight: 0,
        reps: 0,
        completed: false,
        timestamp: Date.now()
      }, {
        weight: 0,
        reps: 0,
        completed: false,
        timestamp: Date.now()
      }, {
        weight: 0,
        reps: 0,
        completed: false,
        timestamp: Date.now()
      }]
    };
    
    setCurrentSession(prev => ({
      ...prev,
      exercises: [...prev.exercises, newExLog]
    }));
    
    setExerciseDetails(prev => ({
      ...prev,
      [ex.id]: ex
    }));
    
    setShowExPicker(false);
    setExSearch('');
  };

  const filteredExercises = DEFAULT_EXERCISES.concat((Object.values(exerciseDetails) as Exercise[]).filter(ed => !DEFAULT_EXERCISES.some(de => de.id === ed.id)))
    .filter(ex => 
      ex.name.toLowerCase().includes(exSearch.toLowerCase()) || 
      ex.muscleGroup.toLowerCase().includes(exSearch.toLowerCase())
    );

  useEffect(() => {
    async function loadData() {
      if (!auth.currentUser) return;
      
      const snap = await getDocs(getCollectionRef('exercises'));
      const customExs = snap.docs.map(d => d.data() as Exercise);
      const allExs = [...DEFAULT_EXERCISES, ...customExs];
      
      const exMap: Record<string, Exercise> = {};
      allExs.forEach(ex => exMap[ex.id] = ex);
      setExerciseDetails(exMap);

      const sessionsQuery = query(getCollectionRef('sessions'), orderBy('date', 'desc'), limit(50));
      const sessionsSnap = await getDocs(sessionsQuery);
      const allSessions = sessionsSnap.docs.map(d => d.data() as WorkoutSession);
      
      const latestData: Record<string, ExerciseLog | null> = {};
      for (const ex of currentSession.exercises) {
        const prevSession = allSessions.find(s => 
          s.id !== currentSession.id && 
          s.exercises.some(e => e.exerciseId === ex.exerciseId && e.sets.some(st => st.completed))
        );
        latestData[ex.exerciseId] = prevSession?.exercises.find(e => e.exerciseId === ex.exerciseId) || null;
      }
      setPreviousData(latestData);
    }
    loadData();
  }, [currentSession.id, currentSession.exercises.length]);

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
    const updatedExercises = currentSession.exercises.map((ex, i) => {
      if (i !== exIdx) return ex;
      const detail = exerciseDetails[ex.exerciseId];
      const updatedSets = ex.sets.map((s, j) => {
        if (j !== setIdx) return s;
        const isTurningOn = !s.completed;
        let newState = { ...s, completed: isTurningOn };

        if (isTurningOn && !isEditing) {
          const prevEx = previousData[ex.exerciseId];
          const hasWeight = s.weight > 0;
          const hasReps = s.reps > 0;
          const hasDuration = (s.duration || 0) > 0;

          if (!hasWeight) {
            const prevWeight = prevEx?.sets[setIdx]?.weight ?? prevEx?.sets[prevEx.sets.length - 1]?.weight;
            if (prevWeight && prevWeight > 0) {
              newState.weight = prevWeight;
            }
          }

          if (!hasReps) {
            const isCardio = ['Cardio', 'Lutas'].includes(detail?.muscleGroup || '');
            const prevReps = isCardio
              ? (prevEx?.sets[setIdx]?.duration ?? prevEx?.sets[prevEx.sets.length - 1]?.duration)
              : (prevEx?.sets[setIdx]?.reps ?? prevEx?.sets[prevEx.sets.length - 1]?.reps);

            if (prevReps && prevReps > 0) {
              if (isCardio) {
                newState.duration = prevReps;
              } else {
                newState.reps = prevReps;
              }
            } else if (isCardio) {
              if (ex.targetDuration) newState.duration = ex.targetDuration;
            } else if (ex.targetReps) {
              const parts = String(ex.targetReps).split(',').map(p => p.trim());
              newState.reps = parseInt(parts[setIdx] || parts[parts.length - 1]) || 0;
            }
          }
        }
        return newState;
      });
      return { ...ex, sets: updatedSets };
    });

    const isNowCompleted = updatedExercises[exIdx].sets[setIdx].completed;
    
    if (isNowCompleted) {
      if (window.navigator.vibrate) window.navigator.vibrate(50);
      
      const restVal = currentSession.exercises[exIdx].restTimer || "60";
      const restParts = String(restVal).split(',').map(p => p.trim());
      const restToUse = parseInt(restParts[setIdx] || restParts[restParts.length - 1]) || 60;
      setRestTime(restToUse); 
      
      const allSetsDone = updatedExercises[exIdx].sets.every(s => s.completed);
      if (allSetsDone && window.navigator.vibrate) {
        setTimeout(() => window.navigator.vibrate([100, 50, 100]), 300);
      }
    } else {
      setRestTime(0);
    }
    
    setCurrentSession(prev => ({ ...prev, exercises: updatedExercises }));
  };

  const updateSet = (exIdx: number, setIdx: number, field: 'weight' | 'reps' | 'duration', value: number) => {
    const updatedExercises = currentSession.exercises.map((ex, i) => {
      if (i !== exIdx) return ex;
      const updatedSets = ex.sets.map((s, j) => {
        if (j !== setIdx) return s;
        return { ...s, [field]: value };
      });
      return { ...ex, sets: updatedSets };
    });

    setCurrentSession(prev => ({ ...prev, exercises: updatedExercises }));
  };

  const addSet = (exIdx: number) => {
    const updatedExercises = currentSession.exercises.map((ex, i) => {
      if (i !== exIdx) return ex;
      const lastSet = ex.sets[ex.sets.length - 1];
      const newSet: SetLog = {
        weight: lastSet?.weight || 0,
        reps: lastSet?.reps || 0,
        duration: lastSet?.duration || 0,
        completed: false,
        timestamp: Date.now()
      };
      return { ...ex, sets: [...ex.sets, newSet] };
    });
    setCurrentSession(prev => ({ ...prev, exercises: updatedExercises }));
  };

  const removeSet = (exIdx: number, setIdx: number) => {
    const updatedExercises = currentSession.exercises.map((ex, i) => {
      if (i !== exIdx) return ex;
      if (ex.sets.length <= 1) return ex;
      const updatedSets = ex.sets.filter((_, sIdx) => sIdx !== setIdx);
      return { ...ex, sets: updatedSets };
    });
    setCurrentSession(prev => ({ ...prev, exercises: updatedExercises }));
  };

  const removeExerciseFromSession = (exIdx: number) => {
    const updatedExercises = currentSession.exercises.filter((_, i) => i !== exIdx);
    setCurrentSession(prev => ({ ...prev, exercises: updatedExercises }));
  };

  const finishWorkout = async () => {
    setIsSaving(true);
    try {
      const finalizedExercises = currentSession.exercises.map(ex => ({
        ...ex,
        exerciseName: exerciseDetails[ex.exerciseId]?.name || ex.exerciseName || 'Exercício'
      }));

      const finalizedSession = {
        ...currentSession,
        exercises: finalizedExercises,
        totalVolume: calculateSessionVolume(currentSession),
        duration: elapsed,
        isCompleted: true,
        date: isEditing ? currentSession.date : Date.now()
      };

      const totalVol = finalizedSession.totalVolume;
      
      if (!isEditing) {
        await updateUserStats(auth.currentUser?.uid || '', totalVol);
      }

      await onSave(finalizedSession);
    } finally {
      setIsSaving(false);
    }
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

  const currentVolume = calculateSessionVolume(currentSession);

  return (
    <motion.div 
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      className="fixed inset-0 bg-bg-base z-[100] flex flex-col pt-safe h-full"
    >
      <header className="bg-bg-card p-4 flex items-center justify-between flex-none z-[110] border-b border-white/5">
         <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-14 h-14 bg-brand-primary text-black rounded-full flex items-center justify-center font-display font-black italic text-xl shadow-[0_0_20px_rgba(255,94,26,0.2)]">
                {formatTime(elapsed)}
              </div>
            </div>
            <div>
               <h2 className="text-2xl leading-none font-black italic">{currentSession.workoutPlanName}</h2>
               <div className="text-[10px] font-black text-brand-primary uppercase tracking-[0.1em] flex items-center gap-1.5 mt-1.5">
                 {currentVolume > 0 ? (
                   <>
                     <TrendingUp size={10} /> 
                     {currentVolume.toLocaleString('pt-BR')}kg acumulados
                   </>
                 ) : (
                   <>Sessão em curso <div className="w-2 h-2 bg-brand-primary rounded-full animate-pulse" /></>
                 )}
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
            <Button 
               variant="ghost" 
               size="sm" 
               onClick={() => onClose({ ...currentSession, duration: elapsed })} 
               className="text-muted border border-white/10 h-10 px-4"
            >
               Minimizar
            </Button>
          </div>
      </header>

      {restTime > 0 && (
        <motion.div 
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="bg-brand-primary text-black py-3 px-6 flex items-center justify-between flex-none z-[105] font-black shadow-[0_8px_30px_rgba(255,94,26,0.3)]"
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
                      className="w-full h-12 italic font-black" 
                      onClick={onDiscard}
                    >
                      SIM, DESCARTAR
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="w-full h-12 italic font-black border border-white/5" 
                      onClick={() => setShowDiscardConfirm(false)}
                    >
                      CANCELAR
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-40">
        <div className="px-5 py-8 space-y-10">
        {currentSession.exercises.length === 0 && (
          <div 
            onClick={() => setShowExPicker(true)}
            className="py-20 flex flex-col items-center justify-center text-center space-y-6 opacity-80 cursor-pointer active:scale-95 transition-all group"
          >
            <div className="w-24 h-24 bg-brand-primary/10 rounded-full flex items-center justify-center border-2 border-dashed border-brand-primary/30 group-hover:border-brand-primary group-hover:bg-brand-primary/20 transition-all">
              <Plus size={40} className="text-brand-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-3xl italic font-black uppercase tracking-tight">Treino Vazio</h3>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-primary">O que vamos treinar hoje?</p>
              <p className="text-xs text-gray-500 max-w-[200px] leading-relaxed mx-auto mt-4 uppercase font-bold tracking-widest">Toque no botão ou no ícone acima para adicionar seu primeiro exercício.</p>
            </div>
          </div>
        )}
        {currentSession.exercises.map((ex, exIdx) => {
          const detail = exerciseDetails[ex.exerciseId];
          const isTimeEx = ['Cardio', 'Lutas'].includes(detail?.muscleGroup || '');
          return (
            <div key={exIdx} className="bg-bg-card rounded-[24px] p-6 border-l-4 border-l-brand-primary shadow-xl relative group/ex">
               <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-2xl italic font-black leading-tight">{detail?.name || 'Exercício'}</h3>
                    <button 
                      onClick={() => removeExerciseFromSession(exIdx)}
                      className="text-red-500/30 hover:text-red-500 p-1 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <Badge variant="secondary">{ex.sets.length} séries</Badge>
               </div>
               
               <div className="flex gap-4 text-muted text-xs font-bold uppercase tracking-widest mb-6 px-1">
                 <span>Meta: {ex.sets.length} {['Cardio', 'Lutas'].includes(detail?.muscleGroup || '') ? 'SxT' : 'SxR'}</span>
                 <div className="w-1 h-1 bg-muted/40 rounded-full mt-1.5" />
                 <span>{detail?.muscleGroup || 'Muscle'}</span>
               </div>

               {previousData[ex.exerciseId] ? (
                 <div className="bg-brand-primary/5 border border-dashed border-brand-primary/30 p-4 rounded-xl text-[10px] text-gray-400 flex flex-col gap-2 mb-8">
                    <div className="flex flex-col gap-1">
                       <span className="uppercase font-black text-brand-primary tracking-widest">Última sessão:</span>
                       <span className="text-white font-medium text-xs">
                          {previousData[ex.exerciseId]?.sets
                            .filter(s => (s.weight || 0) > 0 || (isTimeEx ? (s.duration || 0) > 0 : (s.reps || 0) > 0))
                            .map((s, idx) => {
                              if (isTimeEx) {
                                const d = (s.duration || 0) > 0 ? Math.floor(s.duration / 60) : (ex.targetDuration ? Math.floor(ex.targetDuration / 60) : '--');
                                return `${s.weight}Lvl x ${d}min`;
                              }
                              const r = (s.reps || 0) > 0 ? s.reps : (() => {
                                if (ex.isVariationPerSet && ex.targetReps) {
                                  const parts = String(ex.targetReps).split(',').map(p => p.trim());
                                  return parts[idx] || parts[parts.length - 1];
                                }
                                return ex.targetReps || '--';
                              })();
                              return `${s.weight}kg x ${r}`;
                            }).join(' | ') || 'Sem séries recentes'}
                       </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                       <Badge variant="success">
                         Sugestão: {(() => {
                           const lastSets = previousData[ex.exerciseId]?.sets || [];
                           const maxWeight = lastSets.reduce((max, s) => Math.max(max, Number(s.weight) || 0), 0);
                           const suggested = (maxWeight + weightIncrement).toFixed(1).replace(/\.0$/, '');
                           const unit = isTimeEx ? 'Lvl' : 'kg';
                           return `${suggested}${unit}`;
                         })()}
                       </Badge>
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
                    <div className="text-center">{['Cardio', 'Lutas'].includes(detail?.muscleGroup || '') ? 'Nível/Vel' : 'Peso kg'}</div>
                    <div className="text-center">{['Cardio', 'Lutas'].includes(detail?.muscleGroup || '') ? 'Tempo min' : 'Reps'}</div>
                    <div></div>
                  </div>
                  {ex.sets.map((set, setIdx) => {
                    const getPlanReps = () => {
                      if (isTimeEx) {
                        return ex.targetDuration ? String(Math.floor(ex.targetDuration / 60)) : '--';
                      }
                      if (ex.isVariationPerSet && ex.targetReps) {
                        const parts = String(ex.targetReps).split(',').map(p => p.trim());
                        return parts[setIdx] || parts[parts.length - 1] || '--';
                      }
                      return ex.targetReps || '--';
                    };

                    const prevEx = previousData[ex.exerciseId];
                    const prevWeight = prevEx?.sets[setIdx]?.weight ?? prevEx?.sets[prevEx.sets.length - 1]?.weight;
                    const prevReps = isTimeEx 
                      ? (prevEx?.sets[setIdx]?.duration ?? prevEx?.sets[prevEx.sets.length - 1]?.duration)
                      : (prevEx?.sets[setIdx]?.reps ?? prevEx?.sets[prevEx.sets.length - 1]?.reps);

                    const weightPlaceholder = (prevWeight && prevWeight > 0) ? String(prevWeight) : '--';
                    const repsPlaceholder = (prevReps && prevReps > 0) 
                      ? (isTimeEx ? String(Math.floor(prevReps / 60)) : String(prevReps))
                      : getPlanReps();

                    return (
                      <div 
                        key={setIdx} 
                        className={`grid grid-cols-[30px_1fr_1fr_40px_30px] items-center gap-2 p-2 rounded-xl transition-all duration-300 ${set.completed ? 'bg-brand-secondary/10 border-brand-secondary/20' : 'bg-[#252525]'}`}
                      >
                         <div className="text-center font-display text-muted text-lg italic font-black">{setIdx + 1}</div>
                         <div className="flex flex-col">
                           <input 
                             type="number"
                             inputMode="decimal"
                             value={set.weight || ''}
                             onChange={(e) => updateSet(exIdx, setIdx, 'weight', parseFloat(e.target.value) || 0)}
                             className="w-full h-10 bg-transparent border-none rounded-lg text-center text-lg font-display font-black text-white focus:ring-0 placeholder:text-white/30"
                             placeholder={weightPlaceholder}
                           />
                         </div>
                         <div className="flex flex-col">
                           <input 
                             type="number"
                             inputMode={['Cardio', 'Lutas'].includes(detail?.muscleGroup || '') ? 'decimal' : 'numeric'}
                             value={['Cardio', 'Lutas'].includes(detail?.muscleGroup || '') ? (set.duration ? set.duration / 60 : '') : (set.reps || '')}
                             onChange={(e) => {
                               if (['Cardio', 'Lutas'].includes(detail?.muscleGroup || '')) {
                                 updateSet(exIdx, setIdx, 'duration', (parseFloat(e.target.value) || 0) * 60);
                               } else {
                                 updateSet(exIdx, setIdx, 'reps', parseInt(e.target.value) || 0);
                               }
                             }}
                             className="w-full h-10 bg-transparent border-none rounded-lg text-center text-lg font-display font-black text-white focus:ring-0 placeholder:text-white/30"
                             placeholder={repsPlaceholder}
                           />
                         </div>
                         <button 
                           onClick={() => toggleSet(exIdx, setIdx)}
                           className={`h-9 w-9 flex items-center justify-center rounded-full transition-all border-2 ${set.completed ? 'bg-brand-secondary border-brand-secondary text-black' : 'bg-transparent border-muted/20 text-muted'}`}
                         >
                           {set.completed ? <CheckCircle2 size={20} strokeWidth={3} /> : <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                         </button>
                         <button 
                           onClick={() => removeSet(exIdx, setIdx)}
                           className="h-8 w-8 flex items-center justify-center text-red-500/20 hover:text-red-500 transition-colors"
                         >
                           <X size={14} />
                         </button>
                      </div>
                    );
                  })}
                  
                  <button 
                    onClick={() => addSet(exIdx)}
                    className="w-full h-10 border border-dashed border-white/10 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase text-gray-500 hover:text-brand-primary hover:border-brand-primary/30 transition-all active:scale-95 mt-2"
                  >
                    <Plus size={14} />
                    Adicionar Série
                  </button>
               </div>
            </div>
          );
        })}
        
        <div className="pt-4 px-4 pb-20">
          <Button 
            variant="secondary" 
            className="w-full h-20 border-2 border-dashed border-white/10 flex items-center justify-center gap-4 active:scale-[0.98] transition-all bg-white/5 hover:bg-brand-primary/5 hover:border-brand-primary/30 group"
            onClick={() => setShowExPicker(true)}
          >
            <div className="w-10 h-10 bg-brand-primary text-black rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(255,94,26,0.3)] group-hover:scale-110 transition-transform">
              <Plus size={24} strokeWidth={3} />
            </div>
            <div className="text-left">
              <span className="block text-lg font-black italic uppercase leading-none">Adicionar Exercício</span>
              <span className="block text-[10px] font-bold uppercase tracking-widest text-brand-primary opacity-70">Expandir o treino agora</span>
            </div>
          </Button>
        </div>
        </div>
      </div>

      <AnimatePresence>
        {showExPicker && (
          <div className="fixed inset-0 bg-black/95 z-[300] p-4 flex flex-col pt-safe backdrop-blur-xl">
             <header className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-primary text-black rounded-xl flex items-center justify-center italic font-black">EX</div>
                  <h2 className="text-2xl italic font-black uppercase tracking-tight">Escolher Exercício</h2>
                </div>
                <Button variant="ghost" size="icon" className="bg-white/5 border border-white/10 rounded-xl" onClick={() => { setShowExPicker(false); setExSearch(''); }}><X /></Button>
             </header>
             
             <div className="relative mb-6">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-primary w-5 h-5" />
               <input 
                 type="text"
                 placeholder="Buscar exercício..."
                 autoFocus
                 value={exSearch}
                 onChange={(e) => setExSearch(e.target.value)}
                 className="w-full bg-white/5 border border-white/10 h-14 pl-12 pr-4 rounded-2xl outline-none focus:border-brand-primary text-white text-lg font-bold placeholder:text-white/20 transition-all focus:bg-white/10"
               />
             </div>

             <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1 custom-scrollbar">
                {filteredExercises.map(ex => (
                  <div 
                    key={ex.id} 
                    onClick={() => addExerciseToSession(ex)}
                    className="bg-white/5 p-5 rounded-2xl flex justify-between items-center active:bg-brand-primary active:text-black transition-all border border-white/5 active:scale-[0.97]"
                  >
                     <div>
                        <p className="font-black text-sm uppercase tracking-tight">{ex.name}</p>
                        <p className="text-[10px] uppercase text-brand-primary font-bold tracking-widest mt-0.5 opacity-70">{ex.muscleGroup}</p>
                     </div>
                     <div className="w-10 h-10 bg-brand-primary/10 rounded-xl flex items-center justify-center border border-brand-primary/20">
                      <Plus size={18} className="text-brand-primary" />
                     </div>
                  </div>
                ))}
             </div>
          </div>
        )}
      </AnimatePresence>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-bg-base via-bg-base to-transparent z-[120]">
        <Button 
          size="lg" 
          className="w-full shadow-[0_12px_40px_rgba(255,94,26,0.3)] text-lg font-black italic tracking-tighter" 
          onClick={handleFinishRequest}
          loading={isSaving}
        >
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
                   <Button variant="secondary" className="h-12 italic font-black" onClick={() => setIsFinishing(false)} disabled={isSaving}>AINDA NÃO</Button>
                   <Button variant="primary" className="h-12 italic font-black" onClick={finishWorkout} loading={isSaving}>REGISTRAR!</Button>
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
                   <Button variant="primary" className="h-12 italic font-black" onClick={() => {
                     setShowIncompleteWarning(false);
                     setIsFinishing(true);
                   }}>SIM, FINALIZAR</Button>
                   <Button variant="ghost" className="h-12 italic font-black" onClick={() => setShowIncompleteWarning(false)}>CONTINUAR TREINANDO</Button>
                </div>
             </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
