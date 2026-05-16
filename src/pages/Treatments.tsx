import * as React from 'react';
import { 
  Stethoscope, 
  Plus, 
  Search, 
  Edit2, 
  Trash2,
  DollarSign as DollarSignIcon,
  Tag,
  ChevronRight,
  Info
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
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface TreatmentCatalogItem {
  id: string;
  name: string;
  description: string;
  baseCost: number;
  category: string;
  clinicId: string;
}

const CATEGORIES = ['Diagnostic', 'Preventive', 'Restorative', 'Endodontic', 'Periodontal', 'Oral Surgery', 'Orthodontics', 'Cosmetic'];

export default function TreatmentsPage() {
  const { profile } = useAuthStore();
  const [catalog, setCatalog] = React.useState<TreatmentCatalogItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<TreatmentCatalogItem | null>(null);
  
  const [formData, setFormData] = React.useState({
    name: '',
    description: '',
    baseCost: 0,
    category: 'Diagnostic'
  });

  React.useEffect(() => {
    if (!profile?.clinicId) return;

    const q = query(
      collection(db, 'treatmentCatalog'),
      where('clinicId', '==', profile.clinicId)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list: TreatmentCatalogItem[] = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() } as TreatmentCatalogItem));
      setCatalog(list);
      setLoading(false);
    });

    return () => unsub();
  }, [profile?.clinicId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.clinicId) return;

    try {
      if (editingItem) {
        await updateDoc(doc(db, 'treatmentCatalog', editingItem.id), {
          ...formData,
          baseCost: Number(formData.baseCost),
          updatedAt: new Date().toISOString()
        });
        toast.success("Treatment updated");
      } else {
        await addDoc(collection(db, 'treatmentCatalog'), {
          ...formData,
          baseCost: Number(formData.baseCost),
          clinicId: profile.clinicId,
          createdAt: new Date().toISOString()
        });
        toast.success("New treatment added to catalog");
      }
      handleCloseDialog();
    } catch (error) {
      toast.error("Failed to save treatment");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this treatment from catalog?")) return;
    try {
      await deleteDoc(doc(db, 'treatmentCatalog', id));
      toast.success("Treatment removed");
    } catch (error) {
      toast.error("Failed to delete");
    }
  };

  const handleEdit = (item: TreatmentCatalogItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description,
      baseCost: item.baseCost,
      category: item.category
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingItem(null);
    setFormData({
      name: '',
      description: '',
      baseCost: 0,
      category: 'Diagnostic'
    });
  };

  const filteredCatalog = catalog.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Treatment Catalog</h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Standardize your clinical procedures & pricing</p>
        </div>
        <Button 
          onClick={() => setIsDialogOpen(true)}
          className="bg-[#1a9e6e] hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-widest h-11 px-6 rounded-2xl shadow-xl shadow-emerald-900/10"
        >
          <Plus size={16} className="mr-2" /> Add Treatment Type
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <Input 
          placeholder="Search catalog by procedure or category..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-12 h-14 bg-white border-none shadow-sm rounded-2xl text-sm font-bold text-slate-900"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {loading ? (
             Array(3).fill(0).map((_, i) => (
              <div key={i} className="h-48 rounded-[2rem] bg-slate-100 animate-pulse" />
            ))
          ) : filteredCatalog.length === 0 ? (
            <div className="col-span-full py-20 text-center">
               <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Tag size={24} className="text-slate-300" />
              </div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Catalog is empty</p>
            </div>
          ) : filteredCatalog.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <Card className="rounded-[2rem] border-[0.5px] border-slate-200 shadow-sm overflow-hidden hover:border-emerald-200 transition-all duration-300 group">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="h-12 px-3 rounded-xl bg-slate-50 flex items-center gap-2 text-[#1a9e6e]">
                      <DollarSignIcon size={16} />
                      <span className="font-black text-sm">{item.baseCost.toLocaleString()}</span>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleEdit(item)}>
                        <Edit2 size={14} className="text-slate-400 hover:text-[#1a9e6e]" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleDelete(item.id)}>
                        <Trash2 size={14} className="text-slate-400 hover:text-rose-500" />
                      </Button>
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-1">{item.name}</h3>
                  <div className="flex items-center gap-2 mb-4">
                    <Badge variant="outline" className="bg-slate-50 text-slate-400 border-none font-bold text-[9px] uppercase tracking-widest">
                      {item.category}
                    </Badge>
                  </div>

                  <p className="text-[11px] text-slate-400 font-medium mb-4 line-clamp-2">
                    {item.description || 'No detailed description available for this procedure.'}
                  </p>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Standard Service</span>
                    <ChevronRight size={14} className="text-slate-300" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-md rounded-[2rem] border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900 uppercase">
              {editingItem ? 'Edit Procedure' : 'New Catalog Item'}
            </DialogTitle>
            <DialogDescription className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Standardize procedure metadata for the POS system
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Procedure Name</label>
                <Input 
                  required
                  placeholder="e.g. Composite Filling" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="h-12 bg-slate-50 border-none rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Category</label>
                  <select 
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                    className="w-full h-12 bg-slate-50 border-none rounded-xl px-4 text-sm font-bold text-slate-700 outline-none"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Base Cost (PKR)</label>
                  <Input 
                    type="number"
                    required
                    placeholder="3500" 
                    value={formData.baseCost}
                    onChange={e => setFormData({...formData, baseCost: Number(e.target.value)})}
                    className="h-12 bg-slate-50 border-none rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Description</label>
                <textarea 
                  placeholder="Clinical notes or procedural details..." 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full h-24 bg-slate-50 border-none rounded-xl p-4 text-sm font-medium outline-none resize-none"
                />
              </div>
            </div>
            <DialogFooter className="pt-6">
              <Button type="button" variant="ghost" onClick={handleCloseDialog} className="rounded-xl font-bold uppercase text-[10px] tracking-widest">Cancel</Button>
              <Button type="submit" className="bg-[#1a9e6e] hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-widest h-12 px-8 rounded-xl shadow-lg shadow-emerald-900/10">
                {editingItem ? 'Update Logic' : 'Add to Manifest'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
