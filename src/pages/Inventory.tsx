import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { 
  Package, 
  Search, 
  Plus, 
  AlertTriangle, 
  TrendingUp, 
  History, 
  Filter,
  MoreVertical,
  ArrowUpRight,
  ShoppingCart,
  Loader2,
  Box,
  Layers,
  Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from '../components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/select';
import { Label } from '../components/ui/label';
import { Progress } from '../components/ui/progress';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDate } from '../lib/utils';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { InventoryItem } from '../types';

export default function InventoryPage() {
  const { profile } = useAuthStore();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!profile?.clinicId) return;

    const q = query(
      collection(db, 'inventory'),
      where('clinicId', '==', profile.clinicId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: InventoryItem[] = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() } as InventoryItem));
      setItems(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'inventory');
    });

    return () => unsubscribe();
  }, [profile?.clinicId]);

  const filteredItems = useMemo(() => {
    return items.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [items, searchTerm]);

  const stats = useMemo(() => {
    const critical = items.filter(i => i.quantity <= i.minThreshold).length;
    const categories = new Set(items.map(i => i.category)).size;
    return {
      total: items.length,
      critical,
      categories
    };
  }, [items]);

  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemData, setNewItemData] = useState({
    name: '',
    category: 'Consumables',
    quantity: 0,
    minThreshold: 5,
    unit: 'pcs'
  });

  const handleRegisterAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.clinicId) return;
    try {
      const { addDoc, collection } = await import('firebase/firestore');
      await addDoc(collection(db, 'inventory'), {
        ...newItemData,
        clinicId: profile.clinicId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      setIsAddingItem(false);
      setNewItemData({ name: '', category: 'Consumables', quantity: 0, minThreshold: 5, unit: 'pcs' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'inventory');
    }
  };

  return (
    <div className="flex flex-col gap-10 pb-16">
      <Dialog open={isAddingItem} onOpenChange={setIsAddingItem}>
        <DialogContent className="sm:max-w-[500px] rounded-[2rem] border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-display font-black tracking-tight">Register New Asset</DialogTitle>
            <DialogDescription>Initialize a new inventory node in the clinical warehouse.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRegisterAsset} className="grid gap-6 py-4">
            <div className="grid gap-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Asset Name</Label>
              <Input 
                required
                className="h-12 bg-slate-50 border-none rounded-xl font-bold"
                placeholder="e.g. Latex Gloves (Large)"
                value={newItemData.name}
                onChange={e => setNewItemData({...newItemData, name: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Category</Label>
                <Select value={newItemData.category} onValueChange={v => setNewItemData({...newItemData, category: v})}>
                  <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="Consumables">Consumables</SelectItem>
                    <SelectItem value="Instruments">Instruments</SelectItem>
                    <SelectItem value="Medicine">Medicine</SelectItem>
                    <SelectItem value="Equipment">Equipment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Measurement Unit</Label>
                <Input 
                  className="h-12 bg-slate-50 border-none rounded-xl font-bold"
                  placeholder="pcs, boxes, ml"
                  value={newItemData.unit}
                  onChange={e => setNewItemData({...newItemData, unit: e.target.value})}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Initial Quantity</Label>
                <Input 
                  type="number"
                  className="h-12 bg-slate-50 border-none rounded-xl font-bold"
                  value={newItemData.quantity}
                  onChange={e => setNewItemData({...newItemData, quantity: Number(e.target.value)})}
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Safety Threshold</Label>
                <Input 
                  type="number"
                  className="h-12 bg-slate-50 border-none rounded-xl font-bold"
                  value={newItemData.minThreshold}
                  onChange={e => setNewItemData({...newItemData, minThreshold: Number(e.target.value)})}
                />
              </div>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsAddingItem(false)} className="rounded-xl font-black uppercase text-[10px] tracking-widest">Abort</Button>
              <Button type="submit" className="bg-slate-900 text-white rounded-xl h-12 px-8 font-black uppercase text-[10px] tracking-widest">Commit Asset</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <div className="flex flex-col gap-2 py-4">
        <motion.h1 
          initial={{ opacity: 0, x: -20 }} 
          animate={{ opacity: 1, x: 0 }}
          className="text-4xl font-display font-black tracking-tight text-gradient leading-none"
        >
          Supply Logistics
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, x: -20 }} 
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="text-slate-500 font-medium text-sm"
        >
          Real-time tracking of medical consumables and equipment assets.
        </motion.p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.2 }}
          whileHover={{ y: -8 }}
        >
          <Card className="bento-card border-none bg-white p-2 shadow-sm hover:shadow-2xl transition-all duration-300 cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="h-14 w-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:scale-110 transition-transform">
                    <Box size={28} />
                </div>
                <div className="flex flex-col items-end">
                  <Badge className="bg-slate-100 text-slate-600 border-none font-black text-[9px] tracking-widest px-3 py-1 rounded-full uppercase">Global Stock</Badge>
                  <p className="text-[10px] text-slate-400 font-bold mt-2">{stats.categories} Unique Types</p>
                </div>
              </div>
              <h3 className="text-4xl font-display font-black text-slate-900 tracking-tighter">{stats.total}</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">Total clinical assets assigned</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.3 }}
          whileHover={{ y: -8 }}
        >
          <Card className="bento-card border-none bg-orange-50 shadow-sm hover:shadow-2xl transition-all duration-300 cursor-pointer group">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="h-14 w-14 rounded-2xl bg-white shadow-sm flex items-center justify-center text-orange-400 group-hover:scale-110 transition-transform">
                    <AlertTriangle size={28} />
                </div>
                <Badge className="bg-orange-100 text-orange-700 border-none font-black text-[9px] tracking-widest px-3 py-1 rounded-full uppercase">Replenishment Needed</Badge>
              </div>
              <h3 className="text-4xl font-display font-black text-slate-900 tracking-tighter">{stats.critical}</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">Items below safety threshold</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.4 }}
          whileHover={{ y: -8 }}
        >
          <Card className="bento-card border-none bg-slate-900 text-white shadow-sm hover:shadow-2xl transition-all duration-300 cursor-pointer relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-sky-500/10 to-transparent opacity-50"></div>
            <CardContent className="p-6 relative">
              <div className="flex items-center justify-between mb-6">
                <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform">
                    <Zap size={28} />
                </div>
                <Badge className="bg-white/10 text-sky-300 border-none font-black text-[9px] tracking-widest px-3 py-1 rounded-full uppercase">Usage Velocity</Badge>
              </div>
              <h3 className="text-4xl font-display font-black text-white tracking-tighter">+14<span className="text-lg ml-1 font-bold text-sky-400">%</span></h3>
              <p className="text-xs text-slate-400 font-medium mt-1">Growth in consumable consumption</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>


      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 glass p-5 rounded-[2rem] border border-slate-200/50">
          <div className="relative flex-1 w-full sm:max-w-md group">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-sky-500 transition-colors" />
            <Input
              placeholder="Query assets by name or SKU identifier..."
              className="h-14 border-none bg-slate-50/50 pl-12 rounded-2xl focus:ring-4 focus:ring-sky-500/10 transition-all font-medium text-slate-900"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
             <Button variant="outline" className="h-14 px-6 rounded-2xl border-slate-100 bg-white font-bold text-slate-600 shadow-sm grow sm:grow-0">
                <History size={18} className="mr-2 text-slate-400" />
                Audit Logs
             </Button>
             <Button 
                onClick={() => setIsAddingItem(true)}
                className="h-14 px-8 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-xl shadow-slate-200 grow sm:grow-0"
             >
                <Plus size={18} className="mr-2" />
                Register Asset
             </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-[2.5rem] bg-white shadow-xl shadow-slate-200/30 border border-slate-100">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 border-none hover:bg-slate-50/50">
                <TableHead className="h-16 px-8 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Asset Profile</TableHead>
                <TableHead className="h-16 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Class</TableHead>
                <TableHead className="h-16 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Safety Gradient</TableHead>
                <TableHead className="h-16 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Volume</TableHead>
                <TableHead className="h-16 px-8 text-right text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Session Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence mode="popLayout">
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-64 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Synchronizing Global Warehouse...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-64 text-center">
                      <div className="flex flex-col items-center gap-4 opacity-30">
                        <Package className="h-12 w-12 mx-auto text-slate-400" />
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">No inventory matches your query</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredItems.map((item, index) => {
                  const status = item.quantity === 0 ? 'Out of Stock' : item.quantity <= item.minThreshold ? 'Low Stock' : 'Optimal Space';
                  const percentage = item.minThreshold > 0 ? Math.min((item.quantity / (item.minThreshold * 2.5)) * 100, 100) : 100;
                  
                  return (
                  <motion.tr 
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    key={item.id} 
                    className="hover:bg-slate-50/50 transition-colors border-b border-slate-50 last:border-none"
                  >
                    <TableCell className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                          <Layers size={20} />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-display font-black text-slate-900 tracking-tight">{item.name}</span>
                          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mt-0.5">Asset ID: {item.id.slice(0, 5)}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-slate-100 text-slate-600 border-none font-bold text-[9px] tracking-widest px-3 py-1 rounded-full uppercase">
                        {item.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="w-[200px]">
                       <div className="space-y-2">
                          <div className="flex justify-between items-center">
                             <span className={cn(
                                "text-[9px] font-black uppercase tracking-widest",
                                status === 'Out of Stock' ? "text-red-500" :
                                status === 'Low Stock' ? "text-orange-500" :
                                "text-emerald-500"
                             )}>
                                {status}
                             </span>
                             <span className="text-[10px] font-mono font-bold text-slate-400">{Math.round(percentage)}%</span>
                          </div>
                          <Progress 
                            value={percentage} 
                            className={cn(
                               "h-2 rounded-full overflow-hidden bg-slate-100",
                               status === 'Out of Stock' ? "[&>div]:bg-red-500" :
                               status === 'Low Stock' ? "[&>div]:bg-orange-400" :
                               "[&>div]:bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                            )}
                          />
                       </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-2xl font-display font-black text-slate-900 tracking-tighter">{item.quantity}</span>
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{item.unit} Unit</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-8 text-right">
                      <div className="flex justify-end gap-2">
                         <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-all">
                            <ShoppingCart size={20} />
                         </Button>
                         <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all">
                            <MoreVertical size={20} />
                         </Button>
                      </div>
                    </TableCell>
                  </motion.tr>
                )})}
              </AnimatePresence>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
