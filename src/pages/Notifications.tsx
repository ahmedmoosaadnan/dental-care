
import { useState, useEffect } from 'react';
import { 
  Bell, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  Clock, 
  Search,
  Filter,
  Trash2,
  Calendar,
  User,
  CreditCard,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { useAuthStore } from '../store/useAuthStore';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, writeBatch, getDocs } from 'firebase/firestore';
import { toast } from 'sonner';
import { cn, formatDate, formatTime } from '../lib/utils';

export default function NotificationsPage() {
  const { profile } = useAuthStore();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!profile?.clinicId) return;

    const q = query(
      collection(db, 'notifications'),
      where('clinicId', '==', profile.clinicId)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setNotifications(list.sort((a: any, b: any) => {
        const dateA = new Date(a.createdAt).getTime() || 0;
        const dateB = new Date(b.createdAt).getTime() || 0;
        return dateB - dateA;
      }));
      setLoading(false);
    });

    return () => unsub();
  }, [profile?.clinicId]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { isRead: true });
    } catch (error) {
      console.error(error);
    }
  };

  const markAllAsRead = async () => {
    if (!profile?.clinicId || notifications.length === 0) return;
    const batch = writeBatch(db);
    notifications.filter(n => !n.isRead).forEach(n => {
      batch.update(doc(db, 'notifications', n.id), { isRead: true });
    });
    try {
      await batch.commit();
      toast.success("All clinical alerts cleared.");
    } catch (error) {
      toast.error("Failed to clear alerts.");
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'notifications', id));
      await batch.commit();
      toast.success("Alert dismissed.");
    } catch (error) {
      toast.error("Dismissal failed.");
    }
  };

  const filteredNotifications = notifications.filter(n => {
    const matchesFilter = filter === 'all' || (filter === 'unread' ? !n.isRead : n.isRead);
    const matchesSearch = n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         n.message.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'appointment': return <Calendar size={18} className="text-emerald-500" />;
      case 'billing': return <CreditCard size={18} className="text-blue-500" />;
      case 'patient': return <User size={18} className="text-purple-500" />;
      case 'system': return <AlertCircle size={18} className="text-rose-500" />;
      case 'chat': return <MessageSquare size={18} className="text-amber-500" />;
      default: return <Bell size={18} className="text-slate-400" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2 uppercase">
            Clinical Alerts Centre
            {notifications.filter(n => !n.isRead).length > 0 && (
              <Badge className="bg-rose-500 text-white border-none ml-2">{notifications.filter(n => !n.isRead).length}</Badge>
            )}
          </h1>
          <p className="text-sm font-medium text-slate-500">Intelligent monitoring of your practice activity.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="rounded-xl border-slate-200 text-xs font-bold"
            onClick={markAllAsRead}
            disabled={notifications.filter(n => !n.isRead).length === 0}
          >
            Mark all as read
          </Button>
          <Button variant="ghost" size="icon" className="rounded-xl text-slate-400">
             <Filter size={18} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="space-y-4">
          <Card className="rounded-[2rem] border-none shadow-sm overflow-hidden bg-white">
            <CardContent className="p-4 space-y-1">
              {[
                { id: 'all', label: 'All Alerts', count: notifications.length },
                { id: 'unread', label: 'Unread', count: notifications.filter(n => !n.isRead).length },
                { id: 'read', label: 'Archive', count: notifications.filter(n => n.isRead).length },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setFilter(item.id as any)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                    filter === item.id ? "bg-[#1a9e6e] text-white shadow-lg shadow-emerald-900/10" : "text-slate-500 hover:bg-slate-50"
                  )}
                >
                  {item.label}
                  <span className={cn("text-[10px]", filter === item.id ? "text-white/70" : "text-slate-400")}>{item.count}</span>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-3 space-y-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#1a9e6e]" size={16} />
            <Input 
              placeholder="Search alerts by clinical pattern..." 
              className="pl-12 h-12 rounded-2xl border-none shadow-sm bg-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="py-20 text-center animate-pulse">
                <Bell size={40} className="mx-auto text-slate-200 mb-4" />
                <p className="text-xs font-black text-slate-300 uppercase tracking-[0.2em]">Synchronizing Alert Feed...</p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <Card className="rounded-[2rem] border-none shadow-sm bg-white p-12 text-center">
                 <div className="h-16 w-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={32} className="text-[#1a9e6e]" />
                 </div>
                 <h3 className="text-lg font-bold text-slate-800">System is Optimal</h3>
                 <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">No unread clinical alerts found. Your practice is running smoothly.</p>
              </Card>
            ) : (
              <AnimatePresence mode="popLayout">
                {filteredNotifications.map((n, idx) => (
                  <motion.div
                    key={n.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <Card 
                      className={cn(
                        "rounded-[1.5rem] border-none shadow-sm transition-all group overflow-hidden",
                        n.isRead ? "bg-white/60 opacity-75" : "bg-white ring-1 ring-[#1a9e6e]/10 shadow-emerald-500/5"
                      )}
                      onClick={() => !n.isRead && markAsRead(n.id)}
                    >
                      <CardContent className="p-5">
                        <div className="flex gap-4">
                          <div className={cn(
                            "h-12 w-12 rounded-xl flex items-center justify-center shrink-0",
                            n.isRead ? "bg-slate-100 text-slate-400" : "bg-emerald-50 text-[#1a9e6e]"
                          )}>
                            {getIcon(n.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className={cn(
                                "text-sm font-bold truncate",
                                n.isRead ? "text-slate-500" : "text-slate-900"
                              )}>{n.title}</h4>
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 shrink-0">
                                <Clock size={10} />
                                {formatTime(n.createdAt)}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed mb-3">{n.message}</p>
                            <div className="flex items-center justify-between">
                               <div className="flex items-center gap-3">
                                  <Badge variant="outline" className="rounded-lg text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-slate-100 text-slate-400">
                                     {n.type}
                                  </Badge>
                                  <span className="text-[9px] font-medium text-slate-400">{formatDate(n.createdAt)}</span>
                               </div>
                               <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50" onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}>
                                     <Trash2 size={14} />
                                  </Button>
                               </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
