import * as React from 'react';
import { 
  UserIcon, 
  Plus, 
  Mail, 
  Phone, 
  Clock, 
  MoreVertical, 
  Trash2, 
  Edit2,
  Search,
  Stethoscope
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
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface Doctor {
  id: string;
  name: string;
  specialization: string;
  email: string;
  phone: string;
  availability: string;
  clinicId: string;
  createdAt: string;
}

export default function DoctorsPage() {
  const { profile } = useAuthStore();
  const [doctors, setDoctors] = React.useState<Doctor[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [editingDoctor, setEditingDoctor] = React.useState<Doctor | null>(null);
  
  const [formData, setFormData] = React.useState({
    name: '',
    specialization: '',
    email: '',
    phone: '',
    availability: 'Mon-Fri, 9AM-5PM'
  });

  React.useEffect(() => {
    if (!profile?.clinicId) return;

    const q = query(
      collection(db, 'doctors'),
      where('clinicId', '==', profile.clinicId)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list: Doctor[] = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Doctor));
      setDoctors(list);
      setLoading(false);
    });

    return () => unsub();
  }, [profile?.clinicId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.clinicId) return;

    try {
      if (editingDoctor) {
        await updateDoc(doc(db, 'doctors', editingDoctor.id), {
          ...formData,
          updatedAt: new Date().toISOString()
        });
        toast.success("Doctor profile updated");
      } else {
        await addDoc(collection(db, 'doctors'), {
          ...formData,
          clinicId: profile.clinicId,
          createdAt: new Date().toISOString()
        });
        toast.success("New doctor added");
      }
      handleCloseDialog();
    } catch (error) {
      toast.error("Failed to save doctor");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this doctor?")) return;
    try {
      await deleteDoc(doc(db, 'doctors', id));
      toast.success("Doctor removed");
    } catch (error) {
      toast.error("Failed to delete");
    }
  };

  const handleEdit = (doctor: Doctor) => {
    setEditingDoctor(doctor);
    setFormData({
      name: doctor.name,
      specialization: doctor.specialization,
      email: doctor.email,
      phone: doctor.phone,
      availability: doctor.availability
    });
    setIsAddDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsAddDialogOpen(false);
    setEditingDoctor(null);
    setFormData({
      name: '',
      specialization: '',
      email: '',
      phone: '',
      availability: 'Mon-Fri, 9AM-5PM'
    });
  };

  const filteredDoctors = doctors.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.specialization.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Clinical Practitioners</h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Manage your team of specialized doctors</p>
        </div>
        <Button 
          onClick={() => setIsAddDialogOpen(true)}
          className="bg-[#1a9e6e] hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-widest h-11 px-6 rounded-2xl shadow-xl shadow-emerald-900/10"
        >
          <Plus size={16} className="mr-2" /> Add Practitioner
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <Input 
          placeholder="Search by name or specialization..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-12 h-14 bg-white border-none shadow-sm rounded-2xl text-sm font-bold text-slate-900"
        />
      </div>

      <motion.div 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        variants={{
          hidden: { opacity: 0 },
          show: {
            opacity: 1,
            transition: {
              staggerChildren: 0.1
            }
          }
        }}
        initial="hidden"
        animate="show"
      >
        <AnimatePresence mode="popLayout">
          {loading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="h-48 rounded-[2rem] bg-slate-100 animate-pulse" />
            ))
          ) : filteredDoctors.length === 0 ? (
            <div className="col-span-full py-20 text-center">
              <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Stethoscope size={24} className="text-slate-300" />
              </div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No practitioners found</p>
            </div>
          ) : filteredDoctors.map((doctor) => (
            <motion.div
              key={doctor.id}
              layout
              variants={{
                hidden: { opacity: 0, scale: 0.9, y: 20 },
                show: { opacity: 1, scale: 1, y: 0 }
              }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
            >
              <Card className="rounded-[2rem] border-[0.5px] border-slate-200 shadow-sm overflow-hidden hover:border-emerald-200 transition-all duration-300 group">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="h-14 w-14 rounded-2xl bg-slate-50 flex items-center justify-center text-[#1a9e6e] group-hover:bg-emerald-50 transition-colors">
                      <UserIcon size={24} strokeWidth={2.5} />
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleEdit(doctor)}>
                        <Edit2 size={14} className="text-slate-400 hover:text-[#1a9e6e]" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleDelete(doctor.id)}>
                        <Trash2 size={14} className="text-slate-400 hover:text-rose-500" />
                      </Button>
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-1">{doctor.name}</h3>
                  <Badge variant="outline" className="bg-emerald-50 text-[#1a9e6e] border-none font-bold text-[9px] uppercase tracking-widest mb-4">
                    {doctor.specialization}
                  </Badge>

                  <div className="space-y-2 mt-4 pt-4 border-t border-slate-50">
                    <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                      <Mail size={12} /> {doctor.email}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                      <Phone size={12} /> {doctor.phone}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] font-bold text-[#1a9e6e] uppercase tracking-wide">
                      <Clock size={12} /> {doctor.availability}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      <Dialog open={isAddDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-md rounded-[2rem] border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900 uppercase">
              {editingDoctor ? 'Update Profile' : 'New Practitioner'}
            </DialogTitle>
            <DialogDescription className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Fill in the clinical expertise details
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Full Name</label>
                <Input 
                  required
                  placeholder="e.g. Dr. Ahmed Khan" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="h-12 bg-slate-50 border-none rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Specialization</label>
                <Input 
                  required
                  placeholder="e.g. Orthodontist" 
                  value={formData.specialization}
                  onChange={e => setFormData({...formData, specialization: e.target.value})}
                  className="h-12 bg-slate-50 border-none rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Email</label>
                  <Input 
                    type="email"
                    placeholder="dr@clinic.com" 
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="h-12 bg-slate-50 border-none rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Phone</label>
                  <Input 
                    placeholder="+92 300 1234567" 
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    className="h-12 bg-slate-50 border-none rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Availability</label>
                <Input 
                  placeholder="e.g. Mon-Fri, 10AM-6PM" 
                  value={formData.availability}
                  onChange={e => setFormData({...formData, availability: e.target.value})}
                  className="h-12 bg-slate-50 border-none rounded-xl"
                />
              </div>
            </div>
            <DialogFooter className="pt-6">
              <Button type="button" variant="ghost" onClick={handleCloseDialog} className="rounded-xl font-bold uppercase text-[10px] tracking-widest">Cancel</Button>
              <Button type="submit" className="bg-[#1a9e6e] hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-widest h-12 px-8 rounded-xl shadow-lg shadow-emerald-900/10">
                {editingDoctor ? 'Save Changes' : 'Initialize Profile'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
