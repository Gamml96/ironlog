import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Play, 
  ArrowRight, 
  Edit2, 
  Trash2, 
  ChevronLeft, 
  Search, 
  Activity, 
  HelpCircle, 
  X 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  onSnapshot, 
  query, 
  orderBy, 
  getDocs 
} from 'firebase/firestore';

import { 
  WorkoutPlan, 
  WorkoutSession, 
  Exercise 
} from '../../lib/db';
import { 
  getCollectionRef, 
  saveToCloud, 
  deleteFromCloud, 
  getDocRef 
} from '../../lib/firebase';
import { 
  calculateEstimatedDuration, 
  startEmptyWorkoutHelper 
} from '../../lib/workout-utils';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

// --- Sub-component: EditPlanView ---

interface EditPlanViewProps {
  plan: WorkoutPlan & { isOneOff?: boolean };
  onSave: (p: WorkoutPlan) => void;
  onCancel: () => void;
  onStartOneOff?: (p: WorkoutPlan) => void;
}

function EditPlanView({ plan, onSave, onCancel, onStartOneOff }: EditPlanViewProps) {
  const [editedPlan, setEditedPlan] = useState<WorkoutPlan & { isOneOff?: boolean }>(JSON.parse(JSON.stringify(plan)));
  const [showExPicker, setShowExPicker] = useState(false);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exSearch, setExSearch] = useState('');
  const [exFilter, setExFilter] = useState('Todos');
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExGroup, setNewExGroup] = useState('Peito');
  const [defaultRest, setDefaultRest] = useState(60);
  const [isSaving, setIsSaving] = useState(false);

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
      const sorted = custom.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setExercises(sorted);
    } catch (err) {
      console.error("Error loading exercises:", err);
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
        restTimer: String(defaultRest)
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
    if (editedPlan.isOneOff && onStartOneOff) {
      onStartOneOff(editedPlan);
      return;
    }

    setIsSaving(true);
    try {
      await saveToCloud('plans', editedPlan);
      onSave(editedPlan);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="py-4 space-y-6 pb-20">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onCancel} disabled={isSaving}><ChevronLeft /></Button>
        <h1 className="text-2xl italic font-black uppercase tracking-tighter flex-1">
          {editedPlan.isOneOff ? 'Treino Avulso' : 'Configuração'}
        </h1>
        <Button 
          variant="primary" 
          size="sm" 
          onClick={persist} 
          loading={isSaving}
          className="italic font-black px-6"
        >
          {editedPlan.isOneOff ? 'INICIAR' : 'SALVAR'}
        </Button>
      </header>

      <div className="space-y-6">
        <div>
           <label className="text-[10px] uppercase text-muted font-bold block mb-2 tracking-widest pl-1">Nome do Plano</label>
           <input 
             value={editedPlan.name}
             onChange={(e) => setEditedPlan({...editedPlan, name: e.target.value})}
             className="w-full bg-bg-card border border-white/5 rounded-2xl h-14 px-4 focus:border-brand-primary outline-none text-white text-xl font-display font-black italic"
             placeholder="Ex: Treino A - Superior"
           />
        </div>

        <div className="flex items-center justify-between px-1">
           <h2 className="text-[10px] uppercase tracking-[0.2em] font-black text-white/40">Exercícios ({editedPlan.exercises.length})</h2>
           <Button variant="secondary" size="sm" onClick={() => setShowExPicker(true)} className="h-8 text-[10px] italic font-black">+ ADICIONAR</Button>
        </div>

        <div className="space-y-3">
           {editedPlan.exercises.map((ex, idx) => {
             const baseInfo = exercises.find(d => d.id === ex.exerciseId);
             const isTimeEx = ['Cardio', 'Lutas'].includes(baseInfo?.muscleGroup || '');

             return (
               <Card key={idx} className="group overflow-hidden relative">
                  <div className="flex items-start justify-between mb-4">
                     <div className="min-w-0 pr-8">
                        <p className="font-black text-sm uppercase tracking-tight truncate">{baseInfo?.name || 'Exercício'}</p>
                        <p className="text-[10px] uppercase font-bold text-brand-primary/60 tracking-widest">{baseInfo?.muscleGroup || 'Muscle'}</p>
                     </div>
                     <div className="flex items-center gap-1 opacity-20 group-hover:opacity-100 transition-opacity">
                        <button 
                          disabled={idx === 0}
                          onClick={() => {
                            const newExs = [...editedPlan.exercises];
                            [newExs[idx - 1], newExs[idx]] = [newExs[idx], newExs[idx - 1]];
                            setEditedPlan({...editedPlan, exercises: newExs});
                          }}
                          className="p-1.5 bg-white/5 rounded-lg hover:bg-white/10 disabled:opacity-5 text-white"
                        >
                           <Plus className="rotate-45" size={14} />
                        </button>
                        <button 
                          disabled={idx === editedPlan.exercises.length - 1}
                          onClick={() => {
                            const newExs = [...editedPlan.exercises];
                            [newExs[idx + 1], newExs[idx]] = [newExs[idx], newExs[idx + 1]];
                            setEditedPlan({...editedPlan, exercises: newExs});
                          }}
                          className="p-1.5 bg-white/5 rounded-lg hover:bg-white/10 disabled:opacity-5 text-white"
                        >
                           <Plus className="rotate-[225deg]" size={14} />
                        </button>
                        <button 
                          onClick={() => removeExercise(idx)}
                          className="p-1.5 bg-red-500/10 rounded-lg hover:bg-red-500/20 text-red-500"
                        >
                          <X size={14} />
                        </button>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                     <div className="space-y-1">
                        <label className="text-[8px] uppercase font-black text-muted tracking-widest">Séries</label>
                        <input 
                          type="number"
                          value={ex.targetSets}
                          onChange={(e) => {
                            const newExs = [...editedPlan.exercises];
                            newExs[idx].targetSets = parseInt(e.target.value) || 0;
                            setEditedPlan({...editedPlan, exercises: newExs});
                          }}
                          className="w-full h-10 bg-white/5 border border-white/5 rounded-xl text-center text-sm font-black italic text-white focus:border-brand-primary outline-none"
                        />
                     </div>
                     
                     <div className="space-y-1">
                        <label className="text-[8px] uppercase font-black text-muted tracking-widest">{isTimeEx ? 'Tempo (min)' : 'Reps'}</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="text"
                            value={isTimeEx ? (ex.targetDuration ? Math.floor(ex.targetDuration / 60) : '') : ex.targetReps}
                            onChange={(e) => {
                              const newExs = [...editedPlan.exercises];
                              if (isTimeEx) {
                                newExs[idx].targetDuration = (parseInt(e.target.value) || 0) * 60;
                              } else {
                                newExs[idx].targetReps = e.target.value;
                              }
                              setEditedPlan({...editedPlan, exercises: newExs});
                            }}
                            className="flex-1 h-10 bg-white/5 border border-white/5 rounded-xl text-center text-sm font-black italic text-white focus:border-brand-primary outline-none"
                            placeholder={ex.isVariationPerSet ? "12,10,8" : "10"}
                          />
                          {!isTimeEx && (
                            <button 
                              onClick={() => {
                                const newExs = [...editedPlan.exercises];
                                newExs[idx].isVariationPerSet = !newExs[idx].isVariationPerSet;
                                setEditedPlan({...editedPlan, exercises: newExs});
                              }}
                              className={`h-10 px-2 rounded-xl transition-all border ${ex.isVariationPerSet ? 'bg-brand-primary border-brand-primary text-black' : 'bg-white/5 border-white/10 text-gray-500'}`}
                            >
                              <Activity size={14} />
                            </button>
                          )}
                        </div>
                     </div>

                     <div className="space-y-1 col-span-2 lg:col-span-1">
                        <label className="text-[8px] uppercase font-black text-muted tracking-widest">Descanso (s)</label>
                        <input 
                          type="text"
                          value={ex.restTimer}
                          onChange={(e) => {
                            const newExs = [...editedPlan.exercises];
                            newExs[idx].restTimer = e.target.value;
                            setEditedPlan({...editedPlan, exercises: newExs});
                          }}
                          className="w-full h-10 bg-black/20 border border-white/5 rounded-xl text-center text-sm font-black italic text-brand-primary focus:border-brand-primary outline-none"
                        />
                     </div>
                  </div>
               </Card>
             );
           })}
        </div>
      </div>

      <AnimatePresence>
        {showExPicker && (
          <div className="fixed inset-0 bg-black/95 z-[150] p-4 flex flex-col pt-safe backdrop-blur-xl">
             <header className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-primary text-black rounded-xl flex items-center justify-center font-display font-black italic">EX</div>
                  <h2 className="text-2xl font-black italic uppercase tracking-tighter">Escolher Exercício</h2>
                </div>
                <Button variant="ghost" size="icon" className="bg-white/5 border border-white/10 rounded-xl" onClick={() => { setShowExPicker(false); setIsAddingCustom(false); }}><X /></Button>
             </header>
             
             {!isAddingCustom ? (
               <>
                 <div className="relative mb-6">
                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-primary w-5 h-5" />
                   <input 
                     type="text"
                     placeholder="Buscar na biblioteca..."
                     value={exSearch}
                     onChange={(e) => setExSearch(e.target.value)}
                     className="w-full bg-white/5 border border-white/10 h-14 pl-12 pr-4 rounded-2xl outline-none focus:border-brand-primary text-white text-lg font-bold"
                   />
                 </div>

                 <div className="flex-1 overflow-y-auto space-y-2 mb-6 pr-1 custom-scrollbar">
                    {filteredExercises.length > 0 ? (
                      filteredExercises.map(ex => (
                        <div 
                          key={ex.id} 
                          onClick={() => addExercise(ex)}
                          className="bg-white/5 p-5 rounded-2xl flex justify-between items-center active:bg-brand-primary active:text-black transition-all border border-white/5 active:scale-[0.97]"
                        >
                           <div>
                              <p className="font-black text-sm uppercase tracking-tight">{ex.name}</p>
                              <p className="text-[10px] uppercase text-brand-primary font-bold tracking-widest mt-0.5 opacity-60">{ex.muscleGroup}</p>
                           </div>
                           <Plus size={18} className="text-brand-primary" />
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12 text-muted">
                         <p className="text-sm italic mb-4">Item não encontrado.</p>
                         <Button size="sm" variant="secondary" onClick={() => setIsAddingCustom(true)} className="italic font-black tracking-widest uppercase text-[10px]">Cadastrar Manualmente</Button>
                      </div>
                    )}
                 </div>
                 
                 <Button variant="secondary" className="w-full h-14 italic font-black uppercase text-xs" onClick={() => setIsAddingCustom(true)}>+ NOVO EXERCÍCIO</Button>
               </>
             ) : (
               <motion.div 
                 initial={{ opacity: 0, scale: 0.95 }}
                 animate={{ opacity: 1, scale: 1 }}
                 className="space-y-6"
               >
                  <div className="space-y-6 bg-bg-card p-8 rounded-[32px] border border-white/10 shadow-2xl">
                     <h3 className="text-xl italic font-black uppercase text-brand-primary font-display">Cadastro Manual</h3>
                     
                     <div className="space-y-4">
                        <div>
                           <label className="text-[10px] uppercase text-muted font-bold block mb-1 tracking-widest">Nome do Exercício</label>
                           <input 
                             value={newExName}
                             onChange={(e) => setNewExName(e.target.value)}
                             autoFocus
                             className="w-full bg-black/40 border border-white/10 rounded-xl h-12 px-4 focus:border-brand-primary outline-none text-white font-bold"
                             placeholder="Ex: Elevação Pélvica"
                           />
                        </div>

                        <div>
                           <label className="text-[10px] uppercase text-muted font-bold block mb-1 tracking-widest">Grupo Muscular</label>
                           <select 
                             value={newExGroup}
                             onChange={(e) => setNewExGroup(e.target.value)}
                             className="w-full bg-black/40 border border-white/10 rounded-xl h-12 px-4 focus:border-brand-primary outline-none text-white text-sm appearance-none"
                           >
                              {['Peito', 'Costas', 'Pernas', 'Ombros', 'Braços', 'Core', 'Cardio', 'Lutas'].map(g => (
                                <option key={g} value={g}>{g}</option>
                              ))}
                           </select>
                        </div>
                     </div>

                     <div className="grid grid-cols-2 gap-3 pt-2">
                        <Button variant="ghost" className="h-12 italic font-black" onClick={() => setIsAddingCustom(false)}>CANCELAR</Button>
                        <Button className="h-12 italic font-black" onClick={createCustomAndAdd}>ADICIONAR</Button>
                     </div>
                  </div>
               </motion.div>
             )}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Main View: TreinosView ---

interface TreinosViewProps {
  onStartWorkout: (s: WorkoutSession) => void;
  key?: React.Key;
}

export function TreinosView({ onStartWorkout }: TreinosViewProps) {
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [isEditing, setIsEditing] = useState<WorkoutPlan & { isOneOff?: boolean } | null>(null);

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

  const startOneOffWorkout = () => {
    const newPlan: WorkoutPlan = {
      id: 'one-off-' + crypto.randomUUID(),
      name: 'Treino Avulso',
      exercises: [],
      order: -1
    };
    const session = startEmptyWorkoutHelper(newPlan);
    onStartWorkout(session);
  };

  const deletePlan = async (id: string) => {
    if (confirm('Deseja realmente excluir este plano de treino?')) {
      await deleteFromCloud('plans', id);
    }
  };

  if (isEditing) {
    return (
      <EditPlanView 
        plan={isEditing} 
        onSave={() => setIsEditing(null)} 
        onCancel={() => setIsEditing(null)} 
        onStartOneOff={(plan) => {
          const session = startEmptyWorkoutHelper(plan);
          onStartWorkout(session);
          setIsEditing(null);
        }}
      />
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="py-4 space-y-6 pb-20"
    >
      <header className="flex flex-col gap-1">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl italic font-black uppercase tracking-tighter leading-tight">Meus <span className="text-brand-primary">Treinos</span></h1>
          <Button variant="primary" size="icon" onClick={createPlan} className="h-10 w-10 shadow-[0_4px_15px_rgba(255,94,26,0.3)]"><Plus /></Button>
        </div>
        <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Rotinas de treino e sessões avulsas</p>
      </header>

      <div className="grid grid-cols-1 gap-6">
        <Card 
          onClick={startOneOffWorkout}
          className="bg-brand-primary/5 border-brand-primary/20 hover:bg-brand-primary/10 transition-all group cursor-pointer active:scale-[0.98] py-8"
        >
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-brand-primary text-black rounded-2xl flex items-center justify-center shadow-[0_8px_25px_rgba(255,94,26,0.2)] group-hover:scale-110 transition-transform">
              <Play size={32} fill="currentColor" strokeWidth={3} />
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-black italic uppercase tracking-tight">Treino Avulso</h3>
              <p className="text-[10px] text-brand-primary font-black uppercase tracking-widest mt-1">Montar e treinar agora</p>
            </div>
            <ArrowRight className="text-brand-primary opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all mr-2" />
          </div>
        </Card>

        <div className="flex items-center gap-4 py-2 px-1">
          <div className="h-[1px] flex-1 bg-white/5" />
          <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Minhas Rotina Fixas</span>
          <div className="h-[1px] flex-1 bg-white/5" />
        </div>

        <div className="grid grid-cols-1 gap-4">
          {plans.map(plan => (
            <Card key={plan.id} className="group overflow-hidden border-white/5 hover:border-white/10 transition-all p-0">
               <div className="p-6">
                  <div className="flex items-start justify-between mb-2">
                     <div className="flex flex-col">
                        <h3 className="text-2xl italic font-black uppercase tracking-tight flex items-center gap-2">
                          {plan.name}
                          {plans[0]?.id === plan.id && (
                            <span className="text-[9px] bg-brand-primary text-black px-2 py-0.5 rounded font-black italic uppercase">Atual</span>
                          )}
                        </h3>
                        <div className="flex items-center gap-3 mt-1">
                           <span className="text-brand-primary font-black uppercase text-[10px] tracking-tighter">~{calculateEstimatedDuration(plan)} min</span>
                           <span className="text-gray-600 font-bold uppercase text-[9px] tracking-widest">{plan.exercises.length} Exercícios</span>
                        </div>
                     </div>
                     <div className="flex gap-2">
                       <button onClick={() => setIsEditing(plan)} className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-gray-400 hover:text-white transition-colors border border-white/5">
                          <Edit2 size={18} />
                       </button>
                       <button onClick={() => deletePlan(plan.id)} className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors border border-white/5">
                          <Trash2 size={18} />
                       </button>
                     </div>
                  </div>
                  
                  <div className="mt-4 flex gap-2">
                     <Button 
                       variant="secondary" 
                       className="flex-1 h-12 italic font-black uppercase tracking-tighter text-xs border-brand-primary/20 bg-brand-primary/5 text-brand-primary hover:bg-brand-primary/10"
                       onClick={() => {
                         const session = startEmptyWorkoutHelper(plan);
                         onStartWorkout(session);
                       }}
                     >
                       <Play size={14} fill="currentColor" className="mr-2" /> Iniciar Treino
                     </Button>
                  </div>
               </div>
               
               <div className="bg-white/[0.02] border-t border-white/5 px-6 py-3 flex gap-4 overflow-x-auto no-scrollbar">
                  {plan.exercises.length > 0 ? (
                    plan.exercises.map((ex, i) => (
                      <span key={i} className="whitespace-nowrap text-[8px] font-black uppercase tracking-widest text-gray-500 bg-white/5 px-2 py-1 rounded-md">
                        {i + 1}. Ex
                      </span>
                    ))
                  ) : (
                    <p className="text-[8px] text-gray-700 italic uppercase font-black">Nenhum exercício configurado</p>
                  )}
               </div>
            </Card>
          ))}
          
          {plans.length === 0 && (
            <div className="text-center py-10 opacity-30">
               <p className="text-[10px] font-black uppercase tracking-widest italic">Crie seus planos de treino acima</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
