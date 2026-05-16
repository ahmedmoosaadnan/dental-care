import * as React from 'react';
import { 
  Plus, 
  Search, 
  Calendar, 
  Clock, 
  User, 
  AlertCircle,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Timer,
  Bell,
  Check,
  Filter,
  ArrowRight,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { useAuthStore } from '../store/useAuthStore';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy, Timestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { toast } from 'sonner';
import { cn, formatDate, toJSDate } from '../lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

interface FollowUp {
  id: string;
  patientId: string;
  patientName: string;
  reason: string;
  dueDate: any;
  status: 'pending' | 'confirmed' | 'missed' | 'completed' | 'rescheduled';
  notes: string;
  priority: 'low' | 'medium' | 'high';
  reminderSent: boolean;
  assignedDoctorId: string;
  createdAt: any;
}

export default function FollowUpsPage() {
  const { profile } = useAuthStore();
  const [followups, setFollowups] = React.useState<FollowUp[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [patients, setPatients] = React.useState<any[]>([]);
  const [doctors, setDoctors] = React.useState<any[]>([]);

  const [newFollowUp, setNewFollowUp] = React.useState({
    patientId: '',
    patientName: '',
    reason: '',
    dueDate: new Date().toISOString().split('T')[0],
    dueTime: '10:00',
    status: 'pending' as FollowUp['status'],
    notes: '',
    priority: 'medium' as FollowUp['priority'],
    assignedDoctorId: ''
  });

  React.useEffect(() => {
    if (!profile?.clinicId) return;

    const q = query(
      collection(db, 'followups'),
      where('clinicId', '==', profile.clinicId)
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: FollowUp[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as FollowUp));
      // Sort manually to avoid index requirement
      setFollowups(list.sort((a, b) => {
        const dateA = toJSDate(a.dueDate)?.getTime() || 0;
        const dateB = toJSDate(b.dueDate)?.getTime() || 0;
        return dateA - dateB;
      }));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'followups'));

    // Fetch patients
    const patientsUnsub = onSnapshot(query(collection(db, 'patients'), where('clinicId', '==', profile.clinicId)), (snap) => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setPatients(list);
    });

    // Fetch doctors
    const doctorsUnsub = onSnapshot(query(collection(db, 'doctors'), where('clinicId', '==', profile.clinicId)), (snap) => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setDoctors(list);
    });

    return () => {
      unsub();
      patientsUnsub();
      doctorsUnsub();
    };
  }, [profile?.clinicId]);

  const handleAddFollowUp = async () => {
    if (!profile?.clinicId || !newFollowUp.patientId || !newFollowUp.dueDate) {
      toast.error("Complete mandatory fields.");
      return;
    }

    const selectedPatient = patients.find(p => p.id === newFollowUp.patientId);
    
    try {
      const dueDate = new Date(`${newFollowUp.dueDate}T${newFollowUp.dueTime}:00`);
      
      await addDoc(collection(db, 'followups'), {
        clinicId: profile.clinicId,
        patientId: newFollowUp.patientId,
        patientName: selectedPatient?.name || 'Unknown',
        reason: newFollowUp.reason,
        dueDate: Timestamp.fromDate(dueDate),
        status: newFollowUp.status,
        notes: newFollowUp.notes,
        priority: newFollowUp.priority,
        assignedDoctorId: newFollowUp.assignedDoctorId,
        reminderSent: false,
        createdAt: serverTimestamp()
      });
      
      setIsAddOpen(false);
      setNewFollowUp({
        patientId: '',
        patientName: '',
        reason: '',
        dueDate: new Date().toISOString().split('T')[0],
        dueTime: '10:00',
        status: 'pending',
        notes: '',
        priority: 'medium',
        assignedDoctorId: ''
      });
      toast.success("Follow-up scheduled successfully.");
    } catch (err) {
      toast.error("Failed to schedule follow-up.");
    }
  };

  const updateStatus = async (id: string, status: FollowUp['status']) => {
    try {
      await updateDoc(doc(db, 'followups', id), { status });
      toast.success(`Follow-up marked as ${status}`);
    } catch (err) {
      toast.error("Status update failed.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Remove this follow-up entry?")) return;
    try {
      await deleteDoc(doc(db, 'followups', id));
      toast.success("Follow-up removed.");
    } catch (err) {
      toast.error("Deletion failed.");
    }
  };

  const filteredFollowUps = followups.filter(f => 
    f.patientName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    f.reason.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-100 text-emerald-600 border-emerald-200';
      case 'missed': return 'bg-rose-100 text-rose-600 border-rose-200';
      case 'confirmed': return 'bg-sky-100 text-sky-600 border-sky-200';
      case 'rescheduled': return 'bg-amber-100 text-amber-600 border-amber-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-display font-black tracking-tight text-slate-900 uppercase">Follow-Up Management</h1>
          <p className="text-slate-500 font-medium">Track post-treatment visits and patient recovery checks.</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={<Button className="h-11 bg-slate-900 hover:bg-slate-800 text-white font-black text-[10px] uppercase tracking-widest px-8 rounded-2xl shadow-xl" />}>
            <div className="flex items-center">
              <Plus size={18} className="mr-2" /> Schedule Follow-Up
            </div>
          </DialogTrigger>
          <DialogContent className="rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden max-w-2xl">
            <div className="bg-[#1a9e6e] p-8 text-white">
              <h3 className="text-2xl font-display font-black tracking-tight uppercase">New Follow-Up Task</h3>
              <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest mt-1">Set recovery checks and future visits</p>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Patient</Label>
                  <Select value={newFollowUp.patientId} onValueChange={(val) => setNewFollowUp({...newFollowUp, patientId: val})}>
                    <SelectTrigger className="h-12 rounded-2xl border-slate-100 bg-slate-50 font-bold">
                      <SelectValue placeholder="Select Patient" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-slate-100">
                      {patients.map(p => (
                        <SelectItem key={p.id} value={p.id} className="rounded-xl">{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Reason / Procedure</Label>
                  <Input 
                    placeholder="e.g. Crown Fitting" 
                    value={newFollowUp.reason}
                    onChange={(e) => setNewFollowUp({...newFollowUp, reason: e.target.value})}
                    className="h-12 rounded-2xl border-slate-100 bg-slate-50 font-bold" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Follow-Up Date</Label>
                  <Input 
                    type="date"
                    value={newFollowUp.dueDate}
                    onChange={(e) => setNewFollowUp({...newFollowUp, dueDate: e.target.value})}
                    className="h-12 rounded-2xl border-slate-100 bg-slate-50 font-bold" 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Preferred Time</Label>
                  <Input 
                    type="time"
                    value={newFollowUp.dueTime}
                    onChange={(e) => setNewFollowUp({...newFollowUp, dueTime: e.target.value})}
                    className="h-12 rounded-2xl border-slate-100 bg-slate-50 font-bold" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Priority</Label>
                  <Select value={newFollowUp.priority} onValueChange={(val: any) => setNewFollowUp({...newFollowUp, priority: val})}>
                    <SelectTrigger className="h-12 rounded-2xl border-slate-100 bg-slate-50 font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-slate-100">
                      <SelectItem value="low" className="rounded-xl">Low</SelectItem>
                      <SelectItem value="medium" className="rounded-xl">Medium</SelectItem>
                      <SelectItem value="high" className="rounded-xl">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Assigned Doctor</Label>
                  <Select value={newFollowUp.assignedDoctorId} onValueChange={(val) => setNewFollowUp({...newFollowUp, assignedDoctorId: val})}>
                    <SelectTrigger className="h-12 rounded-2xl border-slate-100 bg-slate-50 font-bold">
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-slate-100">
                      {doctors.map(d => (
                        <SelectItem key={d.id} value={d.id} className="rounded-xl">{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Internal Notes</Label>
                <textarea 
                  className="w-full min-h-[100px] rounded-2xl border-slate-100 bg-slate-50 p-4 font-bold text-sm focus:ring-2 focus:ring-[#1a9e6e] outline-none"
                  placeholder="Recovery instructions or pending treatment details..."
                  value={newFollowUp.notes}
                  onChange={(e) => setNewFollowUp({...newFollowUp, notes: e.target.value})}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="ghost" onClick={() => setIsAddOpen(false)} className="flex-1 h-12 rounded-2xl font-bold uppercase text-[10px] tracking-widest">Abort</Button>
                <Button 
                  onClick={handleAddFollowUp}
                  className="flex-1 h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl"
                >
                  Finalize Task
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#1a9e6e]" size={18} />
          <Input 
            placeholder="Search by patient name or reason..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-14 pl-12 bg-white border-none rounded-2xl shadow-sm transform transition-all focus:scale-[1.01]"
          />
        </div>
        <Button variant="outline" className="h-14 px-6 rounded-2xl bg-white border-none shadow-sm gap-2 font-bold text-slate-500">
          <Filter size={18} /> Status All
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <AnimatePresence mode="popLayout">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 space-y-4">
              <div className="h-10 w-10 border-4 border-[#1a9e6e] border-t-transparent rounded-full animate-spin" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Compiling recovery timeline...</p>
            </div>
          ) : filteredFollowUps.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-[3rem] p-32 text-center border-2 border-dashed border-slate-100"
            >
              <Timer className="h-16 w-16 mx-auto text-slate-200 mb-6" />
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Zero Follow-Ups Pending</h3>
              <p className="text-slate-500 font-medium mt-2">All post-treatment visits are currently up to date.</p>
            </motion.div>
          ) : (
            filteredFollowUps.map((f, idx) => {
              const overdue = f.status === 'pending' && (() => {
                const due = toJSDate(f.dueDate);
                return due ? due < new Date() : false;
              })();
              
              return (
                <motion.div
                  key={f.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Card className={cn(
                    "rounded-[2.5rem] border-none shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden group",
                    overdue && "bg-rose-50/30"
                  )}>
                    <CardContent className="p-8">
                      <div className="flex flex-col lg:flex-row lg:items-center gap-8">
                        <div className="flex items-center gap-6 lg:w-1/4">
                          <div className={cn(
                            "h-16 w-16 rounded-3xl flex items-center justify-center shrink-0 shadow-inner",
                            f.priority === 'high' ? "bg-rose-100" : f.priority === 'medium' ? "bg-amber-100" : "bg-slate-100"
                          )}>
                            <User size={24} className={cn(
                              f.priority === 'high' ? "text-rose-600" : f.priority === 'medium' ? "text-amber-600" : "text-slate-600"
                            )} />
                          </div>
                          <div>
                            <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">{f.patientName}</h4>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge className={cn("text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full", getStatusColor(f.status))}>
                                {f.status}
                              </Badge>
                              {overdue && (
                                <Badge variant="destructive" className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">
                                  Overdue
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          <div className="space-y-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Procedure / Purpose</p>
                            <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
                              <ArrowRight size={14} className="text-slate-300" />
                              {f.reason}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scheduled Due</p>
                            <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                              <Calendar size={14} className="text-slate-400" />
                              {(() => {
                                const d = toJSDate(f.dueDate);
                                return d ? d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Date Error';
                              })()}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reminder Status</p>
                            <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                              {f.reminderSent ? (
                                <CheckCircle2 size={14} className="text-emerald-500" />
                              ) : (
                                <Bell size={14} className="text-slate-400" />
                              )}
                              {f.reminderSent ? 'Notification Sent' : 'Queued'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 lg:ml-auto border-t lg:border-t-0 lg:border-l border-slate-100 pt-6 lg:pt-0 lg:pl-8">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => updateStatus(f.id, 'completed')}
                            className="h-10 w-10 rounded-2xl text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                          >
                            <Check size={18} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => updateStatus(f.id, 'missed')}
                            className="h-10 w-10 rounded-2xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                          >
                            <XCircle size={18} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-10 w-10 rounded-2xl text-slate-400 hover:bg-slate-100 transition-colors"
                          >
                            <MessageSquare size={18} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDelete(f.id)}
                            className="h-10 w-10 rounded-2xl text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                          >
                            <MoreVertical size={18} />
                          </Button>
                        </div>
                      </div>
                      
                      {f.notes && (
                        <div className="mt-6 pt-6 border-t border-slate-50">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Doctor Notes</p>
                          <p className="text-xs text-slate-500 font-medium leading-relaxed italic">"{f.notes}"</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
