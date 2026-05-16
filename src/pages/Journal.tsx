import * as React from 'react';
import { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Calendar, 
  Filter, 
  Download, 
  MoreVertical,
  BookOpen,
  User,
  Activity,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthStore } from '../store/useAuthStore';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

interface JournalEntry {
  id: string;
  patientId?: string;
  patientName: string;
  type: 'procedure' | 'consultation' | 'general' | 'follow-up';
  note: string;
  doctorName: string;
  doctorUid: string;
  timestamp: any;
  status: 'draft' | 'finalized';
}

export default function JournalPage() {
  const { profile } = useAuthStore();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [newType, setNewType] = useState<JournalEntry['type']>('general');
  const [newPatient, setNewPatient] = useState('');

  useEffect(() => {
    if (!profile?.clinicId) return;

    const q = query(
      collection(db, 'journal'),
      where('clinicId', '==', profile.clinicId),
      orderBy('timestamp', 'desc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list: JournalEntry[] = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() } as JournalEntry));
      setEntries(list);
      setLoading(false);
    });

    return () => unsub();
  }, [profile?.clinicId]);

  const handleAddEntry = async () => {
    if (!newNote.trim() || !profile?.clinicId) return;

    try {
      await addDoc(collection(db, 'journal'), {
        clinicId: profile.clinicId,
        doctorUid: profile.uid,
        doctorName: profile.displayName || 'Doctor',
        note: newNote,
        type: newType,
        patientName: newPatient || 'General Entry',
        timestamp: serverTimestamp(),
        status: 'finalized'
      });
      setIsAdding(false);
      setNewNote('');
      setNewPatient('');
      toast.success("Journal entry recorded.");
    } catch (err) {
      toast.error("Failed to record entry.");
    }
  };

  const filteredEntries = entries.filter(e => 
    e.note.toLowerCase().includes(searchQuery.toLowerCase()) || 
    e.patientName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-display font-black tracking-tight text-slate-900 uppercase">Clinical Journal</h1>
          <p className="text-slate-500 font-medium">Systematic records of all clinical interactions and observations.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setIsAdding(true)}
            className="h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold px-6 shadow-xl shadow-slate-200"
          >
            <Plus size={18} className="mr-2" /> New Entry
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Sidebar Filters */}
        <div className="col-span-12 lg:col-span-3 space-y-6">
          <Card className="p-6 rounded-[2rem] border-slate-100 shadow-xl shadow-slate-200/50">
             <div className="relative mb-6">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
               <Input 
                 placeholder="Search entries..." 
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="pl-10 h-11 rounded-xl border-slate-100 bg-slate-50/50" 
               />
             </div>
             
             <div className="space-y-4">
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Quick Filters</h4>
               <div className="grid grid-cols-1 gap-2">
                 {['procedure', 'consultation', 'general', 'follow-up'].map(type => (
                   <button key={type} className="flex items-center justify-between px-4 py-3 rounded-2xl hover:bg-slate-50 text-slate-600 transition-all font-bold text-xs uppercase tracking-tight border border-transparent hover:border-slate-100">
                     <span className="flex items-center gap-2 capitalize">
                       <div className={cn(
                         "w-2 h-2 rounded-full",
                         type === 'procedure' ? "bg-rose-500" : 
                         type === 'consultation' ? "bg-emerald-500" :
                         type === 'follow-up' ? "bg-sky-500" : "bg-slate-300"
                       )} />
                       {type}s
                     </span>
                     <ChevronRight size={14} className="text-slate-300" />
                   </button>
                 ))}
               </div>
             </div>
          </Card>

          <Card className="p-8 rounded-[2rem] bg-indigo-600 text-white border-none shadow-2xl shadow-indigo-200 overflow-hidden relative">
             <BookOpen className="absolute -right-8 -bottom-8 w-40 h-40 opacity-10" />
             <div className="relative">
               <h3 className="text-xl font-bold mb-2">Weekly Summary</h3>
               <p className="text-indigo-100 text-xs mb-6">You've recorded 12 notes across 8 clinical cases this week.</p>
               <Button className="w-full bg-white text-indigo-600 hover:bg-indigo-50 rounded-xl font-bold text-xs">Analytics</Button>
             </div>
          </Card>
        </div>

        {/* Content Area */}
        <div className="col-span-12 lg:col-span-9 space-y-6">
          <AnimatePresence>
            {isAdding && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                className="bg-white p-8 rounded-[2.5rem] shadow-2xl shadow-slate-200 border border-slate-100 space-y-6"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-black text-slate-900 uppercase">Drafting New Entry</h3>
                  <Button variant="ghost" onClick={() => setIsAdding(false)} className="rounded-full h-8 w-8 p-0">×</Button>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Case / Patient</Label>
                    <Input 
                      placeholder="e.g. John Smith" 
                      value={newPatient}
                      onChange={(e) => setNewPatient(e.target.value)}
                      className="h-12 rounded-2xl border-slate-100 bg-slate-50 font-bold" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Context Type</Label>
                    <select 
                      value={newType}
                      onChange={(e) => setNewType(e.target.value as any)}
                      className="w-full h-12 rounded-2xl border-slate-100 bg-slate-50 px-4 font-bold text-sm"
                    >
                      <option value="general">General Note</option>
                      <option value="procedure">Clinical Procedure</option>
                      <option value="consultation">Initial Consultation</option>
                      <option value="follow-up">Post-Op / Follow-up</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Observations & Notes</Label>
                  <textarea 
                    placeholder="Describe the clinical findings, procedure details, or recommendations..." 
                    className="w-full min-h-[150px] p-6 rounded-3xl border-slate-100 bg-slate-50 font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                  />
                </div>

                <div className="flex justify-end gap-3">
                   <Button variant="ghost" onClick={() => setIsAdding(false)} className="h-12 px-6 rounded-2xl font-bold text-slate-500">Cancel</Button>
                   <Button 
                    onClick={handleAddEntry}
                    className="h-12 px-8 bg-sky-500 hover:bg-sky-600 text-white rounded-2xl font-black shadow-xl shadow-sky-100 uppercase text-xs tracking-widest"
                   >
                     Finalize & Record
                   </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-4">
             {loading ? (
               <div className="p-12 text-center text-slate-400">Loading neural log...</div>
             ) : filteredEntries.length === 0 ? (
               <div className="p-20 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-100">
                  <BookOpen className="mx-auto h-12 w-12 text-slate-200 mb-4" />
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No matching entries found.</p>
               </div>
             ) : filteredEntries.map((entry, idx) => (
               <motion.div 
                key={entry.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="group p-8 bg-white rounded-[2.5rem] shadow-sm border border-slate-50 transition-all hover:shadow-2xl hover:shadow-slate-200/50 hover:border-slate-100"
               >
                 <div className="flex flex-col md:flex-row md:items-start gap-6">
                    <div className="flex flex-col items-center w-24 shrink-0 pt-2">
                       <span className="text-xl font-black text-slate-900">{entry.timestamp?.toDate ? entry.timestamp.toDate().toLocaleDateString([], { day: '2-digit', month: 'short' }) : 'Pending'}</span>
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{entry.timestamp?.toDate ? entry.timestamp.toDate().getFullYear() : ''}</span>
                       <div className="mt-4 pt-4 border-t border-slate-50 w-full flex flex-col items-center">
                          <Clock size={16} className="text-slate-300 mb-1" />
                          <span className="text-[10px] font-bold text-slate-500">{entry.timestamp?.toDate ? entry.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                       </div>
                    </div>

                    <div className="flex-1 space-y-4">
                       <div className="flex flex-wrap items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                             <div className={cn(
                               "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border-none text-white",
                               entry.type === 'procedure' ? "bg-rose-500" : 
                               entry.type === 'consultation' ? "bg-emerald-500" :
                               entry.type === 'follow-up' ? "bg-sky-500" : "bg-slate-400"
                             )}>
                               {entry.type}
                             </div>
                             <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                               {entry.patientName}
                               <span className="text-slate-300">/</span>
                               <span className="text-sm font-medium text-slate-500">{entry.doctorName}</span>
                             </h3>
                          </div>
                          <div className="flex gap-2">
                             <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-slate-50 text-slate-400"><Download size={18} /></Button>
                             <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-slate-50 text-slate-400"><MoreVertical size={18} /></Button>
                          </div>
                       </div>
                       
                       <div className="p-6 bg-slate-50 rounded-3xl text-sm font-medium text-slate-600 leading-relaxed italic border border-slate-100">
                         "{entry.note}"
                       </div>

                       <div className="flex items-center gap-6 pt-2">
                          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                             <Activity size={14} className="text-emerald-500" /> Vitals OK
                          </div>
                          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                             <CheckCircle2 size={14} className="text-sky-500" /> Verified
                          </div>
                       </div>
                    </div>
                 </div>
               </motion.div>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
}
