import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  Check, 
  UserPlus, 
  Calendar, 
  LogOut, 
  Trophy, 
  Dumbbell, 
  Flame, 
  MessageSquare 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { User as FirebaseUser } from 'firebase/auth';
import { 
  collection, 
  doc, 
  query, 
  where, 
  onSnapshot, 
  updateDoc, 
  arrayRemove, 
  getDocs 
} from 'firebase/firestore';

import { Group } from '../../lib/db';
import { db } from '../../lib/firebase';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { GroupFeedView } from './GroupFeedView';

interface GroupDetailsViewProps {
  group: Group;
  onBack: () => void;
  currentUser: FirebaseUser;
}

export function GroupDetailsView({ group, onBack, currentUser }: GroupDetailsViewProps) {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [challengeStats, setChallengeStats] = useState<Record<string, number>>({});
  const [showConfig, setShowConfig] = useState(false);
  const [sDate, setSDate] = useState(group.startDate ? new Date(group.startDate).toISOString().split('T')[0] : '');
  const [eDate, setEDate] = useState(group.endDate ? new Date(group.endDate).toISOString().split('T')[0] : '');

  useEffect(() => {
    if (!sDate && group.startDate) setSDate(new Date(group.startDate).toISOString().split('T')[0]);
    if (!eDate && group.endDate) setEDate(new Date(group.endDate).toISOString().split('T')[0]);
  }, [group.startDate, group.endDate]);

  useEffect(() => {
    setLoading(true);
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
            const days = new Set();
            snap.docs.forEach(doc => {
              const d = new Date(doc.data().date);
              days.add(d.toDateString());
            });
            stats[m.uid] = days.size;
          } else {
            stats[m.uid] = snap.size;
          }
        }));
        setChallengeStats(stats);
      } catch (e) { console.error(e); }
    };
    fetchChallengeStats();
  }, [group.id, group.startDate, group.endDate, members.length, group.rankingType]);

  const getMemberScore = (m: any) => {
    if (group.startDate && group.endDate) {
      return challengeStats[m.uid] || 0;
    }
    return m.totalWorkouts || 0;
  };

  const sortedMembers = [...members].sort((a, b) => {
    return getMemberScore(b) - getMemberScore(a);
  });

  const memberRanks: Record<string, number> = {};
  let currentDisplayRank = 0;
  let lastScore = -1;
  sortedMembers.forEach((m, idx) => {
    const score = getMemberScore(m);
    if (idx === 0 || score !== lastScore) {
      currentDisplayRank++;
    }
    memberRanks[m.uid] = currentDisplayRank;
    lastScore = score;
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
      <header className="space-y-6">
        <div className="flex justify-between items-center">
           <button 
            onClick={onBack} 
            className="w-10 h-10 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-muted hover:text-white hover:bg-white/10 transition-all active:scale-95 shadow-lg"
           >
            <ChevronLeft size={20} />
           </button>
           
           <div className="flex gap-2">
              <button 
                onClick={copyInvite}
                className={`h-10 px-4 rounded-full flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 ${copied ? 'bg-green-500 text-black' : 'bg-white/5 text-muted border border-white/10 hover:bg-white/10'}`}
              >
                {copied ? <Check size={14} strokeWidth={3} /> : <UserPlus size={14} className="text-brand-primary" />}
                {copied ? 'Copiado!' : group.inviteCode}
              </button>

              <div className="flex bg-white/5 rounded-full p-1 border border-white/5 shadow-lg">
                {currentUser.uid === group.creatorId && (
                   <button 
                    onClick={() => setShowConfig(!showConfig)} 
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${showConfig ? 'bg-brand-primary text-black' : 'text-brand-primary hover:bg-brand-primary/10'}`}
                   >
                    <Calendar size={16} />
                   </button>
                )}
                <button 
                  onClick={leaveGroup} 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-red-500 hover:bg-red-500/10 transition-all"
                >
                  <LogOut size={16} />
                </button>
              </div>
           </div>
        </div>

        <div className="px-2">
           <h1 className="text-4xl font-black italic uppercase leading-[0.9] tracking-tighter text-white drop-shadow-xl">{group.name}</h1>
           {group.startDate && group.endDate ? (
             <div className="mt-4 flex flex-wrap gap-2">
               <div className="flex items-center gap-2 bg-brand-primary/10 border border-brand-primary/20 px-3 py-1.5 rounded-full shadow-sm">
                 <Calendar size={12} className="text-brand-primary" />
                 <p className="text-[9px] font-black uppercase tracking-wider text-brand-primary">
                   Até {new Date(group.endDate).toLocaleDateString()}
                 </p>
               </div>
               <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full">
                 <Trophy size={12} className="text-brand-secondary" />
                 <p className="text-[9px] font-black uppercase tracking-wider text-muted">
                    {group.rankingType === 'workouts' ? 'Volume Treinos' : 'Frequência'}
                 </p>
               </div>
             </div>
           ) : (
             <p className="text-[10px] text-muted/60 font-black uppercase tracking-[0.2em] mt-3 ml-1">Comunidade Atleta</p>
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
        <div className="space-y-10">
          <section className="space-y-4">
             <div className="flex items-center gap-2 px-2">
                <Trophy size={16} className="text-yellow-500" />
                <h2 className="text-[12px] font-black uppercase tracking-[0.2em] text-white/50 italic">Classificação</h2>
             </div>
             <div className="space-y-6">
                {sortedMembers.length > 0 && (
                  <div className="flex items-end justify-center gap-2 pt-8 pb-4 mb-4">
                    {/* 2nd Place Position */}
                    {sortedMembers[1] && (
                      <div className={`flex flex-col items-center gap-2 w-1/3 transition-all duration-500 ${memberRanks[sortedMembers[1].uid] === 1 ? '-mt-4' : ''}`}>
                        <div className="relative group">
                          {memberRanks[sortedMembers[1].uid] === 1 && (
                            <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-yellow-500 animate-bounce">
                              <Trophy size={16} fill="currentColor" />
                            </div>
                          )}
                          <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[8px] font-black uppercase italic shadow-lg z-10 ${
                            memberRanks[sortedMembers[1].uid] === 1 ? 'bg-yellow-500 text-black animate-pulse' : 
                            memberRanks[sortedMembers[1].uid] === 2 ? 'bg-gray-400 text-black' : 
                            'bg-orange-700/80 text-white'
                          }`}>#{memberRanks[sortedMembers[1].uid]}</div>
                          <img 
                            src={sortedMembers[1].photoURL || `https://picsum.photos/seed/${sortedMembers[1].uid}/100/100`} 
                            alt="" 
                            className={`rounded-2xl border-2 object-cover transition-all duration-500 ${
                              memberRanks[sortedMembers[1].uid] === 1 ? 'w-20 h-20 border-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.3)] rotate-0' : 
                              'w-14 h-14 border-gray-400/30'
                            }`}
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-bold uppercase truncate max-w-[80px]">{sortedMembers[1].displayName}</p>
                          <p className={`text-[12px] font-black ${
                            memberRanks[sortedMembers[1].uid] === 1 ? 'text-yellow-500' : 
                            memberRanks[sortedMembers[1].uid] === 2 ? 'text-gray-400' : 
                            'text-orange-700'
                          }`}>
                            {getMemberScore(sortedMembers[1])} <span className="text-[8px] opacity-70">pts</span>
                          </p>
                        </div>
                      </div>
                    )}

                    {/* 1st Place Position */}
                    {sortedMembers[0] && (
                      <div className="flex flex-col items-center gap-3 w-1/3 -mt-6">
                        <div className="relative group">
                          <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-yellow-500 animate-bounce">
                            <Trophy size={24} fill="currentColor" />
                          </div>
                          <div className="absolute -inset-2 bg-yellow-500/20 blur-xl rounded-full animate-pulse"></div>
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-black px-2.5 py-0.5 rounded text-[10px] font-black uppercase italic shadow-xl z-20 border-b border-black/10">#1</div>
                          <img 
                            src={sortedMembers[0].photoURL || `https://picsum.photos/seed/${sortedMembers[0].uid}/100/100`} 
                            alt="" 
                            className="w-24 h-24 rounded-[2.5rem] border-4 border-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.4)] object-cover relative z-10 transition-transform hover:scale-105"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="text-center">
                          <p className="text-[11px] font-black uppercase tracking-tight truncate max-w-[100px] text-yellow-500 drop-shadow-md">{sortedMembers[0].displayName}</p>
                          <p className="text-[18px] font-black italic text-brand-primary drop-shadow-sm">{getMemberScore(sortedMembers[0])} <span className="text-[10px] opacity-70">pts</span></p>
                        </div>
                      </div>
                    )}

                    {/* 3rd Place Position */}
                    {sortedMembers[2] && (
                      <div className={`flex flex-col items-center gap-2 w-1/3 transition-all duration-500 ${memberRanks[sortedMembers[2].uid] === 1 ? '-mt-4' : memberRanks[sortedMembers[2].uid] === 2 ? '-mt-2' : ''}`}>
                        <div className="relative group">
                          {(memberRanks[sortedMembers[2].uid] === 1 || memberRanks[sortedMembers[2].uid] === 2) && (
                            <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-yellow-500 animate-bounce">
                              <Trophy size={16} fill="currentColor" />
                            </div>
                          )}
                          <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[8px] font-black uppercase italic shadow-lg z-10 ${
                            memberRanks[sortedMembers[2].uid] === 1 ? 'bg-yellow-500 text-black animate-pulse' : 
                            memberRanks[sortedMembers[2].uid] === 2 ? 'bg-gray-400 text-black' : 
                            'bg-orange-700/80 text-white'
                          }`}>#{memberRanks[sortedMembers[2].uid]}</div>
                          <img 
                            src={sortedMembers[2].photoURL || `https://picsum.photos/seed/${sortedMembers[2].uid}/100/100`} 
                            alt="" 
                            className={`rounded-2xl border-2 object-cover transition-all duration-500 ${
                              memberRanks[sortedMembers[2].uid] === 1 ? 'w-20 h-20 border-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.3)]' : 
                              memberRanks[sortedMembers[2].uid] === 2 ? 'w-16 h-16 border-gray-400' :
                              'w-14 h-14 border-orange-700/30'
                            }`}
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-bold uppercase truncate max-w-[80px]">{sortedMembers[2].displayName}</p>
                          <p className={`text-[12px] font-black ${
                            memberRanks[sortedMembers[2].uid] === 1 ? 'text-yellow-500' : 
                            memberRanks[sortedMembers[2].uid] === 2 ? 'text-gray-400' : 
                            memberRanks[sortedMembers[2].uid] === 3 ? 'text-orange-700' : 'text-muted'
                          }`}>
                            {getMemberScore(sortedMembers[2])} <span className="text-[8px] opacity-70">pts</span>
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* List for 4th and beyond */}
                <div className="space-y-2">
                  {sortedMembers.map((member, idx) => {
                    if (idx < 3) return null;
                    
                    const rank = memberRanks[member.uid];
                    return (
                      <Card 
                        key={member.uid} 
                        className={`flex items-center gap-4 transition-all py-3 ${member.uid === currentUser.uid ? 'border-brand-primary bg-brand-primary/5' : 'border-white/5 opacity-90'}`}
                      >
                        <div className="w-6 text-center font-black italic text-gray-700 text-xs">
                          #{rank}
                        </div>
                        <img 
                          src={member.photoURL || `https://picsum.photos/seed/${member.uid}/100/100`} 
                          alt="" 
                          className={`w-10 h-10 rounded-xl border ${member.uid === currentUser.uid ? 'border-brand-primary' : 'border-white/10'}`} 
                          referrerPolicy="no-referrer"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm truncate uppercase tracking-tight leading-tight">{member.displayName}</h4>
                          <p className="text-[8px] text-muted font-bold uppercase tracking-widest mt-0.5 opacity-60">
                            {group.rankingType === 'frequency' ? 'Frequência' : 'Treinos'}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[14px] text-brand-primary font-black uppercase leading-none tracking-tighter">
                            {getMemberScore(member)} <span className="text-[8px] opacity-70">pts</span>
                          </p>
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <Flame size={10} className={member.uid === currentUser.uid ? 'text-brand-primary' : 'text-gray-700'} />
                            <p className="text-[8px] text-gray-500 font-black uppercase tracking-tighter">{member.streak || 0}d</p>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                  
                  {sortedMembers.slice(0, 3).map((member) => {
                    if (member.uid !== currentUser.uid) return null;
                    const rank = memberRanks[member.uid];
                    return (
                      <div key="current-user-top" className="mt-4 p-4 rounded-2xl bg-brand-primary text-black border border-brand-primary shadow-[0_0_20px_rgba(255,94,26,0.1)]">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-black/10 flex items-center justify-center font-black italic">#{rank}</div>
                          <div className="flex-1">
                            <p className="text-[10px] font-black uppercase leading-none opacity-70">Sua Posição</p>
                            <h4 className="font-black uppercase text-sm tracking-tight">Você está no pódio!</h4>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-black leading-none italic">{getMemberScore(member)} PTS</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
             </div>
          </section>

          {/* Feed Section */}
          <section className="space-y-4">
             <div className="flex items-center gap-2 px-2">
                <MessageSquare size={16} className="text-brand-primary" />
                <h2 className="text-[12px] font-black uppercase tracking-[0.2em] text-white/50 italic">Atividade Recente</h2>
             </div>
             <GroupFeedView group={group} currentUser={currentUser} />
          </section>
        </div>
      )}
    </motion.div>
  );
}
