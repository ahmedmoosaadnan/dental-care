import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Search, 
  Plus, 
  MoreVertical, 
  FileText, 
  Phone, 
  Mail, 
  Filter,
  Download,
  Calendar,
  History,
  Trash2,
  Edit2,
  ChevronRight,
  User as UserIcon,
  Loader2,
  X,
  Stethoscope,
  Clock,
  Briefcase,
  Printer,
  Pill,
  Save,
  AlertTriangle,
  CheckCircle,
  Receipt,
  CircleDollarSign
} from 'lucide-react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '../components/ui/dropdown-menu';
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
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { Patient, Treatment, Appointment, Invoice, Prescription, MedicalHistoryItem, InvoiceStatus } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDate, formatCurrency, toJSDate } from '../lib/utils';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, deleteDoc, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function PatientsPage() {
  const { profile } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    gender: 'all',
    ageMin: '',
    ageMax: '',
    lastVisitDays: 'all'
  });

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [patientToArchive, setPatientToArchive] = useState<Patient | null>(null);

  // Sub-data for selected patient
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedTreatmentsForInvoice, setSelectedTreatmentsForInvoice] = useState<string[]>([]);

  // History Management State
  const [isAddingHistory, setIsAddingHistory] = useState(false);
  const [editingHistory, setEditingHistory] = useState<MedicalHistoryItem | null>(null);
  const [newHistoryItem, setNewHistoryItem] = useState<Partial<MedicalHistoryItem>>({
    type: 'condition',
    value: '',
    notes: ''
  });

  // Prescription Management State
  const [isPrescribing, setIsPrescribing] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [prescriptionForm, setPrescriptionForm] = useState<Partial<Prescription>>({
    medicationName: '',
    dosage: '',
    frequency: '',
    duration: '',
    notes: ''
  });

  // Form State
  const [newPatient, setNewPatient] = useState({
    name: '',
    phone: '',
    email: '',
    gender: 'male' as const,
    age: 0,
    address: ''
  });

  useEffect(() => {
    if (searchParams.get('addNew') === 'true') {
      setIsAddingNew(true);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('addNew');
      setSearchParams(newParams);
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const patientId = searchParams.get('id');
    if (patientId && patients.length > 0) {
      const patient = patients.find(p => p.id === patientId);
      if (patient) {
        setSelectedPatient(patient);
        setIsDetailOpen(true);
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('id');
        setSearchParams(newParams);
      }
    }
  }, [searchParams, setSearchParams, patients]);

  useEffect(() => {
    if (!profile?.clinicId) return;

    const q = query(
      collection(db, 'patients'),
      where('clinicId', '==', profile.clinicId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const patientList: Patient[] = [];
      snapshot.forEach((doc) => {
        patientList.push({ id: doc.id, ...doc.data() } as Patient);
      });
      setPatients(patientList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'patients');
    });

    return () => unsubscribe();
  }, [profile?.clinicId]);

  // Fetch sub-data when a patient is selected
  useEffect(() => {
    if (!selectedPatient || !profile?.clinicId) return;

    const treatmentsQ = query(
      collection(db, 'treatments'),
      where('patientId', '==', selectedPatient.id)
    );

    const appointmentsQ = query(
      collection(db, 'appointments'),
      where('patientId', '==', selectedPatient.id)
    );

    const unsubTreatments = onSnapshot(treatmentsQ, (snapshot) => {
      const list: Treatment[] = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() } as Treatment));
      setTreatments(list.sort((a, b) => {
        const dateA = toJSDate(a.date)?.getTime() || 0;
        const dateB = toJSDate(b.date)?.getTime() || 0;
        return dateB - dateA;
      }));
    });

    const unsubAppointments = onSnapshot(appointmentsQ, (snapshot) => {
      const list: Appointment[] = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() } as Appointment));
      setAppointments(list.sort((a, b) => {
        const dateA = toJSDate(a.startTime)?.getTime() || 0;
        const dateB = toJSDate(b.startTime)?.getTime() || 0;
        return dateB - dateA;
      }));
    });

    const prescriptionsQ = query(
      collection(db, 'prescriptions'),
      where('patientId', '==', selectedPatient.id)
    );

    const unsubPrescriptions = onSnapshot(prescriptionsQ, (snapshot) => {
      const list: Prescription[] = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() } as Prescription));
      setPrescriptions(list.sort((a, b) => {
        const dateA = toJSDate(a.date)?.getTime() || 0;
        const dateB = toJSDate(b.date)?.getTime() || 0;
        return dateB - dateA;
      }));
    });

    const invoicesQ = query(
      collection(db, 'invoices'),
      where('patientId', '==', selectedPatient.id)
    );

    const unsubInvoices = onSnapshot(invoicesQ, (snapshot) => {
      const list: Invoice[] = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() } as Invoice));
      setInvoices(list.sort((a, b) => {
        const dateA = toJSDate(a.createdAt)?.getTime() || 0;
        const dateB = toJSDate(b.createdAt)?.getTime() || 0;
        return dateB - dateA;
      }));
    });

    return () => {
      unsubTreatments();
      unsubAppointments();
      unsubPrescriptions();
      unsubInvoices();
    };
  }, [selectedPatient, profile?.clinicId]);

  const filteredPatients = useMemo(() => {
    return patients.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.phone.includes(searchTerm);
      const matchesGender = filters.gender === 'all' || p.gender === filters.gender;
      const matchesAgeMin = !filters.ageMin || p.age >= parseInt(filters.ageMin);
      const matchesAgeMax = !filters.ageMax || p.age <= parseInt(filters.ageMax);
      
      let matchesLastVisit = true;
      if (filters.lastVisitDays !== 'all') {
        const days = parseInt(filters.lastVisitDays);
        const limitDate = new Date();
        limitDate.setDate(limitDate.getDate() - days);
        const lastVisit = toJSDate(p.updatedAt);
        matchesLastVisit = lastVisit ? lastVisit >= limitDate : false;
      }
      
      return matchesSearch && matchesGender && matchesAgeMin && matchesAgeMax && matchesLastVisit;
    });
  }, [patients, searchTerm, filters]);

  const timelineItems = useMemo(() => {
    if (!selectedPatient) return [];
    return [
      ...appointments.map(a => ({ ...a, sortDate: a.startTime, type: 'appointment' as const })),
      ...treatments.filter(t => t.status === 'completed').map(t => ({ ...t, sortDate: t.date, type: 'treatment' as const })),
      ...invoices.map(i => ({ ...i, sortDate: i.createdAt, type: 'invoice' as const }))
    ].sort((a, b) => {
        const dateA = toJSDate(a.sortDate)?.getTime() || 0;
        const dateB = toJSDate(b.sortDate)?.getTime() || 0;
        return dateB - dateA;
    });
  }, [appointments, treatments, selectedPatient]);

  const handleAddPatient = async () => {
    if (!profile?.clinicId) return;
    try {
      await addDoc(collection(db, 'patients'), {
        ...newPatient,
        clinicId: profile.clinicId,
        medicalHistory: [],
        dentalHistory: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setIsAddingNew(false);
      setNewPatient({ name: '', phone: '', email: '', gender: 'male', age: 0, address: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'patients');
    }
  };

  const handleArchivePatient = async () => {
    if (!patientToArchive) return;
    try {
      await deleteDoc(doc(db, 'patients', patientToArchive.id));
      setPatientToArchive(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'patients');
    }
  };

  const toggleTreatmentSelection = (id: string) => {
    setSelectedTreatmentsForInvoice(prev => 
      prev.includes(id) ? prev.filter(tId => tId !== id) : [...prev, id]
    );
  };

  const handleGenerateInvoice = async (treatmentIds?: string[]) => {
    const idsToInvoice = treatmentIds || selectedTreatmentsForInvoice;
    if (!selectedPatient || !profile?.clinicId || idsToInvoice.length === 0) return;
    
    const selectedList = treatments.filter(t => idsToInvoice.includes(t.id));
    const subtotal = selectedList.reduce((sum, t) => sum + t.cost, 0);
    
    try {
      const newInvoice: Partial<Invoice> = {
        clinicId: profile.clinicId,
        patientId: selectedPatient.id,
        patientName: selectedPatient.name,
        items: selectedList.map(t => ({
          id: t.id,
          description: t.procedureName,
          amount: t.cost,
          quantity: 1
        })),
        tax: subtotal * 0.1, // Example 10% tax
        discount: 0,
        totalAmount: subtotal * 1.1,
        paidAmount: 0,
        status: InvoiceStatus.UNPAID,
        createdAt: new Date().toISOString()
      };
      
      await addDoc(collection(db, 'invoices'), newInvoice);
      if (!treatmentIds) {
        setSelectedTreatmentsForInvoice([]);
      }
      // Optionally navigate to billing or show success
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'invoices');
    }
  };

  const handleAddTreatment = async () => {
    if (!selectedPatient || !profile?.clinicId) return;
    try {
      await addDoc(collection(db, 'treatments'), {
        clinicId: profile.clinicId,
        patientId: selectedPatient.id,
        procedureName: 'New Procedure',
        cost: 0,
        status: 'planned',
        date: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'treatments');
    }
  };

  const handleCompleteTreatment = async (t: Treatment) => {
    try {
      await updateDoc(doc(db, 'treatments', t.id), {
        status: 'completed',
        date: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'treatments');
    }
  };

  const handleUpdateMedicalHistory = async (newHistory: MedicalHistoryItem[]) => {
    if (!selectedPatient) return;
    try {
      await updateDoc(doc(db, 'patients', selectedPatient.id), {
        medicalHistory: newHistory,
        updatedAt: new Date().toISOString()
      });
      // Update local state if needed (onSnapshot usually handles it but Patient object is in selectedPatient state)
      setSelectedPatient({ ...selectedPatient, medicalHistory: newHistory });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'patients');
    }
  };

  const deleteHistoryItem = (id: string) => {
    if (!selectedPatient) return;
    const filtered = selectedPatient.medicalHistory.filter(h => h.id !== id);
    handleUpdateMedicalHistory(filtered);
  };

  const saveHistoryItem = () => {
    if (!selectedPatient || !newHistoryItem.value) return;
    
    let updatedHistory: MedicalHistoryItem[];
    if (editingHistory) {
      updatedHistory = selectedPatient.medicalHistory.map(h => 
        h.id === editingHistory.id ? { ...h, ...newHistoryItem } as MedicalHistoryItem : h
      );
    } else {
      const newItem: MedicalHistoryItem = {
        id: crypto.randomUUID(),
        ...newHistoryItem,
        date: new Date().toISOString()
      } as MedicalHistoryItem;
      updatedHistory = [...selectedPatient.medicalHistory, newItem];
    }
    
    handleUpdateMedicalHistory(updatedHistory);
    setIsAddingHistory(false);
    setEditingHistory(null);
    setNewHistoryItem({ type: 'condition', value: '', notes: '' });
  };

  const handlePrescriptionSave = async () => {
    if (!selectedPatient || !profile?.clinicId || !prescriptionForm.medicationName) return;
    
    try {
      if (selectedPrescription) {
        await updateDoc(doc(db, 'prescriptions', selectedPrescription.id), {
          ...prescriptionForm,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'prescriptions'), {
          ...prescriptionForm,
          clinicId: profile.clinicId,
          patientId: selectedPatient.id,
          patientName: selectedPatient.name,
          prescribedBy: profile.displayName || 'Doctor',
          date: new Date().toISOString()
        });
      }
      setIsPrescribing(false);
      setSelectedPrescription(null);
      setPrescriptionForm({ medicationName: '', dosage: '', frequency: '', duration: '', notes: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'prescriptions');
    }
  };

  const deletePrescription = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'prescriptions', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'prescriptions');
    }
  };

  const generatePDFReport = () => {
    if (!selectedPatient) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(22);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text("Patient Summary Report", 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 28);
    
    // Horizontal Line
    doc.setDrawColor(241, 245, 249); // slate-100
    doc.line(14, 32, pageWidth - 14, 32);

    // Patient Info
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text("Basic Information", 14, 45);
    
    const patientInfo = [
      ["Name", selectedPatient.name],
      ["Patient ID", `PT-${selectedPatient.id.slice(0, 5).toUpperCase()}`],
      ["Age / Gender", `${selectedPatient.age} years / ${selectedPatient.gender}`],
      ["Phone", selectedPatient.phone],
      ["Email", selectedPatient.email || "N/A"],
      ["Address", selectedPatient.address],
    ];

    autoTable(doc, {
      startY: 50,
      head: [],
      body: patientInfo,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } }
    });

    // Medical History
    let currentY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.text("Medical History", 14, currentY);
    
    const historyData = selectedPatient.medicalHistory.map(h => [
      h.type.toUpperCase(),
      h.value,
      h.notes || "",
      h.date ? formatDate(h.date) : ""
    ]);

    autoTable(doc, {
      startY: currentY + 5,
      head: [['Type', 'Condition/Allergy', 'Notes', 'Recorded']],
      body: historyData.length ? historyData : [["No records", "-", "-", "-"]],
      theme: 'grid',
      headStyles: { fillColor: [245, 245, 245], textColor: 50, fontStyle: 'bold' },
      styles: { fontSize: 9 }
    });

    // Recent Visits
    currentY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.text("Recent Visits", 14, currentY);
    
    const visitData = appointments.slice(0, 5).map(a => [
      formatDate(a.startTime),
      a.reason,
      a.status,
      a.doctorName
    ]);

    autoTable(doc, {
      startY: currentY + 5,
      head: [['Date', 'Reason', 'Status', 'Doctor']],
      body: visitData.length ? visitData : [["No visits", "-", "-", "-"]],
      theme: 'grid',
      headStyles: { fillColor: [245, 245, 245], textColor: 50, fontStyle: 'bold' },
      styles: { fontSize: 9 }
    });

    doc.save(`${selectedPatient.name.replace(/\s+/g, '_')}_Report.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 py-4">
        <motion.h1 
          initial={{ opacity: 0, x: -20 }} 
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="text-4xl font-display font-black tracking-tight text-gradient leading-none"
        >
          Patient Registry
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, x: -20 }} 
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="text-slate-500 font-medium text-sm"
        >
          Manage clinical records and patient engagement.
        </motion.p>
      </div>

      <div className="flex flex-col gap-4 bento-card p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-xl">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search patients by name or phone..."
              className="h-12 border-none bg-slate-50 pl-12 focus:ring-2 focus:ring-sky-100 rounded-2xl font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button 
              variant={isFilterOpen ? "secondary" : "ghost"} 
              size="icon" 
              className="h-12 w-12 text-slate-500 rounded-2xl hover:bg-slate-100"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
            >
              <Filter size={20} />
            </Button>
            <Dialog open={isAddingNew} onOpenChange={setIsAddingNew}>
                  <DialogTrigger render={<Button className="h-12 px-6 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold shadow-lg shadow-slate-200" />}>
                        <Plus size={18} className="mr-2" />
                        New Patient
                  </DialogTrigger>
               <DialogContent className="sm:max-w-[600px] rounded-[2rem]">
                  <DialogHeader>
                     <DialogTitle className="text-2xl font-display font-black tracking-tight">Register New Patient</DialogTitle>
                     <DialogDescription>Enter full patient details to create a new clinical profile.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-6 py-4">
                     <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                           <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Full Name</Label>
                           <Input 
                            id="name" 
                            placeholder="John Doe" 
                            className="h-11 rounded-xl bg-slate-50 border-none font-medium"
                            value={newPatient.name}
                            onChange={(e) => setNewPatient({...newPatient, name: e.target.value})}
                           />
                        </div>
                        <div className="grid gap-2">
                           <Label htmlFor="phone" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phone Number</Label>
                           <Input 
                            id="phone" 
                            placeholder="+1 (555) 000-0000" 
                            className="h-11 rounded-xl bg-slate-50 border-none font-medium"
                            value={newPatient.phone}
                            onChange={(e) => setNewPatient({...newPatient, phone: e.target.value})}
                           />
                        </div>
                     </div>
                     <div className="grid grid-cols-3 gap-4">
                         <div className="grid gap-2">
                            <Label htmlFor="gender" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Gender</Label>
                            <Select 
                              value={newPatient.gender} 
                              onValueChange={(v: any) => setNewPatient({...newPatient, gender: v})}
                            >
                              <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-none">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                                <SelectItem value="male">Male</SelectItem>
                                <SelectItem value="female">Female</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                         </div>
                         <div className="grid gap-2">
                            <Label htmlFor="age" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Age</Label>
                            <Input 
                              id="age" 
                              type="number" 
                              className="h-11 rounded-xl bg-slate-50 border-none"
                              value={newPatient.age}
                              onChange={(e) => setNewPatient({...newPatient, age: parseInt(e.target.value) || 0})}
                            />
                         </div>
                         <div className="grid gap-2">
                            <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email</Label>
                            <Input 
                              id="email" 
                              type="email" 
                              placeholder="john@example.com" 
                              className="h-11 rounded-xl bg-slate-50 border-none"
                              value={newPatient.email}
                              onChange={(e) => setNewPatient({...newPatient, email: e.target.value})}
                            />
                         </div>
                     </div>
                     <div className="grid gap-2">
                        <Label htmlFor="address" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Residential Address</Label>
                        <Input 
                          id="address" 
                          placeholder="Full street address" 
                          className="h-11 rounded-xl bg-slate-50 border-none"
                          value={newPatient.address}
                          onChange={(e) => setNewPatient({...newPatient, address: e.target.value})}
                        />
                     </div>
                  </div>
                  <DialogFooter>
                     <Button variant="outline" className="rounded-xl" onClick={() => setIsAddingNew(false)}>Cancel</Button>
                     <Button type="button" className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold" onClick={handleAddPatient}>Create Profile</Button>
                   </DialogFooter>
                </DialogContent>
             </Dialog>
           </div>
         </div>

         <AnimatePresence>
           {isFilterOpen && (
             <motion.div
               initial={{ height: 0, opacity: 0 }}
               animate={{ height: "auto", opacity: 1 }}
               exit={{ height: 0, opacity: 0 }}
               className="overflow-hidden"
             >
               <div className="pt-4 grid grid-cols-1 sm:grid-cols-4 gap-4 border-t border-slate-100 mt-4">
                 <div className="space-y-1.5">
                   <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Gender</Label>
                   <Select value={filters.gender} onValueChange={(v) => setFilters({...filters, gender: v})}>
                     <SelectTrigger className="h-9 rounded-lg bg-slate-50/50 border-none">
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="all">All Genders</SelectItem>
                       <SelectItem value="male">Male</SelectItem>
                       <SelectItem value="female">Female</SelectItem>
                       <SelectItem value="other">Other</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
                 <div className="space-y-1.5">
                   <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Min Age</Label>
                   <Input 
                     type="number" 
                     placeholder="0" 
                     className="h-9 rounded-lg bg-slate-50/50 border-none"
                     value={filters.ageMin}
                     onChange={(e) => setFilters({...filters, ageMin: e.target.value})}
                   />
                 </div>
                 <div className="space-y-1.5">
                   <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Max Age</Label>
                   <Input 
                     type="number" 
                     placeholder="100" 
                     className="h-9 rounded-lg bg-slate-50/50 border-none"
                     value={filters.ageMax}
                     onChange={(e) => setFilters({...filters, ageMax: e.target.value})}
                   />
                 </div>
                 <div className="space-y-1.5">
                   <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Last Visit</Label>
                   <Select value={filters.lastVisitDays} onValueChange={(v) => setFilters({...filters, lastVisitDays: v})}>
                     <SelectTrigger className="h-9 rounded-lg bg-slate-50/50 border-none text-xs">
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="all">Any time</SelectItem>
                       <SelectItem value="30">Last 30 Days</SelectItem>
                       <SelectItem value="90">Last 90 Days</SelectItem>
                       <SelectItem value="365">Last Year</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
               </div>
               <div className="mt-4 flex justify-end">
                 <Button 
                   variant="ghost" 
                   size="sm" 
                   className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-900"
                   onClick={() => setFilters({ gender: 'all', ageMin: '', ageMax: '', lastVisitDays: 'all' })}
                 >
                   Reset Filters
                 </Button>
               </div>
             </motion.div>
           )}
         </AnimatePresence>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
         {loading ? (
           Array.from({ length: 6 }).map((_, i) => (
             <div key={i} className="h-64 rounded-[2.5rem] bg-white animate-pulse border-none shadow-sm" />
           ))
         ) : filteredPatients.length === 0 ? (
           <div className="col-span-full h-96 flex flex-col items-center justify-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100 p-12">
             <Search size={48} className="text-slate-200 mb-6" />
             <h3 className="text-xl font-black text-slate-400 uppercase tracking-tight">Search yield zero results</h3>
             <p className="text-slate-400 font-medium">Try adjusting your filters or universal search parameters.</p>
           </div>
         ) : filteredPatients.map((patient, idx) => (
           <motion.div
             key={patient.id}
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: idx * 0.05 }}
           >
             <Card 
               className="rounded-[2.5rem] border-none shadow-sm hover:shadow-2xl hover:-translate-y-2 hover:border-l-4 hover:border-l-sky-500 transition-all duration-300 group overflow-hidden cursor-pointer bg-white"
               onClick={() => {
                 setSelectedPatient(patient);
                 setIsDetailOpen(true);
               }}
             >
               <CardContent className="p-8">
                 <div className="flex items-start justify-between mb-6">
                   <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-sky-50 text-sky-600 group-hover:scale-105 transition-transform duration-500 shadow-inner">
                     <UserIcon size={24} />
                   </div>
                   <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                     <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-slate-400 hover:bg-slate-100">
                       <Edit2 size={14} />
                     </Button>
                     <Button 
                       variant="ghost" 
                       size="icon" 
                       className="h-9 w-9 rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                       onClick={(e) => {
                         e.stopPropagation();
                         setPatientToArchive(patient);
                       }}
                     >
                       <Trash2 size={14} />
                     </Button>
                   </div>
                 </div>

                 <div className="space-y-4">
                   <div>
                     <h3 className="text-lg font-black text-slate-900 leading-tight group-hover:text-primary transition-colors uppercase tracking-tight">{patient.name}</h3>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">PT-{patient.id.slice(0, 8).toUpperCase()}</p>
                   </div>

                   <div className="flex flex-wrap gap-2">
                     <Badge variant="secondary" className={cn(
                       "capitalize text-[8px] font-black tracking-widest px-2 py-0.5 rounded-full border-none",
                       patient.gender === 'male' ? "bg-blue-100 text-blue-600" :
                       patient.gender === 'female' ? "bg-pink-100 text-pink-600" :
                       "bg-slate-100 text-slate-600"
                     )}>
                       {patient.gender}
                     </Badge>
                     <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 text-[8px] font-black tracking-widest px-2 py-0.5 rounded-full border-none">
                       Active
                     </Badge>
                   </div>

                   <div className="pt-4 border-t border-slate-50 space-y-2.5">
                     <div className="flex items-center gap-3 text-slate-500">
                       <Phone size={14} className="text-slate-300" />
                       <span className="text-xs font-bold leading-none">{patient.phone}</span>
                     </div>
                     {patient.email && (
                       <div className="flex items-center gap-3 text-slate-500">
                         <Mail size={14} className="text-slate-300" />
                         <span className="text-xs font-bold leading-none truncate max-w-[150px]">{patient.email}</span>
                       </div>
                     )}
                     <div className="flex items-center gap-3 text-slate-500">
                       <History size={14} className="text-slate-300" />
                       <span className="text-xs font-bold leading-none">Last visit: {formatDate(patient.updatedAt)}</span>
                     </div>
                   </div>

                   <div className="pt-2 flex items-center justify-between">
                     <div className="flex -space-x-2">
                       <div className="h-6 w-6 rounded-full bg-slate-900 border border-white flex items-center justify-center text-[8px] font-black text-white">RC</div>
                       <div className="h-6 w-6 rounded-full bg-emerald-500 border border-white flex items-center justify-center text-[8px] font-black text-white">FI</div>
                     </div>
                     <Button variant="ghost" size="sm" className="h-8 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 rounded-xl translate-y-10 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                       Record History <ChevronRight size={12} className="ml-1" />
                     </Button>
                   </div>
                 </div>
               </CardContent>
             </Card>
           </motion.div>
         ))}
       </div>

      {/* Archive Confirmation */}
      <AlertDialog open={!!patientToArchive} onOpenChange={(open) => !open && setPatientToArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Patient Record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will safely archive {patientToArchive?.name}'s data. You can restore it later from clinical settings if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="outline" size="default">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchivePatient} className="bg-red-600 hover:bg-red-700">
              Confirm Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Patient Detail Drawer/Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-[850px] gap-0 p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl">
          {selectedPatient && (
            <div className="flex h-[85vh] flex-col bg-slate-50/50">
              <div className="relative overflow-hidden p-8 pb-12">
                <div className="absolute inset-0 bg-gradient-to-br from-sky-500/10 to-transparent"></div>
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-sky-600 shadow-xl shadow-sky-200/20 shadow-inner ring-1 ring-slate-100 transition-transform hover:scale-105">
                      <UserIcon size={36} />
                    </div>
                    <div>
                      <h2 className="text-3xl font-display font-black text-slate-900 tracking-tight">{selectedPatient.name}</h2>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="px-3 py-1 bg-sky-100 text-sky-700 text-[10px] font-black rounded-full uppercase tracking-widest">
                          Clinical Profile
                        </span>
                        <p className="text-xs text-slate-500 font-medium">Synced since {formatDate(selectedPatient.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                     <Button 
                      variant="outline" 
                      className="rounded-2xl border-slate-200 bg-white/50 backdrop-blur-sm shadow-sm font-bold text-slate-600 h-11 px-6 hover:bg-white"
                      onClick={generatePDFReport}
                     >
                       <Printer size={18} className="mr-2 text-slate-400" />
                       Export File
                     </Button>
                     <Button className="rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold h-11 px-8 shadow-xl shadow-slate-200">
                      Manage Case
                     </Button>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 overflow-auto px-8 pb-8 -mt-6">
                <Tabs defaultValue="overview" className="w-full">
                  <TabsList className="mb-8 w-full justify-start bg-white/60 backdrop-blur-md border border-white/20 rounded-3xl p-1.5 h-auto shadow-sm">
                    <TabsTrigger value="overview" className="rounded-2xl data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-sky-600 px-6 py-2.5 font-bold text-xs uppercase tracking-widest">Analytics</TabsTrigger>
                    <TabsTrigger value="history" className="rounded-2xl data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-sky-600 px-6 py-2.5 font-bold text-xs uppercase tracking-widest">Medical</TabsTrigger>
                    <TabsTrigger value="prescriptions" className="rounded-2xl data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-sky-600 px-6 py-2.5 font-bold text-xs uppercase tracking-widest">Scripts</TabsTrigger>
                    <TabsTrigger value="treatments" className="rounded-2xl data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-sky-600 px-6 py-2.5 font-bold text-xs uppercase tracking-widest">Plans</TabsTrigger>
                    <TabsTrigger value="billing" className="rounded-2xl data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-sky-600 px-6 py-2.5 font-bold text-xs uppercase tracking-widest">Billing</TabsTrigger>
                    <TabsTrigger value="visits" className="rounded-2xl data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-sky-600 px-6 py-2.5 font-bold text-xs uppercase tracking-widest">Timeline</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="overview" className="space-y-6 focus-visible:outline-none">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="bento-card p-6 border-none">
                          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Core Communications</h3>
                          <div className="space-y-4">
                             <div className="flex items-center gap-4 p-3 rounded-2xl bg-slate-50 transition-colors hover:bg-slate-100">
                                <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-400">
                                  <Phone size={18} />
                                </div>
                                <span className="text-sm font-bold text-slate-700">{selectedPatient.phone}</span>
                             </div>
                             <div className="flex items-center gap-4 p-3 rounded-2xl bg-slate-50 transition-colors hover:bg-slate-100">
                                <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-400">
                                  <Mail size={18} />
                                </div>
                                <span className="text-sm font-bold text-slate-700">{selectedPatient.email || 'No email assigned'}</span>
                             </div>
                             <div className="flex items-center gap-4 p-3 rounded-2xl bg-slate-50 transition-colors hover:bg-slate-100">
                                <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-400">
                                  <FileText size={18} />
                                </div>
                                <span className="text-sm font-bold text-slate-700 leading-tight">{selectedPatient.address}</span>
                             </div>
                          </div>
                       </div>
                       <div className="space-y-6">
                         <div className="bento-card p-6 border-none grid grid-cols-2 gap-6">
                            <div>
                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Anatomical Age</p>
                               <p className="text-3xl font-display font-black text-slate-900 tracking-tighter">{selectedPatient.age}<span className="text-sm ml-1 text-slate-400">Years</span></p>
                            </div>
                            <div>
                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Gender</p>
                               <p className="text-3xl font-display font-black text-slate-900 tracking-tighter capitalize">{selectedPatient.gender}</p>
                            </div>
                         </div>
                         
                         <div className="bento-card p-6 bg-slate-900 border-none relative overflow-hidden group">
                           <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-50"></div>
                           <div className="relative">
                             <div className="flex items-center justify-between mb-4">
                               <h3 className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em]">Patient Status</h3>
                               <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                             </div>
                             <p className="text-sm text-indigo-100 font-medium leading-relaxed italic">
                                Active treatment plan in progress. Last visit was regular cleaning and checkup.
                             </p>
                           </div>
                         </div>
                       </div>
                    </div>

                    <div className="bento-card p-8 border-none bg-sky-50 shadow-inner">
                       <div className="flex items-center gap-3 text-sky-900 mb-4">
                          <History size={20} className="text-sky-500" />
                          <h3 className="font-display font-black text-lg tracking-tight">Clinical Observations</h3>
                       </div>
                       <p className="text-sm text-sky-800 leading-relaxed font-medium">
                          {selectedPatient.dentalHistory || 'Comprehensive clinical metadata has not yet been recorded for this profile.'}
                       </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="history" className="space-y-6 p-2">
                     <div className="flex items-center justify-between">
                        <h3 className="font-bold text-slate-900 uppercase text-xs tracking-widest">Medical History & Conditions</h3>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-[10px] font-bold uppercase tracking-widest"
                          onClick={() => {
                            setEditingHistory(null);
                            setNewHistoryItem({ type: 'condition', value: '', notes: '' });
                            setIsAddingHistory(true);
                          }}
                        >
                          <Plus size={14} className="mr-2" />
                          Add Record
                        </Button>
                     </div>

                     <div className="space-y-3">
                        {(!selectedPatient.medicalHistory || selectedPatient.medicalHistory.length === 0) ? (
                          <div className="p-8 text-center border-2 border-dashed rounded-2xl text-slate-400">
                            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-20" />
                            <p className="text-sm">No medical history records found.</p>
                          </div>
                        ) : selectedPatient.medicalHistory.map((h) => {
                          // Handle legacy string data
                          const item = typeof h === 'string' ? { id: Math.random().toString(), type: 'condition', value: h, date: '', notes: '' } : h;
                          return (
                            <div key={item.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow group">
                               <div className="flex items-center gap-4">
                                  <div className={cn(
                                    "h-10 w-10 rounded-xl flex items-center justify-center",
                                    item.type === 'allergy' ? "bg-red-50 text-red-600" :
                                    item.type === 'medication' ? "bg-blue-50 text-blue-600" :
                                    item.type === 'surgery' ? "bg-amber-50 text-amber-600" :
                                    "bg-emerald-50 text-emerald-600"
                                  )}>
                                     <History size={18} />
                                  </div>
                                  <div>
                                     <div className="flex items-center gap-2">
                                        <p className="font-bold text-slate-900">{item.value}</p>
                                        <Badge variant="secondary" className="capitalize text-[10px] font-bold tracking-widest h-5">
                                           {item.type}
                                        </Badge>
                                     </div>
                                     {item.notes && <p className="text-xs text-slate-500 mt-1">{item.notes}</p>}
                                     <p className="text-[10px] text-slate-400 mt-1">Recorded: {item.date ? formatDate(item.date) : 'N/A'}</p>
                                  </div>
                               </div>
                               <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-slate-400 hover:text-slate-900"
                                    onClick={() => {
                                      setEditingHistory(item as MedicalHistoryItem);
                                      setNewHistoryItem({ ...item });
                                      setIsAddingHistory(true);
                                    }}
                                  >
                                     <Edit2 size={14} />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-slate-400 hover:text-red-600"
                                    onClick={() => deleteHistoryItem(item.id)}
                                  >
                                     <Trash2 size={14} />
                                  </Button>
                               </div>
                            </div>
                          );
                        })}
                     </div>
                  </TabsContent>

                  <TabsContent value="prescriptions" className="space-y-6">
                    <div className="flex items-center justify-between">
                       <h3 className="font-bold text-slate-900 uppercase text-xs tracking-widest">Active Prescriptions</h3>
                       <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-[10px] font-bold uppercase tracking-widest"
                        onClick={() => {
                          setSelectedPrescription(null);
                          setPrescriptionForm({ medicationName: '', dosage: '', frequency: '', duration: '', notes: '' });
                          setIsPrescribing(true);
                        }}
                       >
                          <Plus size={14} className="mr-2" />
                          New Prescription
                       </Button>
                    </div>

                    <div className="space-y-3">
                       {prescriptions.length === 0 ? (
                         <div className="p-8 text-center border-2 border-dashed rounded-2xl text-slate-400">
                           <Pill className="h-8 w-8 mx-auto mb-2 opacity-20" />
                           <p className="text-sm">No prescriptions found.</p>
                         </div>
                       ) : prescriptions.map((p) => (
                         <div 
                          key={p.id} 
                          className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow group cursor-pointer"
                          onClick={() => {
                            setSelectedPrescription(p);
                            setPrescriptionForm({ ...p });
                            setIsPrescribing(true);
                          }}
                         >
                            <div className="flex items-center gap-4">
                               <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                                  <Pill size={18} />
                               </div>
                               <div>
                                  <p className="font-bold text-slate-900">{p.medicationName}</p>
                                  <p className="text-xs text-slate-500 font-medium">
                                    {p.dosage} • {p.frequency} • {p.duration}
                                  </p>
                               </div>
                            </div>
                            <div className="text-right">
                               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatDate(p.date)}</p>
                               <p className="text-[10px] text-slate-400">By {p.prescribedBy}</p>
                            </div>
                         </div>
                       ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="treatments" className="space-y-6">
                    <div className="flex items-center justify-between">
                       <h3 className="font-bold text-slate-900 uppercase text-xs tracking-widest">Treatment Plan</h3>
                       <div className="flex gap-2">
                         {selectedTreatmentsForInvoice.length > 0 && (
                           <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleGenerateInvoice()}>
                             <FileText size={14} className="mr-2" />
                             Generate Invoice ({selectedTreatmentsForInvoice.length})
                           </Button>
                         )}
                         <Button variant="outline" size="sm" onClick={handleAddTreatment}>
                            <Plus size={14} className="mr-2" />
                            Add Procedure
                         </Button>
                       </div>
                    </div>
                    
                    <div className="space-y-8">
                       {/* Active/Planned Section */}
                       <div className="space-y-3">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Active Procedures</h4>
                          {treatments.filter(t => t.status !== 'completed').length === 0 ? (
                            <div className="p-8 text-center border-2 border-dashed rounded-2xl text-slate-400">
                              <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-20" />
                              <p className="text-sm">No active treatments planned.</p>
                            </div>
                          ) : treatments.filter(t => t.status !== 'completed').map((t) => (
                            <div key={t.id} className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-2xl shadow-sm group">
                               <Checkbox 
                                 checked={selectedTreatmentsForInvoice.includes(t.id)}
                                 onCheckedChange={() => toggleTreatmentSelection(t.id)}
                                 className="rounded-md"
                               />
                               <div className="flex-1 min-w-0">
                                  <p className="font-bold text-slate-900 truncate">{t.procedureName}</p>
                                  <p className="text-xs text-slate-500">{formatCurrency(t.cost)} • <span className="capitalize">{t.status}</span></p>
                               </div>
                               <Button 
                                 size="sm" 
                                 variant="ghost" 
                                 className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 font-bold text-[10px] uppercase tracking-widest"
                                 onClick={() => handleCompleteTreatment(t)}
                               >
                                  Complete
                               </Button>
                            </div>
                          ))}
                       </div>

                       {/* Completed Section */}
                       <div className="space-y-3">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Completed Treatments</h4>
                          {treatments.filter(t => t.status === 'completed').length === 0 ? (
                            <p className="text-xs text-slate-400 italic pl-4">No completed treatments recorded.</p>
                          ) : treatments.filter(t => t.status === 'completed').map((t) => (
                            <div key={t.id} className="flex items-center gap-4 p-4 bg-slate-50/50 border border-slate-100 rounded-2xl group opacity-80 hover:opacity-100 transition-opacity">
                               <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                                  <CheckCircle size={18} />
                               </div>
                               <div className="flex-1 min-w-0">
                                  <p className="font-bold text-slate-900 truncate">{t.procedureName}</p>
                                  <p className="text-xs text-slate-500">{formatCurrency(t.cost)} • {formatDate(t.date)}</p>
                               </div>
                               <Button 
                                 size="sm" 
                                 variant="outline" 
                                 className="border-primary text-primary hover:bg-primary hover:text-white font-bold text-[10px] uppercase tracking-widest"
                                 onClick={() => handleGenerateInvoice([t.id])}
                               >
                                  Bill Now
                               </Button>
                            </div>
                          ))}
                       </div>
                    </div>
                  </TabsContent>

                   <TabsContent value="billing" className="space-y-6">
                      <div className="flex items-center justify-between">
                         <h3 className="font-bold text-slate-900 uppercase text-xs tracking-widest">Financial Records</h3>
                         <div className="flex gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Total Billed: <span className="text-slate-900 ml-1">{formatCurrency(invoices.reduce((s, i) => s + (i.totalAmount || 0), 0))}</span>
                         </div>
                      </div>
                      <div className="space-y-3">
                         {invoices.length === 0 ? (
                           <div className="p-12 text-center border-2 border-dashed rounded-3xl text-slate-400">
                             <CircleDollarSign size={40} className="mx-auto mb-4 opacity-20" />
                             <p className="text-sm font-medium">No financial transactions detected.</p>
                           </div>
                         ) : (
                           invoices.map((i) => (
                             <div key={i.id} className="flex items-center justify-between p-5 bg-white border border-slate-100 rounded-3xl shadow-sm group">
                                <div className="flex items-center gap-5">
                                   <div className={cn(
                                     "h-12 w-12 rounded-2xl flex items-center justify-center transition-colors",
                                     i.status === 'paid' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                                   )}>
                                      <Receipt size={22} />
                                   </div>
                                   <div>
                                      <div className="flex items-center gap-2">
                                         <p className="font-black text-slate-900 uppercase tracking-tight">{i.invoiceNumber}</p>
                                         <Badge className={cn(
                                           "border-none px-2 py-0.5 font-black text-[8px] rounded-full uppercase tracking-widest",
                                           i.status === 'paid' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                                         )}>
                                           {i.status}
                                         </Badge>
                                      </div>
                                      <p className="text-[10px] font-bold text-slate-400 mt-1">{formatDate(i.createdAt)}</p>
                                   </div>
                                </div>
                                <div className="text-right">
                                   <p className="text-xl font-display font-black text-slate-900 tracking-tighter">{formatCurrency(i.totalAmount)}</p>
                                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Resolution</p>
                                </div>
                             </div>
                           ))
                         )}
                      </div>
                   </TabsContent>
                  <TabsContent value="visits" className="space-y-6">
                    <h3 className="font-bold text-slate-900 uppercase text-xs tracking-widest">Visit & Treatment Log</h3>
                    <div className="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:bg-slate-100">
                       {timelineItems.length === 0 ? (
                         <div className="pl-12 text-slate-400 text-sm">No activity history found.</div>
                       ) : (
                         timelineItems.map((item) => (
                           <div key={item.id} className="relative flex items-start gap-6 pl-12 group">
                             <div className={cn(
                               "absolute left-0 mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-white border-2 ring-4 ring-white shadow-sm transition-colors",
                               item.type === 'appointment' ? "border-primary text-primary" : 
                               item.type === 'invoice' ? "border-emerald-500 text-emerald-500" :
                               "border-sky-500 text-sky-500"
                             )}>
                                {item.type === 'appointment' ? <Clock size={16} /> : 
                                 item.type === 'invoice' ? <Receipt size={16} /> :
                                 <CheckCircle size={16} />}
                             </div>
                             <div className="flex-1 bento-card p-4 hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-2">
                                   <div>
                                     <p className="font-bold text-slate-900">
                                       {item.type === 'appointment' ? (item as any).reason : 
                                        item.type === 'invoice' ? `Invoice ${(item as any).invoiceNumber}` :
                                        (item as any).procedureName}
                                     </p>
                                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">
                                       {item.type}
                                     </p>
                                   </div>
                                   <Badge variant="secondary" className={cn(
                                     "text-[10px] uppercase tracking-widest border-none",
                                     item.type === 'appointment' ? "bg-slate-50 text-slate-500" : 
                                     item.type === 'invoice' ? (item.status === 'paid' ? "bg-emerald-50 text-emerald-600" : "bg-amber-100 text-amber-700") :
                                     "bg-emerald-50 text-emerald-600"
                                   )}>
                                     {item.status}
                                   </Badge>
                                </div>
                                <div className="flex flex-wrap gap-4 text-xs text-slate-500 font-medium italic mt-4">
                                   <span className="flex items-center gap-1.5"><Calendar size={12} /> {formatDate(item.sortDate)}</span>
                                   {item.type === 'appointment' && (
                                     <span className="flex items-center gap-1.5"><UserIcon size={12} /> {(item as any).doctorName}</span>
                                   )}
                                   {(item.type === 'treatment' || item.type === 'invoice') && (
                                     <span className="flex items-center gap-1.5"><CircleDollarSign size={12} /> {formatCurrency((item as any).totalAmount || (item as any).cost)}</span>
                                   )}
                                </div>
                             </div>
                           </div>
                         ))
                       )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
              
              <div className="border-t p-4 flex justify-end gap-2 bg-slate-50/50">
                 <Button variant="ghost" onClick={() => setIsDetailOpen(false)}>Close</Button>
                 <Button className="bg-primary text-white">Open Treatment Window</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Medical History Add/Edit Dialog */}
      <Dialog open={isAddingHistory} onOpenChange={setIsAddingHistory}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingHistory ? 'Edit History Record' : 'Add Medical Record'}</DialogTitle>
            <DialogDescription>Record clinical conditions, allergies, or past surgeries.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid gap-2">
              <Label>Record Type</Label>
              <Select 
                value={newHistoryItem.type} 
                onValueChange={(v: any) => setNewHistoryItem({ ...newHistoryItem, type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="condition">Condition</SelectItem>
                  <SelectItem value="allergy">Allergy</SelectItem>
                  <SelectItem value="medication">Existing Medication</SelectItem>
                  <SelectItem value="surgery">Past Surgery</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Value / Description</Label>
              <Input 
                placeholder="e.g. Type 2 Diabetes, Penicillin Allergy"
                value={newHistoryItem.value}
                onChange={(e) => setNewHistoryItem({ ...newHistoryItem, value: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Additional Notes</Label>
              <Input 
                placeholder="Optional details or context"
                value={newHistoryItem.notes}
                onChange={(e) => setNewHistoryItem({ ...newHistoryItem, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingHistory(false)}>Cancel</Button>
            <Button onClick={saveHistoryItem}>
              <Save size={16} className="mr-2" />
              {editingHistory ? 'Update Record' : 'Save Record'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Prescription Dialog */}
      <Dialog open={isPrescribing} onOpenChange={setIsPrescribing}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{selectedPrescription ? 'Prescription Details' : 'New Prescription'}</DialogTitle>
            <DialogDescription>Specify medication and dosage instructions.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid gap-2">
              <Label>Medication Name</Label>
              <Input 
                placeholder="e.g. Amoxicillin 500mg"
                value={prescriptionForm.medicationName}
                onChange={(e) => setPrescriptionForm({ ...prescriptionForm, medicationName: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Dosage</Label>
                <Input 
                  placeholder="e.g. 1 Tablet"
                  value={prescriptionForm.dosage}
                  onChange={(e) => setPrescriptionForm({ ...prescriptionForm, dosage: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Frequency</Label>
                <Input 
                  placeholder="e.g. Twice Daily"
                  value={prescriptionForm.frequency}
                  onChange={(e) => setPrescriptionForm({ ...prescriptionForm, frequency: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Duration</Label>
              <Input 
                placeholder="e.g. 7 Days"
                value={prescriptionForm.duration}
                onChange={(e) => setPrescriptionForm({ ...prescriptionForm, duration: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Special Instructions</Label>
              <Input 
                placeholder="e.g. Take after food"
                value={prescriptionForm.notes}
                onChange={(e) => setPrescriptionForm({ ...prescriptionForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="justify-between">
            <div>
              {selectedPrescription && (
                <Button 
                  variant="ghost" 
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => {
                    deletePrescription(selectedPrescription.id);
                    setIsPrescribing(false);
                  }}
                >
                  <Trash2 size={16} className="mr-2" />
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsPrescribing(false)}>Cancel</Button>
              <Button onClick={handlePrescriptionSave}>
                <Save size={16} className="mr-2" />
                {selectedPrescription ? 'Save Changes' : 'Issue Prescription'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
