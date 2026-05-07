import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Users, 
  UserPlus, 
  X, 
  Calendar, 
  Trophy, 
  Flame,
  Dumbbell
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { User as FirebaseUser } from 'firebase/auth';
import { 
  collection, 
  doc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  setDoc, 
  getDocs, 
  updateDoc, 
  arrayUnion 
} from 'firebase/firestore';

import { Group } from '../../lib/db';
import { db } from '../../lib/firebase';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { GroupDetailsView } from '../groups/GroupDetailsView';

interface GruposViewProps {
  currentUser: FirebaseUser;
}

export function GruposView({ currentUser }: GruposViewProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const [newGroupStartDate, setNewGroupStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [newGroupEndDate, setNewGroupEndDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [newGroupRankingType, setNewGroupRankingType] = useState<'workouts' | 'frequency'>('workouts');

  useEffect(() => {
    const q = query(
      collection(db, 'groups'), 
      where('memberIds', 'array-contains', currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    
    const unsub = onSnapshot(q, (snap) => {
      const updatedGroups = snap.docs.map(d => d.data() as Group);
      setGroups(updatedGroups);
      
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
    setIsActing(true);
    const gId = crypto.randomUUID();
    const newGroup: Group = {
      id: gId,
      name: groupName.trim(),
      description: '',
      inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
      createdBy: currentUser.uid,
      creatorId: currentUser.uid,
      memberIds: [currentUser.uid],
      members: {
        [currentUser.uid]: {
          uid: currentUser.uid,
          displayName: currentUser.displayName || 'Guerreiro',
          photoURL: currentUser.photoURL || '',
          joinedAt: Date.now(),
          role: 'admin'
        }
      },
      createdAt: Date.now(),
      challengeActive: true,
      challengeStart: new Date(newGroupStartDate + 'T00:00:00').getTime(),
      challengeEnd: new Date(newGroupEndDate + 'T23:59:59').getTime(),
      startDate: new Date(newGroupStartDate + 'T00:00:00').getTime(),
      endDate: new Date(newGroupEndDate + 'T23:59:59').getTime(),
      rankingType: newGroupRankingType,
      challengeRankingType: newGroupRankingType as any
    };
    try {
      await setDoc(doc(db, 'groups', gId), newGroup);
      setGroupName('');
      setShowCreate(false);
      setActiveGroup(newGroup);
    } catch (err) {
      console.error(err);
      alert("Erro ao criar grupo.");
    } finally {
      setIsActing(false);
    }
  };

  const joinGroup = async () => {
    if (!inviteCode.trim()) return;
    setIsActing(true);
    try {
      const q = query(collection(db, 'groups'), where('inviteCode', '==', inviteCode.trim().toUpperCase()));
      const snap = await getDocs(q);
      if (snap.empty) {
        alert("Código inválido ou grupo não encontrado!");
        setIsActing(false);
        return;
      }
      const groupDoc = snap.docs[0];
      const group = groupDoc.data() as Group;
      
      if (group.memberIds.includes(currentUser.uid)) {
        alert("Você já faz parte deste grupo!");
        setActiveGroup(group);
        setShowJoin(false);
        setIsActing(false);
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
      if (err?.code === 'permission-denied') {
        alert("Erro de permissão: Você não tem permissão para entrar neste grupo.");
      } else {
        alert("Erro ao entrar no grupo. Verifique sua conexão ou o código informado.");
      }
    } finally {
      setIsActing(false);
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
                    <Button onClick={createGroup} loading={isActing} className="w-full">Criar Desafio</Button>
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
                    <Button onClick={joinGroup} loading={isActing} className="w-full">Entrar Agora</Button>
                 </Card>
              </motion.div>
           </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
