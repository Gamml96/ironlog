import React, { useState, useEffect } from 'react';
import { 
  Check, 
  Flame, 
  Trophy, 
  Dumbbell, 
  Timer, 
  Heart, 
  MessageSquare, 
  Trash2, 
  Edit2, 
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { User as FirebaseUser } from 'firebase/auth';
import { 
  collection, 
  doc, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  deleteDoc 
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';

import { Group, GroupPost } from '../../lib/db';
import { db, storage } from '../../lib/firebase';
import { Card } from '../ui/Card';

interface GroupFeedViewProps {
  group: Group;
  currentUser: FirebaseUser;
}

export function GroupFeedView({ group, currentUser }: GroupFeedViewProps) {
  const [posts, setPosts] = useState<GroupPost[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [openCommentsPostId, setOpenCommentsPostId] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [deletingCommentId, setDeletingCommentId] = useState<{postId: string, index: number} | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    // Explicitly check for feed collection under the group
    const feedRef = collection(db, 'groups', group.id, 'feed');
    const q = query(
      feedRef,
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsub = onSnapshot(q, (snap) => {
      console.log(`Feed updated for group ${group.id}: ${snap.size} posts`);
      const fetchedPosts = snap.docs.map(d => ({ 
        ...d.data(), 
        id: d.id 
      } as GroupPost));
      setPosts(fetchedPosts);
      setLoading(false);
      setError(null);
    }, (err) => {
      console.error("Group feed fetch error:", err);
      // Fallback: try without orderBy if index is potentially missing
      if (err.message?.includes('index')) {
        const fallbackQ = query(feedRef, limit(50));
        onSnapshot(fallbackQ, (fallbackSnap) => {
          const fetchedPosts = fallbackSnap.docs.map(d => ({ 
            ...d.data(), 
            id: d.id 
          } as GroupPost)).sort((a, b) => b.createdAt - a.createdAt);
          setPosts(fetchedPosts);
          setLoading(false);
        });
      } else {
        setError("Erro de permissão ou conexão ao carregar o feed.");
        setLoading(false);
      }
    });

    return () => unsub();
  }, [group.id]);

  const handleLike = async (post: GroupPost) => {
    const ref = doc(db, 'groups', group.id, 'feed', post.id);
    if (post.likes.includes(currentUser.uid)) {
      await updateDoc(ref, { likes: arrayRemove(currentUser.uid) });
    } else {
      await updateDoc(ref, { likes: arrayUnion(currentUser.uid) });
    }
  };

  const handleAddComment = async (post: GroupPost) => {
    if (!newCommentText.trim()) return;
    try {
      const ref = doc(db, 'groups', group.id, 'feed', post.id);
      const newComment = {
        userId: currentUser.uid,
        userName: currentUser.displayName || 'Atleta',
        userPhoto: currentUser.photoURL,
        text: newCommentText.trim(),
        createdAt: Date.now()
      };
      await updateDoc(ref, {
        comments: arrayUnion(newComment)
      });
      setNewCommentText('');
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteComment = async (post: GroupPost, commentIndex: number) => {
    const isConfirming = deletingCommentId?.postId === post.id && deletingCommentId?.index === commentIndex;

    if (isConfirming) {
      try {
        const postRef = doc(db, 'groups', group.id, 'feed', post.id);
        const newComments = [...post.comments];
        newComments.splice(commentIndex, 1);
        await updateDoc(postRef, {
          comments: newComments
        });
        setDeletingCommentId(null);
      } catch (e) {
        console.error(e);
        setDeletingCommentId(null);
        alert("Erro ao excluir comentário.");
      }
    } else {
      setDeletingCommentId({ postId: post.id, index: commentIndex });
      setTimeout(() => setDeletingCommentId(prev => (prev?.postId === post.id && prev?.index === commentIndex) ? null : prev), 3000);
    }
  };

  const handleDeletePost = async (post: GroupPost) => {
    if (deletingPostId === post.id) {
      try {
        if (post.imageUrl) {
          try {
            const imageRef = ref(storage, post.imageUrl);
            await deleteObject(imageRef).catch(() => {});
          } catch (storageErr) {
            console.warn("Could not delete image, but continuing with post deletion", storageErr);
          }
        }
        await deleteDoc(doc(db, 'groups', group.id, 'feed', post.id));
        setDeletingPostId(null);
      } catch (e) {
        console.error("Error deleting post:", e);
        setDeletingPostId(null);
        alert("Erro ao excluir postagem. Verifique sua conexão e permissões.");
      }
    } else {
      setDeletingPostId(post.id);
      setTimeout(() => setDeletingPostId(prev => prev === post.id ? null : prev), 4000);
    }
  };

  const startEdit = (post: GroupPost) => {
    setEditingPostId(post.id);
    setEditContent(post.content || '');
  };

  const saveEdit = async (post: GroupPost) => {
    try {
      await updateDoc(doc(db, 'groups', group.id, 'feed', post.id), {
        content: editContent.trim()
      });
      setEditingPostId(null);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 pb-20 mt-2">
      <div className="space-y-6">
        {loading && (
          <div className="flex justify-center py-10">
            <Dumbbell className="animate-spin text-brand-primary w-6 h-6 opacity-20" />
          </div>
        )}
        {error && (
          <div className="text-center py-10 bg-red-500/5 rounded-3xl border border-red-500/10">
            <p className="text-red-500 text-[10px] font-black uppercase tracking-widest">{error}</p>
          </div>
        )}
        {!loading && !error && posts.length === 0 && (
          <div className="text-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10">
            <p className="text-muted text-[11px] font-black uppercase tracking-[0.2em] opacity-40">O silêncio do sucesso...</p>
            <p className="text-[10px] text-muted/60 mt-2">Seja o primeiro a motivar o grupo!</p>
          </div>
        )}
        {posts.map(post => (
          <Card key={post.id} className="p-0 overflow-hidden border-white/5 relative group/post hover:border-brand-primary/20 transition-all duration-300">
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img 
                    src={post.userPhoto || `https://picsum.photos/seed/${post.userId}/100/100`} 
                    alt="" 
                    className="w-10 h-10 rounded-2xl border border-white/10 object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-brand-primary rounded-full border-2 border-bg-card flex items-center justify-center">
                    <Check size={8} strokeWidth={4} className="text-black" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-[13px] truncate uppercase tracking-tight leading-none">{post.userName}</h4>
                    {(post.userId === currentUser.uid || group.creatorId === currentUser.uid) && (
                      <div className="flex gap-1.5">
                        {post.userId === currentUser.uid && editingPostId !== post.id && (
                          <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); startEdit(post); }} 
                            className="p-2.5 text-muted hover:text-brand-primary transition-colors bg-white/5 rounded-xl active:scale-95 flex items-center justify-center"
                          >
                            <Edit2 size={14} />
                          </button>
                        )}
                        <button 
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDeletePost(post); }} 
                          className={`flex items-center gap-2 p-2.5 transition-all duration-300 rounded-xl active:scale-95 ${
                            deletingPostId === post.id 
                            ? 'bg-red-500 text-white px-4' 
                            : 'bg-white/5 text-muted hover:text-red-500'
                          }`}
                        >
                          {deletingPostId === post.id ? (
                            <>
                              <Trash2 size={14} className="animate-bounce" />
                              <span className="text-[10px] font-black uppercase tracking-tighter italic">Confirmar?</span>
                            </>
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-[9px] text-muted/60 font-black uppercase tracking-[0.15em] mt-1">
                    {formatDistanceToNow(post.createdAt, { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
              </div>

              {editingPostId === post.id ? (
                <div className="space-y-3 bg-black/20 p-4 rounded-2xl border border-brand-primary/20">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-[13px] font-medium text-white outline-none h-24 focus:border-brand-primary transition-all resize-none"
                    placeholder="Edite seu segredo do sucesso..."
                  />
                  <div className="flex justify-end gap-2">
                     <button onClick={() => setEditingPostId(null)} className="text-[10px] font-black uppercase text-muted py-2 px-4 hover:text-white transition-colors">Cancelar</button>
                     <button onClick={() => saveEdit(post)} className="text-[10px] font-black uppercase bg-brand-primary text-black py-2 px-6 rounded-xl hover:scale-105 active:scale-95 transition-all">Salvar</button>
                  </div>
                </div>
              ) : (
                post.type === 'text' && post.content && (
                  <p className="text-sm text-gray-300 font-medium leading-relaxed px-1 whitespace-pre-wrap">{post.content}</p>
                )
              )}

              {post.imageUrl && (
                <div className="rounded-2xl overflow-hidden border border-white/5 w-full bg-black/20 shadow-inner group/img relative cursor-zoom-in">
                  <img 
                    src={post.imageUrl} 
                    alt="Post content" 
                    className="w-full h-auto max-h-[500px] object-cover transition-transform duration-700 hover:scale-105" 
                    loading="lazy"
                  />
                </div>
              )}

              {post.type === 'workout' && post.workoutData && (
                <div className="bg-gradient-to-br from-brand-primary/10 to-brand-primary/5 border border-brand-primary/20 rounded-3xl p-5 space-y-4 relative overflow-hidden group/workout shadow-lg">
                  <div className="absolute -right-4 -bottom-4 text-brand-primary/5 group-hover:rotate-12 transition-transform duration-700">
                    <Trophy size={100} />
                  </div>
                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-brand-primary text-black rounded-2xl flex items-center justify-center shadow-lg rotate-3 group-hover:rotate-0 transition-transform">
                        <Flame size={20} fill="currentColor" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="text-[12px] font-black italic uppercase text-white tracking-tight truncate">{post.workoutData.workoutPlanName || 'Treino Finalizado'}</h5>
                        <p className="text-[9px] font-extrabold text-brand-primary uppercase tracking-widest">Missão Cumprida</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[18px] font-black italic text-brand-primary leading-none tracking-tighter">{(post.workoutData.totalVolume || 0).toLocaleString('pt-BR')}kg</p>
                      <p className="text-[9px] font-bold text-muted uppercase tracking-widest mt-1">Volume</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 relative z-10 border-t border-white/5 pt-4">
                    <div className="flex items-center gap-2">
                       <Dumbbell size={14} className="text-muted" />
                       <p className="text-[10px] font-bold uppercase text-gray-300">{post.workoutData.exercises?.length || 0} Exercícios</p>
                    </div>
                    <div className="flex items-center gap-2">
                       <Timer size={14} className="text-muted" />
                       <p className="text-[10px] font-bold uppercase text-gray-300">{Math.floor((post.workoutData.duration || 0)/60)} Minutos</p>
                    </div>
                  </div>

                  {post.content && post.type === 'workout' && !editingPostId && (
                    <div className="relative z-10 bg-black/30 border border-white/5 rounded-2xl p-3 mt-2 italic shadow-inner">
                      <p className="text-[13px] text-gray-300 font-medium">"{post.content}"</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-6 pt-3 px-1">
                <button 
                  onClick={() => handleLike(post)}
                  className={`flex items-center gap-2 transition-all active:scale-125 ${post.likes.includes(currentUser.uid) ? 'text-brand-primary' : 'text-muted hover:text-white'}`}
                >
                  <div className={`p-2 rounded-full transition-colors ${post.likes.includes(currentUser.uid) ? 'bg-brand-primary/10' : 'bg-white/5 group-hover/post:bg-white/10'}`}>
                    <Heart size={18} fill={post.likes.includes(currentUser.uid) ? "currentColor" : "none"} strokeWidth={2.5} />
                  </div>
                  <span className="text-[11px] font-black tabular-nums">{post.likes.length}</span>
                </button>
                <button 
                  onClick={() => setOpenCommentsPostId(openCommentsPostId === post.id ? null : post.id)}
                  className={`flex items-center gap-2 transition-all ${openCommentsPostId === post.id ? 'text-brand-primary' : 'text-muted hover:text-white'}`}
                >
                  <div className={`p-2 rounded-full transition-colors ${openCommentsPostId === post.id ? 'bg-brand-primary/10' : 'bg-white/5 group-hover/post:bg-white/10'}`}>
                    <MessageSquare size={18} strokeWidth={2.5} />
                  </div>
                  <span className="text-[11px] font-black">{post.comments ? post.comments.length : 0}</span>
                </button>
              </div>

              <AnimatePresence>
                {openCommentsPostId === post.id && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }} 
                    animate={{ height: 'auto', opacity: 1 }} 
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-white/5 mt-2"
                  >
                    <div className="py-4 space-y-4">
                      {post.comments && post.comments.length > 0 ? (
                        <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                            {[...post.comments].sort((a,b) => a.createdAt - b.createdAt).map((comm, idx) => (
                              <div key={idx} className="flex gap-2 group/comment">
                                 <img src={comm.userPhoto || `https://picsum.photos/seed/${comm.userId}/100/100`} alt="" className="w-6 h-6 rounded-lg object-cover shrink-0" referrerPolicy="no-referrer" />
                                 <div className="bg-white/5 rounded-2xl p-2 flex-1 min-w-0 relative">
                                    <div className="flex justify-between items-baseline gap-2">
                                       <span className="text-[9px] font-black uppercase text-brand-primary truncate">{comm.userName}</span>
                                       <div className="flex items-center gap-2">
                                          <span className="text-[7px] text-muted whitespace-nowrap">{formatDistanceToNow(comm.createdAt, { addSuffix: true, locale: ptBR })}</span>
                                          {(comm.userId === currentUser.uid || group.creatorId === currentUser.uid) && (
                                            <button 
                                              type="button"
                                              onClick={(e) => { e.stopPropagation(); handleDeleteComment(post, idx); }}
                                              className={`transition-all duration-300 p-1 flex items-center gap-1 rounded-md ${
                                                deletingCommentId?.postId === post.id && deletingCommentId?.index === idx
                                                ? 'bg-red-500 text-white px-2'
                                                : 'opacity-60 md:opacity-0 group-hover:opacity-100 text-muted hover:text-red-500'
                                              }`}
                                            >
                                              <Trash2 size={10} />
                                              {deletingCommentId?.postId === post.id && deletingCommentId?.index === idx && (
                                                <span className="text-[7px] font-black uppercase italic">Excluir?</span>
                                              )}
                                            </button>
                                          )}
                                       </div>
                                    </div>
                                    <p className="text-[11px] text-gray-300 leading-tight mt-0.5">{comm.text}</p>
                                 </div>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <p className="text-[9px] text-muted text-center py-2 uppercase font-black tracking-widest opacity-50">Nenhum comentário ainda</p>
                      )}

                      <div className="flex gap-2 bg-black/40 p-2 rounded-2xl border border-white/10 group focus-within:border-brand-primary/50 transition-all">
                        <input 
                          type="text" 
                          placeholder="Adicione um comentário..." 
                          value={newCommentText}
                          onChange={(e) => setNewCommentText(e.target.value)}
                          onKeyDown={(e) => { if(e.key === 'Enter') handleAddComment(post); }}
                          className="flex-1 bg-transparent border-none outline-none text-[11px] font-medium text-white px-2 placeholder:text-muted/40"
                        />
                        <button 
                          onClick={() => handleAddComment(post)}
                          disabled={!newCommentText.trim()}
                          className="w-8 h-8 rounded-xl bg-brand-primary text-black flex items-center justify-center hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all"
                        >
                          <Send size={14} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
