import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Activity, 
  Trash2, 
  Check, 
  X 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  onSnapshot, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

import { PersonalRecord } from '../../lib/db';
import { 
  auth, 
  getCollectionRef, 
  logWeight, 
  deletePersonalRecord 
} from '../../lib/firebase';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

export function ProgressoView({ key }: { key?: React.Key } = {}) {
  const [weightHistory, setWeightHistory] = useState<any[]>([]);
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([]);
  const [newWeight, setNewWeight] = useState('');
  const [isLogging, setIsLogging] = useState(false);
  const [isSavingWeight, setIsSavingWeight] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubWeight = onSnapshot(query(getCollectionRef('weight_history'), orderBy('date')), (snap) => {
      setWeightHistory(snap.docs.map(d => d.data()));
    });
    
    const unsubPRs = onSnapshot(query(getCollectionRef('personal_records'), orderBy('date', 'desc')), (snap) => {
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
    setIsSavingWeight(true);
    try {
      await logWeight(auth.currentUser.uid, w);
      setNewWeight('');
      setIsLogging(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingWeight(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="py-4 space-y-10 pb-20"
    >
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl italic font-black uppercase tracking-tighter leading-tight">Minha <span className="text-brand-primary">Evolução</span></h1>
          <p className="text-[10px] uppercase font-bold text-gray-500 tracking-[0.2em] mt-1">Nível de Performance</p>
        </div>
        <div className="bg-brand-primary/10 px-3 py-2 rounded-xl flex items-center gap-2 border border-brand-primary/20">
          <Trophy size={14} className="text-brand-primary" />
          <span className="text-xs font-black italic">{personalRecords.length} MARCAS</span>
        </div>
      </header>

      <section className="space-y-6">
        <div className="flex justify-between items-center px-1">
           <div className="flex items-center gap-3">
              <div className="h-6 w-1 bg-brand-primary rounded-full" />
              <h2 className="text-sm font-black uppercase italic tracking-widest text-white/80">Monitoramento Corporal</h2>
           </div>
           
           <div className="flex gap-2">
              {isLogging ? (
                 <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex gap-2 items-center bg-white/5 px-2 py-1.5 rounded-2xl border border-white/10"
                 >
                    <input 
                       type="number" 
                       placeholder="00.0" 
                       value={newWeight}
                       onChange={(e) => setNewWeight(e.target.value)}
                       className="w-14 bg-transparent text-sm text-center outline-none text-brand-primary font-black font-display"
                       autoFocus
                       disabled={isSavingWeight}
                    />
                    <Button 
                      variant="primary" 
                      size="icon" 
                      className="h-8 w-8 min-h-0" 
                      onClick={handleLogWeight}
                      loading={isSavingWeight}
                    >
                      <Check size={16} />
                    </Button>
                    <button 
                      onClick={() => setIsLogging(false)} 
                      className="text-gray-500 p-1.5 hover:text-white transition-colors"
                      disabled={isSavingWeight}
                    >
                      <X size={16} />
                    </button>
                 </motion.div>
              ) : (
                 <Button 
                    variant="secondary" 
                    size="sm" 
                    className="h-9 text-[10px] border-brand-primary/20 bg-brand-primary/5 text-brand-primary hover:bg-brand-primary/10 italic font-black" 
                    onClick={() => setIsLogging(true)}
                  >
                    + REGISTRAR PESO
                  </Button>
              )}
           </div>
        </div>

        <Card className="h-72 p-0 overflow-hidden bg-[#1A1A1A] border-white/5 shadow-2xl">
           <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
              <div>
                <p className="text-[10px] uppercase font-bold text-gray-500 tracking-[0.2em] mb-1">Histórico de Peso</p>
                {weightHistory.length > 0 && (
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-display font-black italic tracking-tighter text-white">{weightHistory[weightHistory.length - 1].weight}</span>
                    <span className="text-[10px] font-black text-brand-primary italic">kg atual</span>
                  </div>
                )}
              </div>
              <div className="text-right">
                <Activity size={14} className="text-brand-primary opacity-50 ml-auto mb-1" />
                <span className="text-[8px] font-black uppercase text-gray-600 tracking-widest">Últimos 15 registros</span>
              </div>
           </div>
           
           <div className="h-44 w-full pt-4 px-2">
             {weightHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={weightHistory.map(w => ({ d: format(w.date, 'dd/MM'), w: w.weight })).slice(-15)}>
                      <defs>
                        <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#FF5E1A" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#FF5E1A" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                      <XAxis 
                        dataKey="d" 
                        stroke="transparent" 
                        tick={{ fill: '#4a4a4a', fontSize: 10, fontWeight: 700 }} 
                        axisLine={false}
                      />
                      <YAxis 
                        domain={['dataMin - 1', 'dataMax + 1']} 
                        hide={true}
                      />
                      <Tooltip 
                         contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                         labelStyle={{ color: '#8E8E93', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}
                         itemStyle={{ color: '#FF5E1A', fontWeight: 900 }}
                         cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="w" 
                        stroke="#FF5E1A" 
                        strokeWidth={4} 
                        fillOpacity={1} 
                        fill="url(#colorWeight)"
                        dot={{ fill: '#FF5E1A', r: 3, strokeWidth: 0 }} 
                        activeDot={{ r: 6, stroke: '#1A1A1A', strokeWidth: 2 }} 
                      />
                   </AreaChart>
                </ResponsiveContainer>
             ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted space-y-4">
                   <p className="italic text-xs">Nenhum registro de peso.</p>
                </div>
             )}
           </div>
        </Card>
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-3 px-1">
           <div className="h-6 w-1 bg-yellow-500 rounded-full" />
           <h2 className="text-sm font-black uppercase italic tracking-widest text-white/80">Recordes Pessoais</h2>
        </div>
        
        {personalRecords.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {personalRecords.map((pr, idx) => {
              const muscleGroup = pr.muscleGroup || 'Extra';
              
              return (
                <motion.div
                  key={pr.exerciseId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Card className="flex items-center gap-4 py-5 px-6 relative overflow-hidden group hover:border-yellow-500/40 border-white/5 transition-all">
                    <div className="absolute -right-4 -bottom-4 text-white/[0.03] rotate-12 group-hover:rotate-0 transition-transform duration-500 pointer-events-none">
                      <Activity size={100} />
                    </div>

                    <div className="w-12 h-12 bg-white/5 rounded-2xl flex flex-col items-center justify-center border border-white/5 shrink-0 group-hover:bg-yellow-500/10 group-hover:border-yellow-500/20 transition-colors">
                      <Trophy size={20} className="text-yellow-500/40 group-hover:text-yellow-500 transition-colors" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                         <h4 className="font-black text-sm italic uppercase truncate text-white/90">{pr.exerciseName}</h4>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[9px] font-black uppercase tracking-widest text-brand-primary bg-brand-primary/5 px-2 py-0.5 rounded-lg border border-brand-primary/10">{muscleGroup}</span>
                        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">{format(pr.date, 'dd MMM yy', { locale: ptBR })}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0 relative z-10 flex items-center gap-4">
                      <div className="flex flex-col items-end">
                        <div className="flex items-baseline gap-1.5 justify-end">
                          <span className="text-3xl font-display font-black italic tracking-tighter text-white tabular-nums">{(pr.weight || 0)}</span>
                          <span className="text-[10px] font-black text-brand-primary uppercase italic">kg</span>
                        </div>
                        <div className="flex items-center gap-1 justify-end bg-white/5 px-2 py-0.5 rounded-lg border border-white/5 min-w-[70px]">
                          <span className="text-lg font-display font-black italic text-brand-secondary tabular-nums">{Number(pr.reps || 0)}</span>
                          <span className="text-[8px] font-black text-muted uppercase tracking-wider">Reps</span>
                        </div>
                      </div>
                      
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Remover recorde de ${pr.exerciseName}?`)) {
                            deletePersonalRecord(auth.currentUser?.uid || '', pr.exerciseId);
                          }
                        }}
                        className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-500 hover:text-red-500 hover:bg-red-500/10 transition-colors border border-white/5"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <Card className="text-center py-12 bg-white/[0.02] border-dashed border-white/10">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 grayscale opacity-40">
              <Trophy size={32} />
            </div>
            <h3 className="text-sm font-black italic uppercase text-gray-500 mb-1">Ainda sem marcas pro</h3>
            <p className="text-[10px] text-muted uppercase font-bold tracking-widest px-8">Seus PRs aparecerão aqui ao finalizar treinos pesados!</p>
          </Card>
        )}
      </section>
    </motion.div>
  );
}
