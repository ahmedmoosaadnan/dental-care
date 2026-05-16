import * as React from 'react';
import { 
  Bell, 
  Search, 
  MessageSquare, 
  Calendar, 
  User, 
  CheckCircle2, 
  XCircle,
  Clock,
  Plus,
  Filter,
  ArrowRight
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '../components/ui/dialog';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDate, toJSDate } from '../lib/utils';

interface Reminder {
  id: string;
  patientId: string;
  patientName: string;
  message: string;
  type: 'follow-up' | 'medication' | 'administrative';
  dueDate: string;
  status: 'pending' | 'sent' | 'cancelled';
  clinicId: string;
}

export default function RemindersPage() {
  const { profile } = useAuthStore();
  const [reminders, setReminders] = React.useState<Reminder[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<'all' | 'pending' | 'sent'>('all');
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  
  const [formData, setFormData] = React.useState({
    patientName: '',
    message: '',
    type: 'follow-up' as const,
    dueDate: new Date().toISOString().split('T')[0]
  });

  React.useEffect(() => {
    if (!profile?.clinicId) return;

    const q = query(
      collection(db, 'reminders'),
      where('clinicId', '==', profile.clinicId)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list: Reminder[] = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Reminder));
      // Sort manually to avoid index requirement
      setReminders(list.sort((a, b) => {
        const dateA = toJSDate(a.dueDate)?.getTime() || 0;
        const dateB = toJSDate(b.dueDate)?.getTime() || 0;
        return dateA - dateB;
      }));
      setLoading(false);
    });

    return () => unsub();
  }, [profile?.clinicId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.clinicId) return;

    try {
      await addDoc(collection(db, 'reminders'), {
        ...formData,
        status: 'pending',
        clinicId: profile.clinicId,
        patientId: 'manual-entry', // Simplification for now
        createdAt: new Date().toISOString()
      });
      toast.success("Reminder scheduled");
      setIsDialogOpen(false);
    } catch (error) {
      toast.error("Failed to schedule reminder");
    }
  };

  const markAsSent = async (id: string) => {
    try {
      await updateDoc(doc(db, 'reminders', id), { status: 'sent', updatedat: new Date().toISOString() });
      toast.success("Reminder marked as sent");
    } catch (error) {
      toast.error("Update failed");
    }
  };

  const cancelReminder = async (id: string) => {
    try {
      await updateDoc(doc(db, 'reminders', id), { status: 'cancelled' });
      toast.info("Reminder cancelled");
    } catch (error) {
       toast.error("Operation failed");
    }
  };

  const filteredReminders = reminders.filter(r => {
    if (filter === 'all') return true;
    return r.status === filter;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Patient Reminders</h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Automated & manual follow-up management</p>
        </div>
        <Button 
          onClick={() => setIsDialogOpen(true)}
          className="bg-[#1a9e6e] hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-widest h-11 px-6 rounded-2xl shadow-xl shadow-emerald-900/10"
        >
          <Plus size={16} className="mr-2" /> New Reminder
        </Button>
      </div>

      <div className="flex bg-white p-2 rounded-2xl shadow-sm border border-slate-100 w-fit">
        {(['all', 'pending', 'sent'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              filter === f ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence mode="popLayout">
          {loading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
            ))
          ) : filteredReminders.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-[2rem] border border-dashed border-slate-200">
               <Bell size={40} className="text-slate-200 mx-auto mb-4" />
               <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No reminders currently active</p>
            </div>
          ) : filteredReminders.map((reminder) => (
            <motion.div
              key={reminder.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Card className={cn(
                "rounded-2xl border-[0.5px] border-slate-200 shadow-sm transition-all overflow-hidden",
                reminder.status === 'sent' ? "bg-slate-50/50 opacity-70" : "bg-white hover:border-[#1a9e6e]/30"
              )}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-5">
                    <div className={cn(
                      "h-12 w-12 rounded-xl flex items-center justify-center",
                      reminder.type === 'follow-up' ? "bg-emerald-50 text-emerald-600" :
                      reminder.type === 'medication' ? "bg-blue-50 text-blue-600" :
                      "bg-amber-50 text-amber-600"
                    )}>
                      {reminder.type === 'follow-up' ? <Clock size={20} /> : <MessageSquare size={20} />}
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight mb-0.5">{reminder.patientName}</h3>
                      <p className="text-xs font-medium text-slate-500">{reminder.message}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-10">
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Due Date</p>
                      <p className="text-xs font-bold text-slate-900">{formatDate(reminder.dueDate)}</p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {reminder.status === 'pending' ? (
                        <>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-emerald-500 hover:bg-emerald-50"
                            onClick={() => markAsSent(reminder.id)}
                          >
                            <CheckCircle2 size={18} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-rose-400 hover:bg-rose-50"
                            onClick={() => cancelReminder(reminder.id)}
                          >
                            <XCircle size={18} />
                          </Button>
                        </>
                      ) : (
                        <Badge variant="outline" className={cn(
                          "border-none font-bold text-[9px] uppercase tracking-widest",
                          reminder.status === 'sent' ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
                        )}>
                          {reminder.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md rounded-[2rem] border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900 uppercase">Schedule Notification</DialogTitle>
            <DialogDescription className="text-xs font-bold text-slate-400 uppercase tracking-widest">Set a follow-up trigger for patient care</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Patient Name</label>
                <Input 
                  required
                  placeholder="e.g. Uzair Alvi" 
                  value={formData.patientName}
                  onChange={e => setFormData({...formData, patientName: e.target.value})}
                  className="h-12 bg-slate-50 border-none rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['follow-up', 'medication', 'administrative'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFormData({...formData, type: t})}
                      className={cn(
                        "py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all",
                        formData.type === t ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-100 text-slate-400"
                      )}
                    >
                      {t.split('-')[0]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Reminder Message</label>
                <Input 
                  required
                  placeholder="e.g. Post-scaling follow-up call" 
                  value={formData.message}
                  onChange={e => setFormData({...formData, message: e.target.value})}
                  className="h-12 bg-slate-50 border-none rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Due Date</label>
                <Input 
                  required
                  type="date"
                  value={formData.dueDate}
                  onChange={e => setFormData({...formData, dueDate: e.target.value})}
                  className="h-12 bg-slate-50 border-none rounded-xl"
                />
              </div>
            </div>
            <DialogFooter className="pt-6">
              <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-xl font-bold uppercase text-[10px] tracking-widest">Cancel</Button>
              <Button type="submit" className="bg-[#1a9e6e] hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-widest h-12 px-8 rounded-xl shadow-lg shadow-emerald-900/10">
                Confirm Schedule
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
