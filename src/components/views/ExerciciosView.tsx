import React, { useState, useEffect } from 'react';
import { 
  Search, 
  X, 
  ChevronRight, 
  Dumbbell 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  getDocs, 
  collection 
} from 'firebase/firestore';

import { Exercise } from '../../lib/db';
import { db, getCollectionRef, saveToCloud } from '../../lib/firebase';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

export function ExerciciosView({ key }: { key?: React.Key } = {}) {
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
      const sorted = custom.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setExercises(sorted);
    } catch (err) {
      console.error("Error loading exercises:", err);
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

  const groups = ['Todos', 'Peito', 'Costas', 'Pernas', 'Ombros', 'Braços', 'Core', 'Cardio', 'Lutas'];

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
          <h1 className="text-3xl italic font-black uppercase tracking-tighter">Biblioteca</h1>
          <Button size="sm" variant="secondary" onClick={() => setIsAddingCustom(true)} className="italic font-black">+ NOVO</Button>
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
           <Card key={ex.id} className="flex items-center justify-between group hover:border-brand-primary/30 transition-all cursor-pointer">
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-muted group-hover:text-brand-primary transition-colors">
                    <Dumbbell size={20} />
                 </div>
                 <div>
                    <h4 className="font-bold text-sm tracking-tight uppercase">{ex.name}</h4>
                    <p className="text-[10px] uppercase text-muted font-bold tracking-widest">{ex.muscleGroup}</p>
                 </div>
              </div>
              <div className="flex items-center gap-3">
                 {ex.isCustom && (
                   <span className="text-[8px] font-black uppercase bg-brand-primary/10 text-brand-primary border border-brand-primary/20 px-2 py-0.5 rounded-md">Custom</span>
                 )}
                 <ChevronRight size={16} className="text-gray-700" />
              </div>
           </Card>
         ))}

         {filtered.length === 0 && (
            <div className="text-center py-20 opacity-40">
               <p className="text-xs uppercase font-black tracking-widest text-muted">Nenhum exercício encontrado</p>
            </div>
         )}
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
                   <h2 className="text-xl italic font-black uppercase text-brand-primary font-display">Cadastrar Exercício</h2>
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
                         {['Peito', 'Costas', 'Pernas', 'Ombros', 'Braços', 'Core', 'Cardio', 'Lutas'].map(g => (
                           <option key={g} value={g}>{g}</option>
                         ))}
                      </select>
                   </div>

                   <div className="flex gap-3 pt-4">
                      <Button variant="ghost" className="flex-1 font-black uppercase text-xs h-12" onClick={() => setIsAddingCustom(false)}>Cancelar</Button>
                      <Button className="flex-1 font-black uppercase text-xs h-12" onClick={createCustom}>Cadastrar</Button>
                   </div>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
