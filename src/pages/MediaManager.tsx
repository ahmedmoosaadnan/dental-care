import * as React from 'react';
import { 
  Plus, 
  Search, 
  Grid, 
  List, 
  Image as ImageIcon, 
  FileText, 
  MoreVertical, 
  Download, 
  Trash2, 
  ExternalLink,
  ChevronRight,
  Filter,
  Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { useAuthStore } from '../store/useAuthStore';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';

interface MediaAsset {
  id: string;
  name: string;
  url: string;
  patientName: string;
  type: 'x-ray' | 'clinical' | 'document';
  createdAt: any;
  size: string;
}

export default function MediaManagerPage() {
  const { profile } = useAuthStore();
  const [assets, setAssets] = React.useState<MediaAsset[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isUploadOpen, setIsUploadOpen] = React.useState(false);
  
  // Upload Form
  const [newAsset, setNewAsset] = React.useState({
    name: '',
    url: '',
    patientName: '',
    type: 'clinical' as MediaAsset['type']
  });

  React.useEffect(() => {
    if (!profile?.clinicId) return;

    const q = query(
      collection(db, 'media'),
      where('clinicId', '==', profile.clinicId)
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: MediaAsset[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as MediaAsset));
      setAssets(list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      setLoading(false);
    });

    return () => unsub();
  }, [profile?.clinicId]);

  const handleUpload = async () => {
    if (!newAsset.name || !newAsset.url || !profile?.clinicId) {
      toast.error("Complete all fields.");
      return;
    }

    try {
      await addDoc(collection(db, 'media'), {
        ...newAsset,
        clinicId: profile.clinicId,
        size: (Math.random() * 5 + 1).toFixed(1) + ' MB',
        createdAt: serverTimestamp()
      });
      setIsUploadOpen(false);
      setNewAsset({ name: '', url: '', patientName: '', type: 'clinical' });
      toast.success("Clinical asset indexed.");
    } catch (err) {
      toast.error("Registration failed.");
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Permanently remove this clinical asset?")) return;
    try {
      await deleteDoc(doc(db, 'media', id));
      toast.success("Asset purged.");
    } catch (err) {
      toast.error("Operation failed.");
    }
  };

  const filteredAssets = assets.filter(a => 
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    a.patientName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-display font-black tracking-tight text-slate-900 uppercase">Clinical Media Vault</h1>
          <p className="text-slate-500 font-medium">Radiographs, intra-oral scans, and clinical documentation.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-white rounded-xl p-1 border border-slate-100 shadow-sm mr-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setViewMode('grid')}
              className={cn("h-9 w-9 rounded-lg", viewMode === 'grid' && "bg-slate-100 text-slate-900")}
            >
              <Grid size={18} />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setViewMode('list')}
              className={cn("h-9 w-9 rounded-lg", viewMode === 'list' && "bg-slate-100 text-slate-900")}
            >
              <List size={18} />
            </Button>
          </div>
          <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
            <DialogTrigger render={<Button className="h-11 bg-[#1a9e6e] hover:bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest px-8 rounded-2xl shadow-xl shadow-emerald-200/50" />}>
            <div className="flex items-center">
              <Plus size={18} className="mr-2" /> Upload Asset
            </div>
          </DialogTrigger>
            <DialogContent className="rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
               <div className="bg-slate-900 p-8 text-white">
                  <h3 className="text-2xl font-display font-black tracking-tight uppercase">Index Clinical Media</h3>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Register new imaging or records</p>
               </div>
               <div className="p-8 space-y-6">
                  <div className="space-y-4">
                     <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Asset Name</Label>
                        <Input 
                          placeholder="e.g. Posterior Bite-wing R" 
                          value={newAsset.name}
                          onChange={(e) => setNewAsset({...newAsset, name: e.target.value})}
                          className="h-12 rounded-2xl border-slate-100 bg-slate-50 font-bold" 
                        />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                           <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Patient Identifier</Label>
                           <Input 
                             placeholder="Search patient..." 
                             value={newAsset.patientName}
                             onChange={(e) => setNewAsset({...newAsset, patientName: e.target.value})}
                             className="h-12 rounded-2xl border-slate-100 bg-slate-50 font-bold" 
                           />
                        </div>
                        <div className="space-y-1.5">
                           <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Media Category</Label>
                           <select 
                            value={newAsset.type}
                            onChange={(e) => setNewAsset({...newAsset, type: e.target.value as any})}
                            className="w-full h-12 rounded-2xl border-slate-100 bg-slate-50 px-4 font-bold text-sm"
                           >
                             <option value="临床">Clinical Photo</option>
                             <option value="x-ray">Radiograph / X-Ray</option>
                             <option value="document">Consent / Document</option>
                           </select>
                        </div>
                     </div>
                     <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Asset Source URL</Label>
                        <Input 
                          placeholder="Cloud URL or local reference..." 
                          value={newAsset.url}
                          onChange={(e) => setNewAsset({...newAsset, url: e.target.value})}
                          className="h-12 rounded-2xl border-slate-100 bg-slate-50 font-bold" 
                        />
                     </div>
                  </div>
                  <div className="flex gap-3 pt-4">
                     <Button variant="ghost" onClick={() => setIsUploadOpen(false)} className="flex-1 h-12 rounded-2xl font-bold uppercase text-[10px] tracking-widest">Abort</Button>
                     <Button 
                      onClick={handleUpload}
                      className="flex-1 h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl"
                     >
                        Finalize Upload
                     </Button>
                  </div>
               </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[#1a9e6e]" size={18} />
          <Input 
            placeholder="Search by asset name or patient file..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-14 pl-12 bg-white border-none rounded-2xl shadow-sm text-sm font-bold text-slate-900 placeholder:text-slate-400 transition-all font-sans"
          />
        </div>
        <Button variant="outline" className="h-14 px-6 rounded-2xl bg-white border-none shadow-sm text-slate-500 font-bold gap-2">
          <Filter size={18} /> Filters
        </Button>
      </div>

      <AnimatePresence mode="popLayout">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="h-10 w-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scanning clinical archives...</p>
          </div>
        ) : filteredAssets.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[3rem] p-24 text-center border-2 border-dashed border-slate-100"
          >
            <ImageIcon className="h-16 w-16 mx-auto text-slate-200 mb-6" />
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">No assets indexed</h3>
            <p className="text-slate-500 font-medium mt-2">Start by uploading your first clinical radiograph or photo.</p>
          </motion.div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredAssets.map((asset, idx) => (
              <motion.div
                key={asset.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className="group relative rounded-[2rem] border-none shadow-sm hover:shadow-2xl transition-all duration-300 bg-white overflow-hidden scroll-mt-20">
                  <div className="aspect-[4/3] bg-slate-100 relative group overflow-hidden">
                    {asset.type === 'document' ? (
                      <div className="h-full w-full flex items-center justify-center bg-slate-50">
                        <FileText size={48} className="text-slate-300" />
                      </div>
                    ) : (
                      <img 
                        src={asset.url} 
                        alt={asset.name}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                        onError={(e) => {
                          (e.target as any).src = 'https://images.unsplash.com/photo-1576091160550-217359f4708d?w=800&auto=format&fit=crop&q=60';
                        }}
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
                      <div className="flex gap-2 w-full">
                        <Button variant="secondary" className="flex-1 bg-white hover:bg-slate-100 text-slate-900 text-[10px] font-black uppercase rounded-xl h-10 shadow-lg">
                          <Eye size={14} className="mr-2" /> Inspect
                        </Button>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="text-sm font-black text-slate-900 truncate uppercase tracking-tight">{asset.name}</h4>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{asset.patientName}</p>
                      </div>
                      <Badge className={cn(
                        "text-[8px] font-black tracking-widest px-2 py-0.5 rounded-full border-none uppercase",
                        asset.type === 'x-ray' ? "bg-rose-100 text-rose-600" :
                        asset.type === 'document' ? "bg-sky-100 text-sky-600" :
                        "bg-emerald-100 text-emerald-600"
                      )}>
                        {asset.type}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{asset.size}</span>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500" onClick={(e) => handleDelete(asset.id, e)}>
                          <Trash2 size={14} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400 hover:bg-slate-100" onClick={() => window.open(asset.url, '_blank')}>
                          <ExternalLink size={14} />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <Card className="rounded-[2.5rem] border-none shadow-sm bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset Reference</th>
                    <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Patient File</th>
                    <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                    <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Size</th>
                    <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredAssets.map(asset => (
                    <tr key={asset.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center shrink-0 border border-slate-200">
                             {asset.type === 'document' ? <FileText size={20} className="text-slate-400" /> : <img src={asset.url} className="h-full w-full object-cover" />}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800 uppercase tracking-tight">{asset.name}</p>
                            <p className="text-[10px] text-slate-400 font-medium">Recorded {asset.createdAt?.toDate ? asset.createdAt.toDate().toLocaleDateString() : 'Today'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-xs font-black text-slate-700 uppercase tracking-wide">{asset.patientName}</p>
                      </td>
                      <td className="px-6 py-5">
                        <Badge className="bg-slate-100 text-slate-600 border-none text-[8px] font-black uppercase tracking-widest px-2 py-0.5">{asset.type}</Badge>
                      </td>
                      <td className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">{asset.size}</td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                           <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-slate-400 hover:bg-slate-100 transition-colors" onClick={() => window.open(asset.url, '_blank')}><Download size={16} /></Button>
                           <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors" onClick={(e) => handleDelete(asset.id, e)}><Trash2 size={16} /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </AnimatePresence>
    </div>
  );
}
