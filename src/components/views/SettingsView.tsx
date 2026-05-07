import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  X, 
  Check 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  onSnapshot, 
  doc, 
  updateDoc 
} from 'firebase/firestore';

import { 
  auth, 
  db, 
  getDocRef, 
  saveToCloud 
} from '../../lib/firebase';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface SettingsViewProps {
  onBack: () => void;
  onLogout: () => void;
  isInstallable: boolean;
  onInstall: () => void;
  key?: React.Key;
}

export function SettingsView({ onBack, onLogout, isInstallable, onInstall }: SettingsViewProps) {
  const [defaultRest, setDefaultRest] = useState(60);
  const [restInput, setRestInput] = useState('60');
  const [defaultIncrement, setDefaultIncrement] = useState(2.5);
  const [incrementInput, setIncrementInput] = useState('2.5');
  const [weeklyGoal, setWeeklyGoal] = useState(5);
  const [showInRanking, setShowInRanking] = useState(true);
  const [displayName, setDisplayName] = useState(auth.currentUser?.displayName || '');
  const [profile, setProfile] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubSettings = onSnapshot(getDocRef('settings', 'user-settings'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data.defaultRestTime !== undefined) {
          setDefaultRest(data.defaultRestTime);
          if (document.activeElement?.id !== 'rest-input') {
            setRestInput(String(data.defaultRestTime));
          }
        } else {
          setDefaultRest(60);
          setRestInput('60');
        }
        if (data.defaultWeightIncrement !== undefined) {
          setDefaultIncrement(data.defaultWeightIncrement);
          if (document.activeElement?.id !== 'increment-input') {
            setIncrementInput(String(data.defaultWeightIncrement));
          }
        } else {
          setDefaultIncrement(2.5);
          setIncrementInput('2.5');
        }
        if (data.weeklyGoal !== undefined) setWeeklyGoal(data.weeklyGoal);
      } else {
        setDefaultRest(60);
        setRestInput('60');
        setWeeklyGoal(5);
      }
    });

    const unsubProfile = onSnapshot(doc(db, 'users', auth.currentUser?.uid || ''), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setProfile(data);
        setDisplayName(data.displayName);
        if (data.showInRanking !== undefined) setShowInRanking(data.showInRanking);
      }
    });

    return () => {
      unsubSettings();
      unsubProfile();
    };
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const numericRest = parseInt(restInput) || 60;
      const numericIncrement = parseFloat(incrementInput.replace(',', '.')) || 2.5;
      await saveToCloud('settings', { 
        id: 'user-settings', 
        defaultRestTime: numericRest,
        defaultWeightIncrement: numericIncrement,
        weeklyGoal: weeklyGoal
      });
      if (auth.currentUser) {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await updateDoc(userRef, {
          displayName: displayName.trim(),
          showInRanking: showInRanking,
          lastActive: Date.now()
        });
      }
      setHasChanges(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="py-4 space-y-8 pb-20"
    >
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}><ChevronLeft /></Button>
          <h1 className="text-3xl italic font-black uppercase tracking-tighter">Ajustes</h1>
        </div>
        <Button 
          size="sm" 
          disabled={!hasChanges} 
          loading={isSaving}
          onClick={handleSave}
          className={`h-10 px-6 rounded-xl italic font-black transition-all ${
            hasChanges 
              ? 'bg-brand-primary text-black shadow-[0_4px_15px_rgba(255,94,26,0.3)]' 
              : 'bg-white/5 text-white/20 border border-white/5'
          }`}
        >
          SALVAR
        </Button>
      </header>

      <div className="flex items-center gap-4 px-2">
        <img src={auth.currentUser?.photoURL || `https://picsum.photos/seed/${auth.currentUser?.uid}/100/100`} alt="" className="w-16 h-16 rounded-2xl border-2 border-brand-primary shadow-xl object-cover" referrerPolicy="no-referrer" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <input 
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                setHasChanges(true);
              }}
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
                   id="rest-input"
                   type="text"
                   inputMode="numeric"
                   value={restInput}
                   onChange={(e) => {
                     const val = e.target.value.replace(/[^0-9]/g, '');
                     setRestInput(val);
                     setHasChanges(true);
                   }}
                   onBlur={() => {
                     if (restInput === '' || isNaN(parseInt(restInput))) {
                       setRestInput(String(defaultRest));
                     }
                   }}
                   className="flex-1 bg-white/5 border border-white/10 rounded-xl h-14 px-4 focus:border-brand-primary outline-none text-white text-xl font-display font-black"
                 />
                 <div className="text-brand-primary font-black italic text-xl w-16">{restInput || '0'}s</div>
              </div>
           </div>
        </Card>

        <Card className="space-y-4">
           <div>
              <label className="text-xs uppercase text-muted font-bold block mb-2 tracking-widest">Incremento de Peso Padrão (kg)</label>
              <div className="flex items-center gap-4">
                 <input 
                   id="increment-input"
                   type="text"
                   inputMode="decimal"
                   value={incrementInput}
                   onChange={(e) => {
                     setIncrementInput(e.target.value);
                     setHasChanges(true);
                   }}
                   onBlur={() => {
                     const val = parseFloat(incrementInput.replace(',', '.'));
                     if (incrementInput === '' || isNaN(val)) {
                       setIncrementInput(String(defaultIncrement));
                     }
                   }}
                   className="flex-1 bg-white/5 border border-white/10 rounded-xl h-14 px-4 focus:border-brand-primary outline-none text-white text-xl font-display font-black"
                 />
                 <div className="text-brand-primary font-black italic text-xl w-16">+{incrementInput || '0'}kg</div>
              </div>
              <p className="text-[10px] text-muted mt-2 leading-relaxed uppercase font-bold tracking-tight">
                Valor sugerido para progressão de carga no próximo treino.
              </p>
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
                   onChange={(e) => {
                     setWeeklyGoal(parseInt(e.target.value));
                     setHasChanges(true);
                   }}
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
              <div className="flex justify-between items-center">
                 <div>
                    <label className="text-xs uppercase text-muted font-bold block mb-1 tracking-widest">Participar do Ranking</label>
                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-tight leading-tight">
                       Seu nome e volume aparecerão no ranking global
                    </p>
                 </div>
                 <button 
                   onClick={() => {
                     setShowInRanking(!showInRanking);
                     setHasChanges(true);
                   }}
                   className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ${showInRanking ? 'bg-brand-primary' : 'bg-white/10'}`}
                 >
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-200 ${showInRanking ? 'translate-x-6' : 'translate-x-0'}`} />
                 </button>
              </div>
           </div>
        </Card>

        {isInstallable && (
          <Card className="border-brand-primary/20 bg-brand-primary/5">
             <div className="flex justify-between items-center">
                <div className="flex-1">
                   <h3 className="text-sm font-black italic uppercase text-brand-primary">IronLog no seu celular</h3>
                   <p className="text-[10px] text-gray-400 leading-relaxed uppercase font-bold tracking-tight mt-1">
                      Adicione o app à sua tela inicial para uma experiência de elite e acesso instantâneo.
                   </p>
                </div>
                <Button 
                   size="sm" 
                   variant="primary" 
                   className="h-10 px-4 text-[10px] italic font-black"
                   onClick={onInstall}
                >
                   INSTALAR
                </Button>
             </div>
          </Card>
        )}

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
                </div>
                {typeof Notification !== 'undefined' && Notification.permission !== 'granted' && (
                  <Button 
                    size="sm" 
                    variant="primary" 
                    className="h-10 px-4 text-[10px] italic font-black"
                    onClick={() => {
                      Notification.requestPermission().then(permission => {
                        if (permission === 'granted') window.location.reload();
                      });
                    }}
                  >
                    ATIVAR
                  </Button>
                )}
              </div>
           </div>
        </Card>

        <Button variant="danger" className="w-full flex gap-2 h-14 italic font-black" onClick={onLogout}>
          <X className="w-5 h-5" /> SAIR DA CONTA
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

      <div className="pt-10 text-center opacity-40">
         <p className="text-[10px] text-muted uppercase font-bold tracking-widest">IronLog v1.2.0 • Build 2026</p>
      </div>
    </motion.div>
  );
}
