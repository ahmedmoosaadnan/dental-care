import * as React from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  DollarSign as DollarSignIcon, 
  Calendar,
  Download,
  CalendarDays,
  FileText,
  PieChart as PieChartIcon
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { formatCurrency, cn, formatDate, toJSDate } from '../lib/utils';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

const ACCENT_COLOR = '#1a9e6e';
const COLORS = ['#1a9e6e', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5'];

export default function ReportsPage() {
  const { profile } = useAuthStore();
  const [loading, setLoading] = React.useState(true);
  const [invoiceData, setInvoiceData] = React.useState<any[]>([]);
  const [appointmentData, setAppointmentData] = React.useState<any[]>([]);
  
  React.useEffect(() => {
    if (!profile?.clinicId) return;

    const fetchData = async () => {
      try {
        const iQ = query(collection(db, 'invoices'), where('clinicId', '==', profile.clinicId));
        const iSnap = await getDocs(iQ);
        const invoices = iSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setInvoiceData(invoices);

        const aQ = query(collection(db, 'appointments'), where('clinicId', '==', profile.clinicId));
        const aSnap = await getDocs(aQ);
        const appointments = aSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setAppointmentData(appointments);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [profile?.clinicId]);

  const exportReport = () => {
    const data = invoiceData.map(i => ({
      ID: i.id,
      Date: formatDate(i.createdAt),
      Amount: i.totalAmount,
      Status: i.status,
      Method: i.paymentMethod
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Financial Report");
    XLSX.writeFile(wb, `Clinical_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success("Financial audit exported.");
  };

  const revenueByDay = React.useMemo(() => {
    const bins: any = {};
    invoiceData.forEach(i => {
      const d = toJSDate(i.createdAt);
      if (d) {
        const day = d.toLocaleDateString([], { weekday: 'short' });
        bins[day] = (bins[day] || 0) + i.totalAmount;
      }
    });
    return Object.entries(bins).map(([name, value]) => ({ name, value }));
  }, [invoiceData]);

  const appointmentsByStatus = React.useMemo(() => {
    const bins: any = {};
    appointmentData.forEach(a => {
      bins[a.status] = (bins[a.status] || 0) + 1;
    });
    return Object.entries(bins).map(([name, value]) => ({ name, value }));
  }, [appointmentData]);

  const totalRevenue = invoiceData.reduce((acc, i) => acc + (i.totalAmount || 0), 0);
  const totalInvoices = invoiceData.length;
  const totalPatients = new Set(invoiceData.map(i => i.patientId)).size;

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="h-8 w-8 border-4 border-[#1a9e6e] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Compiling Analytics...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Clinical Business Intelligence</h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Deep dive into financial & operational performance</p>
        </div>
        <Button 
          onClick={exportReport}
          className="bg-[#0f1f2e] hover:bg-slate-800 text-white font-black text-[10px] uppercase tracking-widest h-11 px-6 rounded-2xl shadow-xl transition-all"
        >
          <Download size={16} className="mr-2" /> Export Audit Log
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ReportMetric icon={<DollarSignIcon size={20} />} label="Gross Billing" value={formatCurrency(totalRevenue)} color="text-[#1a9e6e]" />
        <ReportMetric icon={<FileText size={20} />} label="Total Invoices" value={totalInvoices} color="text-blue-500" />
        <ReportMetric icon={<Users size={20} />} label="Unique Patients" value={totalPatients} color="text-purple-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-[2rem] border-none shadow-sm bg-white overflow-hidden">
          <CardHeader className="p-8 pb-0">
            <CardTitle className="text-lg font-black uppercase tracking-tight text-slate-800">Revenue Stream</CardTitle>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Financial distribution across the week</p>
          </CardHeader>
          <CardContent className="p-8 h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueByDay}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                <Tooltip 
                   cursor={{ fill: '#f8fafc' }}
                   contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px -5px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="value" fill={ACCENT_COLOR} radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-none shadow-sm bg-white overflow-hidden">
          <CardHeader className="p-8 pb-0">
            <CardTitle className="text-lg font-black uppercase tracking-tight text-slate-800">Appointment Status</CardTitle>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Categorization of reservations</p>
          </CardHeader>
          <CardContent className="p-8 h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={appointmentsByStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {appointmentsByStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                   contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px -5px rgba(0,0,0,0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ReportMetric({ icon, label, value, color }: any) {
  return (
    <Card className="rounded-3xl border-none shadow-sm bg-white p-6">
      <div className={cn("h-10 w-10 flex items-center justify-center rounded-xl bg-slate-50 mb-4", color)}>
        {icon}
      </div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <h3 className="text-xl font-black text-slate-900 tracking-tight">{value}</h3>
    </Card>
  );
}
