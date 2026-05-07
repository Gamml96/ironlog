import React, { useState } from 'react';
import { 
  Activity, 
  LayoutDashboard, 
  TrendingUp, 
  Trophy, 
  Settings, 
  X 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/Button';

interface TutorialOverlayProps {
  onClose: () => void;
  onInstall: () => void;
  isInstallable: boolean;
}

export function TutorialOverlay({ onClose, onInstall, isInstallable }: TutorialOverlayProps) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "Boas-vindas!",
      description: "Prepare-se para transformar seu corpo e sua mente com o IronLog. Vamos te mostrar o básico.",
      icon: <LayoutDashboard size={44} className="text-brand-primary" />
    },
    {
      title: "Fique Atento",
      description: "Para garantir que você nunca perca o tempo de descanso, ative as notificações em segundo plano agora mesmo.",
      icon: <Activity size={48} />,
      isNotificationStep: true
    },
    ...(isInstallable ? [{
      title: "App na Tela Inicial",
      description: "Para uma experiência de elite, instale o IronLog na sua tela inicial e acesse seus treinos com um toque.",
      icon: <LayoutDashboard size={48} />,
      isInstallStep: true
    }] : []),
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
                  className="w-full bg-brand-primary text-black h-12 rounded-xl mb-4 font-black italic"
                >
                  ATIVAR NOTIFICAÇÕES
                </Button>
              )}

              {(steps[step] as any).isInstallStep && (
                <Button 
                  onClick={() => {
                    onInstall();
                    next();
                  }}
                  className="w-full bg-brand-primary text-black h-12 rounded-xl mb-4 font-black italic"
                >
                  ADICIONAR À TELA INICIAL
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
