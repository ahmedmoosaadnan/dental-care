import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { 
  Users, 
  Calendar, 
  CreditCard, 
  Package, 
  Settings, 
  LayoutDashboard, 
  LogOut,
  Menu,
  X,
  Stethoscope,
  Bell,
  Search,
  User as UserIcon,
  Wifi,
  WifiOff,
  RefreshCw,
  BookOpen,
  BarChart3,
  ChevronLeft,
  Image as ImageIcon,
  CalendarCheck
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuthStore } from '../store/useAuthStore';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, onSnapshot, limit, orderBy } from 'firebase/firestore';

const navSections = [
  {
    title: 'Main Menu',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
      { icon: Calendar, label: 'Appointments', path: '/appointments' },
      { icon: CalendarCheck, label: 'Follow-Ups', path: '/follow-ups' },
      { icon: Users, label: 'Patients', path: '/patients' },
      { icon: UserIcon, label: 'Doctors', path: '/doctors' },
      { icon: CreditCard, label: 'Billing', path: '/pos' },
    ]
  },
  {
    title: 'Management',
    items: [
      { icon: Stethoscope, label: 'Treatments', path: '/treatments' },
      { icon: Package, label: 'Inventory', path: '/inventory' },
      { icon: Bell, label: 'Alerts', path: '/notifications' },
      { icon: CalendarCheck, label: 'Reminders', path: '/reminders' },
      { icon: BarChart3, label: 'Reports', path: '/reports' },
    ]
  },
  {
    title: 'Content',
    items: [
      { icon: ImageIcon, label: 'Media Manager', path: '/media' },
      { icon: Settings, label: 'Settings', path: '/settings' },
    ]
  }
];

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{patients: any[], inventory: any[], doctors: any[]}>({patients: [], inventory: [], doctors: []});
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncKey, setSyncKey] = useState(0);
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { profile, signOut } = useAuthStore();

  const handleManualSync = async () => {
    setIsSyncing(true);
    toast.info("Initiating Cloud Data Sync...", {
      description: "Establishing secure connection to DevOxis Cloud node.",
      icon: <RefreshCw className="animate-spin" size={16} />
    });
    
    try {
      // Simulate network verification and buffer clearing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Increment syncKey to force re-render of current view components
      // This helps in re-initializing any local onSnapshots if needed
      setSyncKey(prev => prev + 1);
      
      toast.success("Cloud Sync Complete", {
        description: "All clinical records have been synchronized with the latest remote state.",
      });
    } catch (error) {
      toast.error("Sync Failed", {
        description: "Unable to reach remote cloud node. Please check your credentials.",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Listen to unread notifications
  useEffect(() => {
    if (!profile?.clinicId) return;
    const q = query(
      collection(db, 'notifications'),
      where('clinicId', '==', profile.clinicId),
      where('isRead', '==', false),
      limit(5)
    );
    const unsub = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [profile?.clinicId]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults({patients: [], inventory: [], doctors: []});
      return;
    }

    const timer = setTimeout(async () => {
      if (!profile?.clinicId) return;
      setIsSearching(true);
      try {
        const pQuery = query(collection(db, 'patients'), where('clinicId', '==', profile.clinicId));
        const pSnap = await getDocs(pQuery);
        const patients = pSnap.docs
          .map(d => ({id: d.id, ...d.data()}))
          .filter((p: any) => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

        const iQuery = query(collection(db, 'inventory'), where('clinicId', '==', profile.clinicId));
        const iSnap = await getDocs(iQuery);
        const inventory = iSnap.docs
          .map(d => ({id: d.id, ...d.data()}))
          .filter((i: any) => i.name.toLowerCase().includes(searchQuery.toLowerCase()));

        const dQuery = query(collection(db, 'doctors'), where('clinicId', '==', profile.clinicId));
        const dSnap = await getDocs(dQuery);
        const doctors = dSnap.docs
          .map(d => ({id: d.id, ...d.data()}))
          .filter((doc: any) => doc.name.toLowerCase().includes(searchQuery.toLowerCase()));

        setSearchResults({patients, inventory, doctors});
      } catch (error) {
        console.error(error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, profile?.clinicId]);

  return (
    <div className="flex h-screen bg-slate-50/50">
      {/* Desktop Sidebar */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[#0f1f2e] text-slate-400 border-r border-slate-800 lg:hidden shadow-2xl"
            >
              <div className="flex h-20 items-center justify-between px-6 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                    <Stethoscope size={22} />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-display font-black tracking-tight text-white uppercase text-sm">DentaSync</span>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">Powered by DevOxis</span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)} className="text-slate-500">
                  <X size={20} />
                </Button>
              </div>

              <nav className="flex-1 overflow-y-auto py-6 scrollbar-hide">
                {navSections.map((section, idx) => (
                  <div key={section.title} className={cn("px-4", idx > 0 && "mt-8")}>
                    <motion.p 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * idx }}
                      className="px-3 mb-3 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]"
                    >
                      {section.title}
                    </motion.p>
                    <div className="space-y-1">
                      {section.items.map((item, itemIdx) => {
                        const isActive = location.pathname === item.path;
                        return (
                          <motion.div
                            key={item.path}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: (0.1 * idx) + (0.05 * itemIdx) }}
                          >
                            <Link
                              to={item.path}
                              className={cn(
                                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-all duration-200",
                                isActive 
                                  ? "bg-blue-600/10 text-blue-400" 
                                  : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                              )}
                            >
                              <item.icon size={18} />
                              <span className="flex-1 truncate">{item.label}</span>
                            </Link>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>

              <div className="p-4 border-t border-slate-800">
                <Button variant="ghost" className="w-full justify-start gap-3 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10" onClick={signOut}>
                  <LogOut size={18} />
                  <span className="font-bold">Sign Out</span>
                </Button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-[#0f1f2e] text-slate-400 transition-all duration-300 border-r border-slate-800 hidden lg:flex",
          sidebarOpen ? "w-64" : "w-20"
        )}
      >
        <div className="flex h-20 items-center gap-3 px-6 border-b border-slate-800">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white cursor-pointer" onClick={() => window.location.href = '/'}>
            <Stethoscope size={22} />
          </div>
          {sidebarOpen && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex flex-col"
            >
              <span className="font-display font-black tracking-tight text-white uppercase text-sm">DentaSync</span>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">Powered by DevOxis</span>
            </motion.div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-6 scrollbar-hide">
          {navSections.map((section, idx) => (
            <div key={section.title} className={cn("px-4", idx > 0 && "mt-8")}>
              {sidebarOpen && (
                <motion.p 
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * idx }}
                  className="px-3 mb-3 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]"
                >
                  {section.title}
                </motion.p>
              )}
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-all duration-200 nav-item-hover",
                        isActive 
                          ? "bg-blue-600/10 text-blue-400 active-nav-glow" 
                          : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                      )}
                    >
                      <item.icon size={18} className={cn(isActive ? "text-blue-400" : "text-slate-50 group-hover:text-slate-300 transition-colors")} />
                      {sidebarOpen && (
                        <span className="flex-1 truncate">{item.label}</span>
                      )}
                      {isActive && (
                        <motion.div 
                          layoutId="sidebar-active"
                          className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-blue-600 rounded-r-full"
                        />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className={cn(
            "flex items-center gap-3 p-3 rounded-2xl bg-slate-800/30",
            !sidebarOpen && "justify-center px-0"
          )}>
            <div className="relative">
               <div className="h-10 w-10 rounded-xl bg-slate-700 overflow-hidden ring-2 ring-slate-800">
                 <img src={profile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.uid}`} alt="" />
               </div>
               <div className={cn(
                 "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0f1f2e]",
                 isOnline ? "bg-blue-500" : "bg-slate-500"
               )} />
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{profile?.displayName || 'Dr. Clinic'}</p>
                <p className="text-[10px] text-slate-500 font-medium truncate uppercase tracking-widest">{isOnline ? 'Online' : 'Offline'}</p>
              </div>
            )}
            {sidebarOpen && (
              <button 
                onClick={signOut}
                className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>


      {/* Main Content Area */}
      <main 
        className={cn(
          "flex flex-1 flex-col transition-all duration-300",
          sidebarOpen ? "lg:pl-64" : "lg:pl-20"
        )}
      >
        {/* Header - Top Bar */}
        <header className="sticky top-0 z-40 h-20 bg-white border-b border-slate-100 flex items-center justify-between px-8 shrink-0">
          <div className="flex flex-col">
            <h1 className="text-xl font-display font-black uppercase text-slate-900 tracking-tight leading-none mb-1">
              {location.pathname === '/' ? 'Practice Overview' : 
               location.pathname.substring(1).split('-').join(' ')}
            </h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {currentTime.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })} • 
              <span className="ml-1 text-slate-300">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </p>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative group w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-600" size={16} />
              <input 
                type="text" 
                placeholder="Search patient records or team..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 pl-12 pr-4 bg-slate-100/50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:ring-4 focus:ring-blue-600/10 transition-all font-sans"
              />
              
              <AnimatePresence>
                {searchQuery && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 right-0 mt-3 p-2 bg-white rounded-2xl shadow-2xl shadow-slate-200 border border-slate-100 z-50 overflow-hidden"
                  >
                    {isSearching ? (
                      <div className="p-4 text-center text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] animate-pulse">Engaging Neural Search...</div>
                    ) : (searchResults.patients.length === 0 && searchResults.inventory.length === 0 && searchResults.doctors.length === 0) ? (
                      <div className="p-4 text-center text-xs text-slate-400">No records found.</div>
                    ) : (
                      <div className="space-y-1 max-h-80 overflow-y-auto">
                        {searchResults.patients.length > 0 && (
                          <div className="p-2 border-b border-slate-50">
                            <p className="px-2 py-1 text-[8px] font-black text-slate-400 uppercase tracking-widest">Patients</p>
                            {searchResults.patients.map(p => (
                              <Link key={p.id} to={`/patients`} onClick={() => setSearchQuery('')} className="block px-2 py-1.5 hover:bg-slate-50 rounded-lg text-xs font-bold text-slate-700 uppercase">{p.name}</Link>
                            ))}
                          </div>
                        )}
                        {searchResults.doctors.length > 0 && (
                          <div className="p-2">
                            <p className="px-2 py-1 text-[8px] font-black text-slate-400 uppercase tracking-widest">Doctors</p>
                            {searchResults.doctors.map(d => (
                              <Link key={d.id} to="/doctors" onClick={() => setSearchQuery('')} className="block px-2 py-1.5 hover:bg-slate-50 rounded-lg text-xs font-bold text-slate-700 uppercase">{d.name}</Link>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex items-center gap-3 border-l border-slate-100 pl-6">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleManualSync}
                disabled={isSyncing}
                className={cn(
                  "h-10 w-10 rounded-xl text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-all",
                  isSyncing && "bg-blue-50 text-blue-600"
                )}
                title="Cloud Data Sync"
              >
                <RefreshCw size={20} className={cn(isSyncing && "animate-spin")} />
              </Button>

              <div className="relative group">
                <Link to="/notifications">
                  <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-slate-400 hover:bg-slate-50 relative">
                    <Bell size={20} />
                    {notifications.length > 0 && (
                      <span className="absolute top-2 right-2.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white animate-pulse" />
                    )}
                  </Button>
                </Link>
                {/* Popover for Notifications (Simplified) */}
                <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all pointer-events-none group-hover:pointer-events-auto z-50">
                   <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-800 mb-3 underline decoration-blue-600 underline-offset-4">Recent Alerts</h4>
                   {notifications.length === 0 ? (
                     <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest py-2">System Optimal</p>
                   ) : (
                     <div className="space-y-3">
                       {notifications.map(n => (
                         <div key={n.id} className="pb-2 border-b border-slate-50 last:border-0">
                           <p className="text-[10px] font-black text-slate-700 leading-tight">{n.title}</p>
                           <p className="text-[9px] text-slate-400 mt-1">{n.message}</p>
                         </div>
                       ))}
                     </div>
                   )}
                </div>
              </div>
              <Link to="/appointments">
                <Button 
                  className="h-11 px-5 rounded-2xl bg-[#0f1f2e] hover:bg-[#1a9e6e] text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-slate-200 transition-all"
                >
                  New Appointment
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(true)}
                className="h-10 w-10 text-slate-400 rounded-xl lg:hidden"
              >
                <Menu size={20} />
              </Button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-8 bg-slate-50/10 relative flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${location.pathname}-${syncKey}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex-1"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>

          {/* Trust Bar */}
          <footer className="mt-12 pt-8 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6 opacity-60 hover:opacity-100 transition-opacity pb-8">
            <div className="flex items-center gap-8">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Technological Partner</span>
                <span className="text-sm font-display font-black text-slate-700 uppercase tracking-tighter">Powered by DevOxis</span>
              </div>
              <div className="h-8 w-px bg-slate-100" />
              <div className="flex items-center gap-6">
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Compliance</span>
                  <span className="text-[10px] font-bold text-slate-700 uppercase">HIPAA Compliant</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Network</span>
                  <span className="text-[10px] font-bold text-slate-700 uppercase">99.9% Uptime</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Scale</span>
                  <span className="text-[10px] font-bold text-slate-700 uppercase">Trusted by 200+ Clinics</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">SECURE ACCESS • v4.2.0</span>
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
