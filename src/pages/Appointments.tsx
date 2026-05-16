import { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Clock, 
  User, 
  Search,
  MoreVertical,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Stethoscope,
  ArrowUpRight
} from 'lucide-react';
import { Calendar } from '../components/ui/calendar';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
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
import { Input } from '../components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { cn, formatDate, formatTime, toJSDate } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { Appointment, Patient, AppointmentStatus } from '../types';
import { toast } from 'sonner';

const timeSlots = [
  '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
  '01:00 PM', '01:30 PM', '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM'
];

export default function AppointmentsPage() {
  const { profile } = useAuthStore();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [treatmentCatalog, setTreatmentCatalog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [view, setView] = useState<'day' | 'week'>('day');
  const [isBookingOpen, setIsBookingOpen] = useState(false);

  // New Appointment Form
  const [newAppt, setNewAppt] = useState({
    patientId: '',
    doctorId: '',
    procedureType: '',
    date: new Date().toISOString().split('T')[0],
    time: ''
  });

  useEffect(() => {
    if (!profile?.clinicId) return;

    // Fetch Patients for selection
    const patientsQ = query(
      collection(db, 'patients'),
      where('clinicId', '==', profile.clinicId)
    );
    const unsubPatients = onSnapshot(patientsQ, (snapshot) => {
      const list: Patient[] = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() } as Patient));
      setPatients(list);
    });

    // Fetch Doctors
    const doctorsQ = query(collection(db, 'doctors'), where('clinicId', '==', profile.clinicId));
    const unsubDoctors = onSnapshot(doctorsQ, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
      setDoctors(list);
    });

    // Fetch Treatments
    const treatmentsQ = query(collection(db, 'treatmentCatalog'), where('clinicId', '==', profile.clinicId));
    const unsubTreatments = onSnapshot(treatmentsQ, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
      setTreatmentCatalog(list);
    });

    // Fetch Appointments
    const q = query(
      collection(db, 'appointments'),
      where('clinicId', '==', profile.clinicId)
    );

    const unsubAppts = onSnapshot(q, (snapshot) => {
      const list: Appointment[] = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() } as Appointment));
      setAppointments(list);
      setLoading(false);
    });

    return () => {
      unsubPatients();
      unsubDoctors();
      unsubTreatments();
      unsubAppts();
    };
  }, [profile?.clinicId]);

  const convertTimeTo24h = (timeStr: string) => {
    if (!timeStr) return "00:00";
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':');
    if (hours === '12') hours = '00';
    if (modifier === 'PM') hours = (parseInt(hours, 10) + 12).toString();
    return `${hours.padStart(2, '0')}:${minutes}`;
  };

  const handleCreateBooking = async () => {
    if (!profile?.clinicId || !newAppt.patientId || !newAppt.time) {
      toast.error("Please select a patient and a time slot.");
      return;
    }
    
    const selectedPatient = patients.find(p => p.id === newAppt.patientId);
    const selectedDoctor = doctors.find(d => d.id === newAppt.doctorId);
    
    try {
      const time24 = convertTimeTo24h(newAppt.time);
      const startTime = `${newAppt.date}T${time24}:00`;
      // Basic 30min appointment duration
      const startDate = new Date(startTime);
      
      if (isNaN(startDate.getTime())) {
        throw new Error("Invalid time value: The combination of date and time provided is not recognized.");
      }

      const endDate = new Date(startDate.getTime() + 30 * 60000);
      const endTime = endDate.toISOString();

      await addDoc(collection(db, 'appointments'), {
        clinicId: profile.clinicId,
        patientId: newAppt.patientId,
        patientName: selectedPatient?.name || 'Unknown',
        doctorId: newAppt.doctorId,
        doctorName: selectedDoctor?.name || 'Dr. Not Assigned',
        startTime: startDate.toISOString(), // Use standard ISO string
        endTime,
        reason: newAppt.procedureType || 'General Checkup',
        status: AppointmentStatus.SCHEDULED,
        updatedAt: new Date().toISOString()
      });
      setIsBookingOpen(false);
      toast.success("Appointment secured.");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'appointments');
    }
  };

  const isExpired = (startTime: string | any, status: string) => {
    if (['completed', 'cancelled', 'in-treatment', 'checked-in'].includes(status)) return false;
    const start = toJSDate(startTime);
    return start ? start < new Date() : false;
  };

  const [viewingAppt, setViewingAppt] = useState<Appointment | null>(null);

  const handleStatusUpdate = async (appt: Appointment, status: AppointmentStatus | 'cancelled') => {
    if (['completed', 'cancelled'].includes(appt.status)) {
      toast.error(`This appointment is already ${appt.status} and cannot be modified.`);
      return;
    }

    const confirmMessage = status === 'cancelled' 
      ? "Are you sure you want to cancel this appointment?" 
      : `Update appointment status to ${status}?`;

    if (!window.confirm(confirmMessage)) return;

    try {
      const historyAction = {
        status,
        timestamp: new Date().toISOString(),
        note: `Status updated to ${status}`
      };

      await updateDoc(doc(db, 'appointments', appt.id), { 
        status,
        updatedAt: new Date().toISOString(),
        actions: [...(appt.actions || []), historyAction]
      });
      toast.success(`Appointment marked as ${status}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'appointments');
    }
  };

  return (
    <div className="flex flex-col h-full gap-8">
      <div className="flex flex-col gap-2 py-4">
        <motion.h1 
          initial={{ opacity: 0, x: -20 }} 
          animate={{ opacity: 1, x: 0 }}
          className="text-4xl font-display font-black tracking-tight text-gradient leading-none"
        >
          Clinical Schedule
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, x: -20 }} 
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="text-slate-500 font-medium text-sm"
        >
          Coordinate visits and medical procedures across the clinic.
        </motion.p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 flex-1 overflow-hidden">
        {/* Calendar Picker Column */}
        <div className="lg:col-span-4 lg:sticky lg:top-0 h-fit space-y-8">
           <Card className="bento-card p-4 overflow-hidden bg-white border-none shadow-xl shadow-slate-200/50">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                className="w-full pointer-events-auto"
              />
           </Card>

           <Card className="bento-card bg-slate-900 text-white border-none shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-sky-500/10 to-transparent opacity-50"></div>
              <CardContent className="p-8 relative space-y-6">
                 <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-white/10 pb-4">Status Intelligence</h3>
                 <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                    <div className="flex items-center gap-3 group/item">
                       <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-100 group-hover/item:text-white transition-colors">CONFIRMED</span>
                    </div>
                    <div className="flex items-center gap-3 group/item">
                       <div className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]" />
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-100 group-hover/item:text-white transition-colors">CHECKED-IN</span>
                    </div>
                    <div className="flex items-center gap-3 group/item">
                       <div className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-100 group-hover/item:text-white transition-colors">PENDING</span>
                    </div>
                    <div className="flex items-center gap-3 group/item opacity-40">
                       <div className="h-2 w-2 rounded-full bg-white/50" />
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-100 group-hover/item:text-white transition-colors">CANCELLED</span>
                    </div>
                 </div>
              </CardContent>
           </Card>
        </div>

        {/* Schedule View Column */}
        <div className="lg:col-span-8 flex flex-col gap-6 overflow-auto min-h-0 pr-4">
           <div className="flex items-center justify-between glass p-4 rounded-3xl border border-slate-200/50">
              <div className="flex items-center gap-4">
                 <div>
                    <h2 className="text-xl font-display font-black text-slate-900 tracking-tight">{date ? formatDate(date) : 'Select Date'}</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Clinic Timeline</p>
                 </div>
                 <Badge className="bg-sky-50 text-sky-600 border border-sky-100 text-[10px] font-black tracking-widest px-3 py-1 rounded-full uppercase">TODAY</Badge>
              </div>
              <div className="flex items-center gap-3">
                 <div className="flex items-center gap-1.5 mr-2">
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-slate-100"><ChevronLeft size={20} /></Button>
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-slate-100"><ChevronRight size={20} /></Button>
                 </div>
                 <Dialog open={isBookingOpen} onOpenChange={setIsBookingOpen}>
                    <DialogTrigger render={<Button className="h-11 px-8 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-lg shadow-slate-200 cursor-pointer" />}>
                       + Book Slot
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[550px] rounded-[2.5rem] border-none shadow-2xl">
                       <DialogHeader className="p-4">
                          <DialogTitle className="text-2xl font-display font-black tracking-tight">Schedule clinical visit</DialogTitle>
                          <DialogDescription>Assign a medical examiner and procedure to a patient record.</DialogDescription>
                       </DialogHeader>
                       <div className="grid gap-6 py-4 px-4">
                          <div className="grid gap-2">
                             <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target Patient</Label>
                             <Select 
                               value={newAppt.patientId} 
                               onValueChange={(v) => setNewAppt({...newAppt, patientId: v})}
                             >
                                <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none font-medium">
                                   <SelectValue placeholder="Identify patient file..." />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-slate-100 shadow-2xl">
                                   {patients.map(p => (
                                     <SelectItem key={p.id} value={p.id!} className="rounded-xl">{p.name}</SelectItem>
                                   ))}
                                </SelectContent>
                             </Select>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                              <div className="grid gap-2">
                                 <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Medical Examiner</Label>
                                 <Select 
                                   value={newAppt.doctorId} 
                                   onValueChange={(v) => setNewAppt({...newAppt, doctorId: v})}
                                 >
                                    <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none">
                                       <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl border-slate-100">
                                       {doctors.map(d => (
                                         <SelectItem key={d.id} value={d.id} className="rounded-xl">{d.name}</SelectItem>
                                       ))}
                                    </SelectContent>
                                 </Select>
                              </div>
                              <div className="grid gap-2">
                                 <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nature of visit</Label>
                                 <Select 
                                   value={newAppt.procedureType} 
                                   onValueChange={(v) => setNewAppt({...newAppt, procedureType: v})}
                                 >
                                    <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none">
                                       <SelectValue placeholder="Procedure..." />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl border-slate-100">
                                       {treatmentCatalog.map(t => (
                                         <SelectItem key={t.id} value={t.name} className="rounded-xl">{t.name}</SelectItem>
                                       ))}
                                    </SelectContent>
                                 </Select>
                              </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                              <div className="grid gap-2">
                                 <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Appointment Date</Label>
                                 <Input 
                                   type="date" 
                                   className="h-12 rounded-2xl bg-slate-50 border-none"
                                   value={newAppt.date}
                                   onChange={(e) => setNewAppt({...newAppt, date: e.target.value})}
                                 />
                              </div>
                              <div className="grid gap-2">
                                 <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Temporal Slot</Label>
                                 <Select 
                                   value={newAppt.time} 
                                   onValueChange={(v) => setNewAppt({...newAppt, time: v})}
                                 >
                                    <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none">
                                       <SelectValue placeholder="Pick time" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl border-slate-100">
                                       {timeSlots.map(t => <SelectItem key={t} value={t} className="rounded-xl">{t}</SelectItem>)}
                                     </SelectContent>
                                 </Select>
                              </div>
                          </div>
                       </div>
                       <DialogFooter className="p-4 gap-2">
                          <Button variant="ghost" className="rounded-2xl font-bold text-slate-400 hover:text-slate-900" onClick={() => setIsBookingOpen(false)}>Discard</Button>
                          <Button type="button" className="h-12 px-8 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold" onClick={handleCreateBooking}>Confirm Booking</Button>
                       </DialogFooter>
                    </DialogContent>
                 </Dialog>
              </div>
           </div>

           <div className="space-y-4 py-4">
             {timeSlots.map((slot) => {
                const selectedDateStr = date ? date.toISOString().split('T')[0] : '';
                const slot24 = convertTimeTo24h(slot);
                
                const appointment = appointments.find(a => {
                  const startStr = a.startTime?.toString() || '';
                  const apptDate = startStr.split('T')[0];
                  const apptTime = formatTime(a.startTime);
                  return apptDate === selectedDateStr && apptTime === slot;
                });
               return (
                  <div key={slot} className="group relative flex items-start gap-8">
                     <div className="w-20 pt-2 text-right">
                        <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase">{slot}</span>
                     </div>
                     <div className="relative flex-1 pb-8">
                        <div className="absolute left-[-20px] top-4 h-px w-6 bg-slate-100 group-hover:bg-sky-200 transition-colors" />
                        <div className="absolute left-[-22px] top-[-10px] bottom-0 w-px bg-slate-50 group-hover:bg-slate-100 transition-colors" />
                        
                        {appointment ? (
                           <motion.div 
                            initial={{ scale: 0.98, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className={cn(
                              "rounded-[2rem] p-6 bento-card transition-all duration-300 hover:shadow-2xl hover:shadow-slate-200/50 cursor-pointer border-none",
                              appointment.status === 'confirmed' ? "bg-emerald-50/50 shadow-[inset_0_0_20px_rgba(52,211,153,0.05)]" :
                              appointment.status === 'checked-in' ? "bg-sky-50/50 shadow-[inset_0_0_20px_rgba(56,189,248,0.05)]" :
                              "bg-amber-50/50 shadow-[inset_0_0_20px_rgba(251,191,36,0.05)]"
                            )}
                           >
                              <div className="flex items-center justify-between">
                                 <div className="flex items-center gap-5">
                                    <div className={cn(
                                       "flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg ring-4 ring-white",
                                       appointment.status === 'confirmed' ? "bg-emerald-500 text-white shadow-emerald-200" :
                                       appointment.status === 'checked-in' ? "bg-sky-500 text-white shadow-sky-200" :
                                       "bg-amber-500 text-white shadow-amber-200"
                                    )}>
                                       <User size={24} />
                                    </div>
                                    <div>
                                       <div className="flex items-center gap-3">
                                          <p className="font-display font-black text-lg text-slate-900 tracking-tight">{appointment.patientName}</p>
                                          <Badge className={cn(
                                            "text-[8px] font-black tracking-[0.2em] px-2 py-0.5 rounded-full uppercase border-none",
                                            isExpired(appointment.startTime, appointment.status) ? "bg-rose-100 text-rose-700" :
                                            appointment.status === 'confirmed' ? "bg-emerald-100 text-emerald-700" :
                                            appointment.status === 'checked-in' ? "bg-sky-100 text-sky-700" :
                                            "bg-amber-100 text-amber-700"
                                          )}>{isExpired(appointment.startTime, appointment.status) ? 'EXPIRED' : appointment.status}</Badge>
                                       </div>
                                       <div className="flex items-center gap-4 text-xs font-medium text-slate-500 mt-1">
                                          <span className="flex items-center gap-1.5"><Clock size={14} className="text-slate-300" /> {slot}</span>
                                          <span className="flex items-center gap-1.5"><Stethoscope size={14} className="text-slate-300" /> {appointment.reason}</span>
                                          <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded-lg text-slate-600">
                                            {appointment.doctorName}
                                          </span>
                                       </div>
                                    </div>
                                 </div>
                                 <div className="flex items-center gap-2">
                                                                         <Button 
                                       variant="ghost" 
                                       size="icon" 
                                       className="h-10 w-10 rounded-xl hover:bg-white text-slate-400 hover:text-slate-900"
                                       onClick={() => setViewingAppt(appointment)}
                                     >
                                       <ArrowUpRight size={18} />
                                     </Button>
                                    <DropdownMenu>
                                       <DropdownMenuTrigger render={<button className="h-10 w-10 rounded-xl hover:bg-white flex items-center justify-center cursor-pointer" />}>
                                          <MoreVertical size={18} className="text-slate-400" />
                                       </DropdownMenuTrigger>
                                       <DropdownMenuContent align="end" className="rounded-2xl border-slate-100 shadow-2xl w-48">
                                          <DropdownMenuItem 
                                            onClick={() => handleStatusUpdate(appointment, AppointmentStatus.CHECKED_IN)}
                                            className="rounded-xl focus:bg-sky-50 focus:text-sky-600 font-bold text-xs uppercase tracking-widest p-3"
                                          >
                                            Check-in Patient
                                          </DropdownMenuItem>
                                          <DropdownMenuItem 
                                            onClick={() => handleStatusUpdate(appointment, AppointmentStatus.COMPLETED)}
                                            className="rounded-xl focus:bg-emerald-50 focus:text-emerald-600 font-bold text-xs uppercase tracking-widest p-3"
                                          >
                                            Complete Pulse
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem 
                                            onClick={() => handleStatusUpdate(appointment, 'cancelled' as any)}
                                            className="rounded-xl text-red-600 focus:bg-red-50 focus:text-red-600 font-bold text-xs uppercase tracking-widest p-3"
                                          >
                                            Abort Session
                                          </DropdownMenuItem>
                                       </DropdownMenuContent>
                                    </DropdownMenu>
                                 </div>
                              </div>
                           </motion.div>
                        ) : (
                           <div className="h-12 rounded-2xl border-2 border-dashed border-slate-100 bg-transparent flex items-center px-6 opacity-0 group-hover:opacity-100 transition-all hover:border-sky-100 hover:bg-sky-50/20">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 text-[10px] font-black text-slate-400 gap-2 hover:bg-transparent hover:text-sky-600 tracking-widest uppercase"
                                onClick={() => {
                                  if (date) {
                                    setNewAppt({...newAppt, time: slot, date: date.toISOString().split('T')[0]});
                                  }
                                  setIsBookingOpen(true);
                                }}
                              >
                                 <Plus size={12} /> Rapid Booking
                              </Button>
                           </div>
                        )}
                     </div>
                  </div>
               );
             })}
           </div>
        </div>
      </div>
      {/* Appointment Detail Dialog */}
      <Dialog open={!!viewingAppt} onOpenChange={(open) => !open && setViewingAppt(null)}>
        <DialogContent className="max-w-2xl rounded-[2rem] p-0 border-none overflow-hidden sm:max-w-xl">
           {viewingAppt && (
             <div className="flex flex-col">
               <div className="bg-slate-900 p-8 text-white relative">
                  <div className="flex items-center justify-between mb-6">
                    <Badge className="bg-white/10 text-white border-white/20 uppercase tracking-widest text-[9px] px-3 py-1 font-black">
                      {viewingAppt.status}
                    </Badge>
                    <span className="text-xs font-bold text-slate-400">{formatDate(viewingAppt.startTime)}</span>
                  </div>
                  <h2 className="text-3xl font-display font-black tracking-tight mb-2 uppercase">{viewingAppt.patientName}</h2>
                  <p className="text-slate-400 font-medium flex items-center gap-2">
                    <Stethoscope size={16} /> {viewingAppt.reason}
                  </p>
               </div>
               
               <div className="p-8 space-y-8 bg-white">
                  <div className="grid grid-cols-2 gap-8">
                    <div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Professional</h4>
                      <p className="text-sm font-bold text-slate-900">{viewingAppt.doctorName}</p>
                      <p className="text-xs text-slate-500 font-medium mt-1">Lead Specialist</p>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Timeline</h4>
                      <p className="text-sm font-bold text-slate-900">
                        {formatTime(viewingAppt.startTime)} - {formatTime(viewingAppt.endTime)}
                      </p>
                      <p className="text-xs text-slate-500 font-medium mt-1">30 Minute Session</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 border-b pb-2">Activity History</h4>
                    <div className="space-y-4 max-h-[200px] overflow-y-auto pr-2">
                       {viewingAppt.actions && viewingAppt.actions.length > 0 ? (
                         viewingAppt.actions.map((action, i) => (
                           <div key={i} className="flex gap-4 items-start">
                              <div className="h-2 w-2 rounded-full bg-sky-500 mt-1.5 shrink-0" />
                              <div className="flex-1">
                                <div className="flex justify-between items-center mb-0.5">
                                  <p className="text-xs font-bold text-slate-900 uppercase tracking-tight">{action.status}</p>
                                  <span className="text-[10px] font-medium text-slate-400">{formatTime(action.timestamp)}</span>
                                </div>
                                <p className="text-[11px] text-slate-500">{action.note}</p>
                              </div>
                           </div>
                         ))
                       ) : (
                         <div className="p-8 text-center bg-slate-50 rounded-2xl">
                           <p className="text-xs font-bold text-slate-400 uppercase tracking-widest italic">No prior life-cycle events recorded.</p>
                         </div>
                       )}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                     <Button className="flex-1 h-12 rounded-2xl font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xl shadow-slate-200">
                       Open Clinical Case
                     </Button>
                     <Button variant="outline" className="flex-1 h-12 rounded-2xl font-bold text-slate-600 border-slate-200" onClick={() => setViewingAppt(null)}>
                       Close Details
                     </Button>
                  </div>
               </div>
             </div>
           )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
