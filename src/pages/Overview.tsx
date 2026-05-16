
import * as React from 'react';
import { 
  Users, 
  Calendar, 
  ArrowUpRight, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ChevronRight, 
  ArrowRight,
  Filter,
  Download,
  Plus,
  Bell,
  Search,
  MoreVertical,
  CalendarCheck,
  CircleDollarSign,
  Wallet,
  Receipt,
  TrendingUp,
  Activity
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { cn, toJSDate, formatDate, formatTime, formatCurrency } from '../lib/utils';
import { collection, query, where, onSnapshot, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

const ACCENT_COLOR = '#10b981'; // Emerald 500
const SECONDARY_ACCENT = '#3b82f6'; // Blue 500

export default function OverviewPage() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const [loading, setLoading] = React.useState(true);
  const [analyticsMode, setAnalyticsMode] = React.useState<'revenue' | 'bookings'>('revenue');
  
  const [stats, setStats] = React.useState({
    totalBookings: 0,
    confirmed: 0,
    pendingReview: 0,
    today: 0,
    grossRevenue: 0,
    paidAmount: 0,
    pendingBalance: 0
  });
  
  const [chartData, setChartData] = React.useState<any[]>([]);
  const [recentActivity, setRecentActivity] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (!profile?.clinicId) return;

    // Stream 1: Appointments
    const apptsQ = query(
      collection(db, 'appointments'),
      where('clinicId', '==', profile.clinicId)
    );

    // Stream 2: Invoices (Revenue)
    const invoicesQ = query(
      collection(db, 'invoices'),
      where('clinicId', '==', profile.clinicId)
    );

    let appointments: any[] = [];
    let invoices: any[] = [];

    const updateAllStats = () => {
      const now = new Date();
      const todayStr = now.toLocaleDateString();

      // Appointment Stats
      const totalBookings = appointments.length;
      const confirmed = appointments.filter(a => a.status === 'confirmed' || a.status === 'scheduled' || a.status === 'completed').length;
      const pendingReview = appointments.filter(a => a.status === 'pending' || !a.status).length;
      const today = appointments.filter(a => {
        const d = toJSDate(a.startTime);
        return d ? d.toLocaleDateString() === todayStr : false;
      }).length;

      // Financial Stats
      const grossRevenue = invoices.reduce((acc, i) => acc + (i.totalAmount || 0), 0);
      const paidAmount = invoices.reduce((acc, i) => acc + (i.paidAmount || 0), 0);
      const pendingBalance = grossRevenue - paidAmount;

      setStats({
        totalBookings,
        confirmed,
        pendingReview,
        today,
        grossRevenue,
        paidAmount,
        pendingBalance
      });

      // Unified Recent Activity
      const combined = [
        ...appointments.map(a => ({ ...a, activityType: 'booking', sortDate: toJSDate(a.startTime) })),
        ...invoices.map(i => ({ ...i, activityType: 'invoice', sortDate: toJSDate(i.createdAt) }))
      ]
      .filter(item => item.sortDate)
      .sort((a, b) => (b.sortDate?.getTime() || 0) - (a.sortDate?.getTime() || 0))
      .slice(0, 5);

      setRecentActivity(combined);

      // Analytics Chart Data
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const revenueBins: any = {};
      const bookingBins: any = {};

      invoices.forEach(i => {
        const d = toJSDate(i.createdAt);
        if (d) {
          const dayName = d.toLocaleDateString([], { weekday: 'short' });
          revenueBins[dayName] = (revenueBins[dayName] || 0) + (i.totalAmount || 0);
        }
      });

      appointments.forEach(a => {
        const d = toJSDate(a.startTime);
        if (d) {
          const dayName = d.toLocaleDateString([], { weekday: 'short' });
          bookingBins[dayName] = (bookingBins[dayName] || 0) + 1;
        }
      });

      setChartData(days.map(day => ({ 
        name: day, 
        value: analyticsMode === 'revenue' ? (revenueBins[day] || 0) : (bookingBins[day] || 0)
      })));

      setLoading(false);
    };

    const unsubAppts = onSnapshot(apptsQ, (snapshot) => {
      appointments = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      updateAllStats();
    });

    const unsubInvoices = onSnapshot(invoicesQ, (snapshot) => {
      invoices = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      updateAllStats();
    });

    return () => {
      unsubAppts();
      unsubInvoices();
    };
  }, [profile?.clinicId, analyticsMode]);

  const handleExportData = async () => {
    try {
      const q = query(collection(db, 'invoices'), where('clinicId', '==', profile.clinicId));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({
        InvoiceID: d.id,
        Patient: d.data().patientName,
        Amount: d.data().totalAmount,
        Status: d.data().status,
        Date: formatDate(d.data().createdAt)
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Finances");
      XLSX.writeFile(wb, `Financial_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success("Financial records exported.");
    } catch (error) {
      toast.error("Export failed.");
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-3">
            <Activity className="text-emerald-500" size={24} />
            Clinical Overview
          </h1>
          <p className="text-sm text-slate-500 font-medium tracking-wide">Real-time telemetry for your dental practice.</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline"
            onClick={handleExportData}
            className="border-slate-200 text-slate-600 font-black text-[10px] uppercase tracking-widest rounded-xl px-6 h-11 transition-all hover:bg-slate-50"
          >
            Export Ledger
          </Button>
          <Button 
            onClick={() => navigate('/appointments')}
            className="bg-slate-900 hover:bg-slate-800 text-white font-black text-[10px] uppercase tracking-widest rounded-xl px-6 h-11 shadow-lg shadow-slate-200 transition-all hover:-translate-y-0.5"
          >
            Manage Flow
          </Button>
        </div>
      </div>

      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatItem 
          label="Gross Revenue" 
          value={formatCurrency(stats.grossRevenue)} 
          sub="+14.2%" 
          subColor="text-emerald-500" 
          icon={<CircleDollarSign size={20} className="text-emerald-600" />}
          iconBg="bg-emerald-50"
        />
        <StatItem 
          label="Active Bookings" 
          value={stats.totalBookings} 
          sub="Monthly Volume" 
          subColor="text-slate-400"
          icon={<CalendarCheck size={20} className="text-blue-500" />}
          iconBg="bg-blue-50"
        />
        <StatItem 
          label="Pending Balance" 
          value={formatCurrency(stats.pendingBalance)} 
          sub="Awaiting Payment" 
          subColor="text-rose-500"
          icon={<Wallet size={20} className="text-amber-500" />}
          iconBg="bg-amber-50"
          pulse={stats.pendingBalance > 0}
        />
        <StatItem 
          label="Cases Today" 
          value={stats.today} 
          sub={new Date().toLocaleDateString([], { day: 'numeric', month: 'short' })} 
          subColor="text-slate-400"
          icon={<Activity size={20} className="text-purple-500" />}
          iconBg="bg-purple-50"
        />
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Chart Column */}
        <div className="col-span-12 lg:col-span-8">
          <Card className="rounded-[2.5rem] border-none shadow-sm bg-white p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-black text-slate-800 tracking-tight uppercase">Performance Analytics</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{analyticsMode === 'revenue' ? 'Financial Growth' : 'Patient Volume'} (Last 7 Days)</p>
              </div>
              <div className="flex bg-slate-100 p-1 rounded-2xl">
                 <button 
                  onClick={() => setAnalyticsMode('revenue')}
                  className={cn(
                    "px-4 py-2 text-[10px] font-black uppercase rounded-xl transition-all",
                    analyticsMode === 'revenue' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                 >
                   Revenue
                 </button>
                 <button 
                  onClick={() => setAnalyticsMode('bookings')}
                  className={cn(
                    "px-4 py-2 text-[10px] font-black uppercase rounded-xl transition-all",
                    analyticsMode === 'bookings' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                 >
                   Volume
                 </button>
              </div>
            </div>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorMain" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={analyticsMode === 'revenue' ? ACCENT_COLOR : SECONDARY_ACCENT} stopOpacity={0.15}/>
                      <stop offset="95%" stopColor={analyticsMode === 'revenue' ? ACCENT_COLOR : SECONDARY_ACCENT} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
                    tickFormatter={(val) => analyticsMode === 'revenue' ? `$${val}` : val}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)', padding: '20px' }}
                    labelStyle={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '4px' }}
                    itemStyle={{ color: '#0f172a', fontWeight: '900', fontSize: '18px' }}
                    formatter={(value: any) => [analyticsMode === 'revenue' ? formatCurrency(value) : value, analyticsMode === 'revenue' ? 'Revenue' : 'Bookings']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke={analyticsMode === 'revenue' ? ACCENT_COLOR : SECONDARY_ACCENT} 
                    strokeWidth={4} 
                    fillOpacity={1} 
                    fill="url(#colorMain)" 
                    isAnimationActive={true}
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Quick Actions Column */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <Card className="rounded-[2.5rem] border-none shadow-sm bg-white p-8">
            <h3 className="text-lg font-black text-slate-800 tracking-tight uppercase mb-6">Quick Actions</h3>
            <div className="space-y-3">
              <QuickActionItem 
                icon={<Plus size={18} className="text-emerald-500" />}
                label="New Booking"
                desc="Schedule patient"
                onClick={() => navigate('/appointments')}
              />
              <QuickActionItem 
                icon={<Receipt size={18} className="text-blue-500" />}
                label="Quick Invoice"
                desc="Open POS terminal"
                onClick={() => navigate('/pos')}
              />
              <QuickActionItem 
                icon={<Users size={18} className="text-purple-500" />}
                label="Patient Records"
                desc="Manage directory"
                onClick={() => navigate('/patients')}
              />
            </div>
          </Card>
          
          <div className="rounded-[2.5rem] p-8 bg-gradient-to-br from-slate-900 to-slate-800 text-white relative overflow-hidden group shadow-2xl shadow-slate-200">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
               <TrendingUp size={100} />
            </div>
            <div className="relative z-10">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-2">Practice Insights</h4>
              <p className="text-lg font-black leading-tight mb-6">Your weekly revenue has increased by 15% compared to last cycle.</p>
              <Button 
                onClick={() => navigate('/reports')}
                className="w-full rounded-2xl bg-white/10 hover:bg-white/20 border border-white/10 text-white font-black text-[10px] uppercase tracking-widest h-12 transition-all"
              >
                Deep Intelligence
              </Button>
            </div>
          </div>
        </div>

        {/* Recent Activity Table */}
        <div className="col-span-12">
          <Card className="rounded-[2.5rem] border-none shadow-sm bg-white overflow-hidden">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between">
               <div>
                 <h3 className="text-lg font-black text-slate-800 tracking-tight uppercase">Audit Trail</h3>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent Clinical & Financial Events</p>
               </div>
               <Button variant="ghost" className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-emerald-500">View History</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Reference</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Entity</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount/Time</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">State</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-8 py-10 text-center text-xs font-bold text-slate-400 animate-pulse uppercase tracking-widest">Synchronizing Ledgers...</td>
                    </tr>
                  ) : recentActivity.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-8 py-10 text-center text-slate-300 text-xs font-bold uppercase tracking-widest">No activity detected</td>
                    </tr>
                  ) : recentActivity.map((activity) => (
                    <tr key={activity.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-8 py-5">
                         <div className={cn(
                           "h-8 w-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110",
                           activity.activityType === 'booking' ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
                         )}>
                           {activity.activityType === 'booking' ? <CalendarCheck size={14} /> : <Receipt size={14} />}
                         </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-tighter">
                          {activity.activityType === 'booking' ? `#BK-${activity.id.substring(0, 8).toUpperCase()}` : `#INV-${activity.id.substring(0, 8).toUpperCase()}`}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-800">{activity.patientName}</span>
                          <span className="text-[10px] text-slate-400 uppercase tracking-widest">
                            {activity.activityType === 'booking' ? activity.reason || 'Dental Consultation' : 'Treatment Invoice'}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex flex-col">
                           <span className="text-xs font-bold text-slate-900">
                             {activity.activityType === 'booking' ? formatTime(activity.startTime) : formatCurrency(activity.totalAmount)}
                           </span>
                           <span className="text-[10px] text-slate-400 font-medium">{formatDate(activity.sortDate)}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                         <Badge className={cn(
                           "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border-none",
                           activity.status === 'confirmed' || activity.status === 'paid' ? "bg-emerald-50 text-emerald-600" :
                           activity.status === 'pending' || activity.status === 'unpaid' ? "bg-amber-50 text-amber-600" :
                           "bg-slate-100 text-slate-500"
                         )}>
                            {activity.status?.toUpperCase() || 'UNKNOWN'}
                         </Badge>
                      </td>
                      <td className="px-8 py-5 text-right">
                         <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 transition-all">
                            <MoreVertical size={16} />
                         </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatItem({ label, value, sub, subColor, icon, iconBg, pulse }: any) {
  return (
    <Card className="rounded-[2.5rem] border-none shadow-sm bg-white p-6 hover:shadow-xl transition-all duration-500 group">
      <div className="flex items-center justify-between mb-4">
        <div className={cn("h-11 w-11 flex items-center justify-center rounded-2xl shadow-sm transition-all group-hover:scale-110", iconBg)}>
          {icon}
        </div>
        {pulse && (
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
          </div>
        )}
      </div>
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tighter mb-1.5">{value}</h2>
        <div className="flex items-center gap-2">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">{label}</p>
           {sub && (
             <span className={cn("text-[8px] font-black uppercase tracking-wider flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-slate-50", subColor)}>
               {sub.includes('+') && <TrendingUp size={8} />}
               {sub}
             </span>
           )}
        </div>
      </div>
    </Card>
  );
}

function QuickActionItem({ icon, label, desc, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className="w-full flex items-center justify-between p-5 rounded-[2rem] border border-slate-50 bg-white hover:bg-slate-50 hover:border-emerald-500/20 transition-all duration-300 group shadow-sm hover:shadow-md"
    >
      <div className="flex items-center gap-4 text-left">
        <div className="h-12 w-12 bg-white border border-slate-100 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
          {icon}
        </div>
        <div>
          <p className="text-xs font-black text-slate-900 uppercase tracking-tight group-hover:text-emerald-600 transition-colors">{label}</p>
          <p className="text-[10px] font-bold text-slate-400 tracking-wide mt-1">{desc}</p>
        </div>
      </div>
      <div className="h-8 w-8 rounded-full border border-slate-100 flex items-center justify-center group-hover:bg-emerald-500 group-hover:border-emerald-500 transition-all">
        <ChevronRight size={14} className="text-slate-300 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
      </div>
    </button>
  );
}

function Badge({ children, className, variant }: any) {
  return (
    <span className={cn(
      "px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest rounded-full",
      className
    )}>
      {children}
    </span>
  );
}

