import { useState, useRef, useEffect, useMemo } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { 
  CreditCard, 
  Search, 
  Plus, 
  Trash2, 
  FileText, 
  Printer, 
  Download,
  ChevronRight,
  TrendingDown,
  CircleDollarSign,
  User as UserIcon,
  Receipt,
  CheckCircle,
  Clock,
  Stethoscope,
  Scissors,
  ArrowRight,
  ArrowUpRight,
  Sparkles,
  Zap,
  Tag,
  Layers,
  Loader2,
  PackageCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
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
  DialogFooter
} from '../components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/select';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency, cn, formatDate, toJSDate } from '../lib/utils';
import { dbService } from '../lib/db';
import { Patient, Invoice, InvoiceStatus, UserRole } from '../types';
import { useAuthStore } from '../store/useAuthStore';
import { toast } from 'sonner';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export default function POSPage() {
  const { profile } = useAuthStore();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'fixed' | 'percent'>('fixed');
  const [discountValue, setDiscountValue] = useState(0);
  const [isPaidOnCheckout, setIsPaidOnCheckout] = useState(true);
  const [paymentAmount, setPaymentAmount] = useState<number | string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("Cash");
  const [showReceipt, setShowReceipt] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const tax = subtotal * 0.1; // 10% Tax
  
  const calculatedDiscount = useMemo(() => {
    if (discountType === 'percent') {
      return subtotal * (discountValue / 100);
    }
    return discountValue;
  }, [subtotal, discountValue, discountType]);

  const total = subtotal + tax - calculatedDiscount;

  // Real-time stats calculations
  const totalFinancials = useMemo(() => {
    const gross = recentInvoices.reduce((acc, inv) => acc + (inv.totalAmount || 0), 0);
    const paid = recentInvoices.reduce((acc, inv) => acc + (inv.paidAmount || 0), 0);
    const pending = gross - paid;
    return { gross, paid, pending };
  }, [recentInvoices]);

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  useEffect(() => {
    if (isPaidOnCheckout) {
      setPaymentAmount(total);
    }
  }, [isPaidOnCheckout, total]);

  const applyDiscount = () => {
    toast.success("Discount applied successfully.");
  };

  useEffect(() => {
    if (!profile?.clinicId) return;

    // Fetch Patients for selection
    const unsubPatients = onSnapshot(query(collection(db, 'patients'), where('clinicId', '==', profile.clinicId)), (snapshot) => {
      const list: Patient[] = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() } as Patient));
      const sorted = list.sort((a, b) => a.name.localeCompare(b.name));
      setPatients(sorted);
    });

    // Fetch Treatments Catalog
    const unsubCatalog = onSnapshot(query(collection(db, 'treatmentCatalog'), where('clinicId', '==', profile.clinicId)), (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() }));
      setCatalog(list);
    });

    // Fetch Recent Invoices
    const q = query(
      collection(db, 'invoices'),
      where('clinicId', '==', profile.clinicId),
      limit(50)
    );
    const unsubInvoices = onSnapshot(q, (snapshot) => {
      const list: Invoice[] = [];
      snapshot.forEach(d => list.push({ id: d.id, ...d.data() } as Invoice));
      const sorted = list.sort((a, b) => {
        const dateA = toJSDate(a.createdAt)?.getTime() || 0;
        const dateB = toJSDate(b.createdAt)?.getTime() || 0;
        return dateB - dateA;
      });
      setRecentInvoices(sorted.slice(0, 5));
      setLoading(false);
    });

    return () => {
      unsubPatients();
      unsubCatalog();
      unsubInvoices();
    };
  }, [profile?.clinicId]);

  const handleAddToCart = (service: any) => {
    const existing = cart.find(item => item.id === service.id);
    if (existing) {
      setCart(cart.map(item => item.id === service.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { id: service.id, name: service.name, price: service.baseCost || service.price || 0, quantity: 1 }]);
    }
    toast.success(`${service.name} added to cart.`);
  };

  const handleUpdateQuantity = (id: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const handleRemoveFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const handleCheckout = async () => {
    if (!selectedPatientId || cart.length === 0 || !profile?.clinicId) {
      toast.error("Please identify a patient and add items to the order.");
      return;
    }

    setProcessing(true);
    try {
      const pAmount = Number(paymentAmount) || 0;
      let status = InvoiceStatus.UNPAID;
      
      if (pAmount >= total) status = InvoiceStatus.PAID;
      else if (pAmount > 0) status = InvoiceStatus.PARTIALLY_PAID;

      const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
      const invoiceData: Partial<Invoice> = {
        clinicId: profile.clinicId,
        patientId: selectedPatientId,
        patientName: selectedPatient?.name || 'Unknown Patient',
        invoiceNumber,
        items: cart.map(item => ({
          id: item.id,
          description: item.name,
          amount: item.price,
          quantity: item.quantity
        })),
        totalAmount: total,
        tax,
        discount: calculatedDiscount,
        paidAmount: pAmount,
        paymentMethod: paymentMethod,
        status: status,
        createdAt: new Date().toISOString()
      };

      const docId = await dbService.createDoc('invoices', invoiceData);
      const fullInvoice = { id: docId, ...invoiceData } as Invoice;
      setSelectedInvoice(fullInvoice);
      toast.success(pAmount >= total ? "Transaction completed." : "Partial payment recorded.");
      setShowReceipt(true);
    } catch (err) {
      toast.error("Transaction failed. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const handleMarkAsPaid = async (invoiceId: string, amount: number) => {
    try {
      await dbService.updateDoc('invoices', invoiceId, {
        status: InvoiceStatus.PAID,
        paidAmount: amount,
        paymentMethod: 'Cash', // Default
        updatedAt: new Date().toISOString()
      });
      toast.success("Invoice marked as PAID.");
    } catch (err) {
      toast.error("Failed to update invoice status.");
    }
  };

  const openReceipt = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowReceipt(true);
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!window.confirm("Are you sure you want to delete this invoice? This action is irreversible.")) return;
    
    try {
      await dbService.deleteDoc('invoices', invoiceId);
      toast.success("Invoice deleted successfully.");
    } catch (err) {
      toast.error("Failed to delete invoice.");
      console.error(err);
    }
  };

  const handleEditInvoice = (invoice: Invoice) => {
    // Populate cart and state with invoice data to "edit" it
    setCart(invoice.items.map(item => ({
      id: item.id || Math.random().toString(36).substr(2, 9),
      name: item.description,
      price: item.amount,
      quantity: item.quantity
    })));
    setSelectedPatientId(invoice.patientId);
    setDiscountValue(invoice.discount || 0);
    setDiscountType('fixed'); // Default to fixed for simplicity during edit
    setPaymentAmount(invoice.paidAmount || 0);
    setPaymentMethod(invoice.paymentMethod || 'Cash');
    setIsPaidOnCheckout(invoice.status === InvoiceStatus.PAID);
    
    // Optionally remove the old invoice if we treat this as a "correction"
    // For now, we'll keep it and the user can delete it if they want.
    toast.info("Invoice data loaded into terminal for editing.");
  };

  const handlePrint = () => {
    if (!receiptRef.current) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("Print window was blocked. Please allow pop-ups or use the 'Save PDF' button instead.");
      return;
    }

    const content = receiptRef.current.innerHTML;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt - ${selectedInvoice?.invoiceNumber || 'Invoice'}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            @page {
              size: auto;
              margin: 0mm;
            }
            body { 
              padding: 20mm; 
              background: white !important;
              font-family: 'Inter', sans-serif !important;
              color: #0f172a !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            * { box-sizing: border-box; }
            .no-print { display: none !important; }
            
            /* Receipt Layout Optimization for Print */
            .flex { display: flex !important; }
            .flex-col { flex-direction: column !important; }
            .items-center { align-items: center !important; }
            .items-end { align-items: flex-end !important; }
            .justify-between { justify-content: space-between !important; }
            .w-full { width: 100% !important; }
            .text-center { text-align: center !important; }
            .text-right { text-align: right !important; }
            .font-black { font-weight: 900 !important; }
            .font-bold { font-weight: 700 !important; }
            .text-3xl { font-size: 1.875rem !important; }
            .text-4xl { font-size: 2.25rem !important; }
            .text-5xl { font-size: 3rem !important; }
            .text-6xl { font-size: 3.75rem !important; }
            .text-sm { font-size: 0.875rem !important; }
            .text-base { font-size: 1rem !important; }
            .text-lg { font-size: 1.125rem !important; }
            .text-xs { font-size: 0.75rem !important; }
            .text-xl { font-size: 1.25rem !important; }
            .tracking-tighter { letter-spacing: -0.05em !important; }
            .tracking-tight { letter-spacing: -0.025em !important; }
            .tracking-widest { letter-spacing: 0.1em !important; }
            .mb-10 { margin-bottom: 2.5rem !important; }
            .mb-12 { margin-bottom: 3rem !important; }
            .mt-12 { margin-top: 3rem !important; }
            .my-10 { margin-top: 2.5rem !important; margin-bottom: 2.5rem !important; }
            .p-10 { padding: 2.5rem !important; }
            .rounded-[3rem] { border-radius: 1.5rem !important; }
            .bg-slate-50\/80 { background-color: #f8fafc !important; }
            .bg-slate-900 { background-color: #0f172a !important; }
            .text-white { color: white !important; }
            .text-slate-400 { color: #94a3b8 !important; }
            .text-slate-900 { color: #0f172a !important; }
            .text-sky-500 { color: #0ea5e9 !important; }
            .text-sky-400 { color: #38bdf8 !important; }
            .text-rose-400 { color: #fb7185 !important; }
            .text-emerald-500 { color: #10b981 !important; }
            .bg-emerald-500 { background-color: #10b981 !important; }
            .bg-sky-500 { background-color: #0ea5e9 !important; }
            .border-t { border-top-width: 1px !important; }
            .border-b { border-bottom-width: 1px !important; }
            .border-dashed { border-style: dashed !important; }
            .border-slate-200 { border-color: #e2e8f0 !important; }
            .grid { display: grid !important; }
            .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
            .gap-10 { gap: 2.5rem !important; }
            .space-y-4 > * + * { margin-top: 1rem !important; }
            .space-y-8 > * + * { margin-top: 2rem !important; }
            .leading-none { line-height: 1 !important; }
            
            /* Break prevention */
            .w-full { page-break-inside: avoid; }
            
            /* Ensure single page */
            html, body {
              height: auto;
              overflow: visible;
            }
          </style>
        </head>
        <body>
          <div style="max-width: 700px; margin: 0 auto; color-scheme: light;">
            ${content}
          </div>
          <script>
            window.onload = function() {
              setTimeout(() => {
                window.print();
                window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadPDF = () => {
    const inv = selectedInvoice || {
      invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toISOString(),
      patientName: selectedPatient?.name || 'Unknown',
      items: cart.map(i => ({ description: i.name, amount: i.price, quantity: i.quantity })),
      totalAmount: total,
      tax: tax,
      discount: calculatedDiscount,
      paidAmount: isPaidOnCheckout ? Number(paymentAmount) : 0,
      status: isPaidOnCheckout ? (Number(paymentAmount) >= total ? 'paid' : 'partially-paid') : 'unpaid'
    };

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFontSize(26);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(profile?.clinicName?.toUpperCase() || 'DENTASYNC ENTERPRISE', 20, 30);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(56, 189, 248); // sky-400
    doc.text('INTELLECTUAL CLINICAL INFRASTRUCTURE NODE', 20, 38);
    // Powered by DevOxis
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('POWERED BY DEVOXIS TECHNOLOGY PARTNER', 20, 43);
    
    // Receipt Info
    doc.setDrawColor(241, 245, 249); // slate-100
    doc.setLineWidth(1.5);
    doc.line(20, 48, pageWidth - 20, 48);
    
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text('FISCAL CLEARANCE ID', 20, 60);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(`#${inv.invoiceNumber}`, 20, 68);
    
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('TIMESTAMP GENERATED', pageWidth - 20, 60, { align: 'right' });
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(formatDate(inv.createdAt), pageWidth - 20, 68, { align: 'right' });
    
    // Patient Info Section
    const patientY = 82;
    doc.setFillColor(248, 250, 252); // slate-50
    doc.roundedRect(20, patientY, pageWidth - 40, 32, 4, 4, 'F');
    
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('RECIPIENT IDENTITY', 30, patientY + 10);
    doc.text('AUTHORIZING OFFICER', pageWidth - 30, patientY + 10, { align: 'right' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(inv.patientName?.toUpperCase() || 'N/A', 30, patientY + 18);
    doc.text(profile?.displayName?.toUpperCase() || 'SYSTEM', pageWidth - 30, patientY + 18, { align: 'right' });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text('REGISTERED CLIENT', 30, patientY + 25);
    doc.text('MEDICAL DIRECTOR', pageWidth - 30, patientY + 25, { align: 'right' });
    
    // Items table
    const tableBody = inv.items.map((item: any) => [
      item.description || item.name,
      item.quantity.toString(),
      formatCurrency(item.amount || item.price),
      formatCurrency((item.amount || item.price) * item.quantity)
    ]);
    
    autoTable(doc, {
      startY: 125,
      head: [['DESCRIPTION OF SERVICE', 'QTY', 'UNIT RATE', 'MAGNITUDE']],
      body: tableBody,
      theme: 'grid',
      headStyles: { 
        fillColor: [15, 23, 42], 
        textColor: 255, 
        fontStyle: 'bold', 
        fontSize: 9, 
        cellPadding: 6,
        halign: 'left'
      },
      styles: { 
        fontSize: 10, 
        cellPadding: 6, 
        font: 'helvetica',
        lineColor: [241, 245, 249],
        lineWidth: 0.1
      },
      columnStyles: { 
        0: { halign: 'left', fontStyle: 'bold', cellWidth: 'auto' },
        1: { halign: 'center', cellWidth: 20 },
        2: { halign: 'right', cellWidth: 40 },
        3: { halign: 'right', fontStyle: 'bold', cellWidth: 40 } 
      }
    });
    
    // Totals Calculation
    let currentY = (doc as any).lastAutoTable.finalY + 12;
    const finalSubtotal = inv.totalAmount + (inv.discount || 0) - (inv.tax || 0);
    
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    
    // Right side totals
    const labelX = pageWidth - 90;
    const valueX = pageWidth - 20;

    doc.text('SUBTOTAL MAGNITUDE', labelX, currentY);
    doc.setTextColor(15, 23, 42);
    doc.text(formatCurrency(finalSubtotal), valueX, currentY, { align: 'right' });
    
    currentY += 8;
    doc.setTextColor(148, 163, 184);
    doc.text('FISCAL TAX (10%)', labelX, currentY);
    doc.setTextColor(15, 23, 42);
    doc.text(formatCurrency(inv.tax || 0), valueX, currentY, { align: 'right' });
    
    if ((inv.discount || 0) > 0) {
      currentY += 8;
      doc.setTextColor(225, 29, 72); // rose-600
      doc.text('APPLIED COMPLIANCE DISCOUNT', labelX, currentY);
      doc.text(`-${formatCurrency(inv.discount || 0)}`, valueX, currentY, { align: 'right' });
    }
    
    // Grand Total Divider
    currentY += 6;
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.5);
    doc.line(labelX, currentY, valueX, currentY);
    
    currentY += 12;
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('TOTAL FINANCIAL RESOLUTION', labelX, currentY);
    
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(formatCurrency(inv.totalAmount).toUpperCase(), valueX, currentY + 4, { align: 'right' });
    
    currentY += 28;
    
    // Status and Payment info
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(20, currentY, pageWidth - 40, 18, 3, 3, 'F');
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('LEDGER STATUS:', 30, currentY + 11);
    
    const statusText = inv.status.toUpperCase();
    const statusColor = inv.status === 'paid' ? [52, 211, 153] : [251, 191, 36]; // emerald-400 : amber-400
    doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.text(statusText, 60, currentY + 11);
    
    doc.setTextColor(255, 255, 255);
    doc.text('METHOD:', 100, currentY + 11);
    doc.setTextColor(125, 211, 252); // sky-300
    doc.text(inv.paymentMethod?.toUpperCase() || 'CASH', 115, currentY + 11);

    doc.setTextColor(255, 255, 255);
    doc.text('AMOUNT RECEIVED:', pageWidth - 85, currentY + 11);
    doc.setTextColor(52, 211, 153);
    doc.text(formatCurrency(inv.paidAmount || 0), pageWidth - 30, currentY + 11, { align: 'right' });

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(203, 213, 225); // slate-300
    const footerY = doc.internal.pageSize.getHeight() - 15;
    doc.text('THIS IS A COMPUTER GENERATED INVOICE. NO SIGNATURE REQUIRED.', pageWidth / 2, footerY - 5, { align: 'center' });
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'bold');
    doc.text('POWERED BY DEVOXIS • DENTASYNC V4.2 ENTERPRISE NODE | © 2026', pageWidth / 2, footerY, { align: 'center' });

    doc.save(`Invoice-${inv.invoiceNumber}.pdf`);
  };

  return (
    <div className="flex flex-col gap-8 h-full pb-12">
      <div className="flex flex-col gap-2 py-4">
        <motion.h1 
          initial={{ opacity: 0, x: -20 }} 
          animate={{ opacity: 1, x: 0 }}
          className="text-4xl font-display font-black tracking-tight text-gradient leading-none"
        >
          Point of Sale
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, x: -20 }} 
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="text-slate-500 font-medium text-sm"
        >
          Enterprise clinical checkout and automated invoice generation.
        </motion.p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
         <div className="p-8 rounded-3xl bg-white border border-slate-200 flex flex-col items-center justify-center shadow-sm group transition-all">
            <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 mb-4">
              <CircleDollarSign size={24} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fiscal Volume</p>
            <p className="text-3xl font-display font-black text-slate-900 tracking-tighter leading-none">{formatCurrency(totalFinancials.gross)}</p>
         </div>
         <div className="p-8 rounded-3xl bg-white border border-slate-200 flex flex-col items-center justify-center shadow-sm group transition-all">
            <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 mb-4">
              <CheckCircle size={24} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Paid</p>
            <p className="text-3xl font-display font-black text-slate-900 tracking-tighter leading-none">{formatCurrency(totalFinancials.paid)}</p>
         </div>
         <div className="p-8 rounded-3xl bg-white border border-slate-200 flex flex-col items-center justify-center shadow-sm group transition-all">
            <div className="h-12 w-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 mb-4">
              <TrendingDown size={24} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Debt Volume</p>
            <p className="text-3xl font-display font-black text-slate-900 tracking-tighter leading-none">{formatCurrency(totalFinancials.pending)}</p>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 flex-1 min-h-0">
        {/* Services Selection Column */}
        <div className="lg:col-span-8 flex flex-col gap-8 overflow-y-auto min-h-0 pr-4">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
             <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-slate-900 flex items-center justify-center text-white">
                  <Receipt size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-display font-black text-slate-900 tracking-tight">Active Session</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mt-1">Transaction Stream</p>
                </div>
             </div>
             <div className="w-full sm:w-80 group">
                <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
                  <SelectTrigger className="h-14 rounded-2xl bg-white border-slate-200 shadow-sm focus:ring-4 focus:ring-blue-600/10 font-medium transition-all">
                    <SelectValue placeholder="Identify Patient Record..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-slate-200 shadow-xl max-h-[400px] w-[320px]">
                    {patients.length === 0 ? (
                      <div className="p-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">No matching records</div>
                    ) : patients.map(p => (
                      <SelectItem key={p.id} value={p.id} className="rounded-xl py-3 px-4 font-bold hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                           <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-400 font-bold uppercase overflow-hidden ring-1 ring-slate-100">
                             {p.photoURL ? <img src={p.photoURL} alt={p.name} className="h-full w-full object-cover" /> : p.name.split(' ').map(n => n[0]).join('')}
                           </div>
                           <div className="flex flex-col">
                             <span className="text-xs uppercase">{p.name}</span>
                             <span className="text-[9px] text-slate-400 font-black tracking-widest">{p.phone}</span>
                           </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
             </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
             {catalog.length === 0 ? (
               <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-100 rounded-[2.5rem]">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No treatments in catalog</p>
                  <Link to="/treatments">
                    <Button variant="link" className="text-sky-500 font-bold text-xs mt-2 uppercase tracking-widest">Add treatments now</Button>
                  </Link>
               </div>
             ) : catalog.map((service, index) => (
               <motion.button
                key={service.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ y: -5, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleAddToCart(service)}
                className="flex flex-col items-start p-6 rounded-3xl bg-white border border-slate-200 shadow-sm hover:border-blue-300 hover:bg-blue-50/10 transition-all text-left relative overflow-hidden group"
               >
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Plus size={20} className="text-blue-600" />
                  </div>
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all duration-300 mb-6 font-black text-xl uppercase">
                     {service.name[0]}
                  </div>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 leading-tight line-clamp-1">{service.name}</h3>
                  <p className="text-2xl font-display font-black text-slate-900 tracking-tighter">{formatCurrency(service.baseCost)}</p>
                  <div className="mt-4 flex items-center gap-1 text-[9px] font-black uppercase text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    Add to order <ArrowRight size={10} />
                  </div>
               </motion.button>
             ))}
          </div>

          <div className="bento-card border-none bg-white rounded-[2.5rem] overflow-hidden shadow-xl shadow-slate-200/30 border border-slate-100">
             <div className="bg-slate-50/80 px-8 py-5 border-b border-slate-100">
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Transaction History</h3>
             </div>
             <div className="p-0">
                <Table>
                   <TableHeader>
                      <TableRow className="border-none">
                         <TableHead className="px-8 text-[10px] font-black tracking-widest uppercase">Invoice Node</TableHead>
                         <TableHead className="text-[10px] font-black tracking-widest uppercase">Identity</TableHead>
                         <TableHead className="text-[10px] font-black tracking-widest uppercase">Magnitude</TableHead>
                         <TableHead className="text-[10px] font-black tracking-widest uppercase">State</TableHead>
                         <TableHead className="text-[10px] font-black tracking-widest uppercase text-right px-8">Audit</TableHead>
                      </TableRow>
                   </TableHeader>
                   <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={5} className="h-48 text-center p-0">
                            <div className="flex flex-col items-center justify-center gap-3">
                              <Loader2 className="h-8 w-8 animate-spin text-slate-200" />
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Querying Journal Nodes...</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : recentInvoices.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="h-48 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            System Idle • No Transactions Detected
                          </TableCell>
                        </TableRow>
                      ) : recentInvoices.map((invoice) => (
                       <TableRow key={invoice.id} className="hover:bg-slate-50/50 border-b border-slate-50 transition-colors group border-none">
                          <TableCell className="px-8 font-mono text-[11px] text-slate-400 font-bold uppercase tracking-wider">{invoice.invoiceNumber || 'PENDING'}</TableCell>
                          <TableCell className="font-display font-black text-slate-900 tracking-tight">{invoice.patientName}</TableCell>
                          <TableCell className="font-black text-slate-900 tracking-tighter text-lg">{formatCurrency(invoice.totalAmount)}</TableCell>
                          <TableCell>
                             <Badge className={cn(
                               "border-none px-3 py-1 font-black text-[9px] rounded-full uppercase tracking-widest shadow-sm",
                               invoice.status === 'paid' ? "bg-emerald-50 text-emerald-600" : 
                               invoice.status === 'partially-paid' ? "bg-blue-50 text-blue-600" :
                               "bg-amber-50 text-amber-600"
                             )}>
                               {invoice.status.toUpperCase()}
                             </Badge>
                          </TableCell>
                           <TableCell className="text-right px-8">
                              <div className="flex justify-end gap-2">
                                {invoice.status !== 'paid' && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-8 px-3 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white font-bold text-[9px] uppercase tracking-widest transition-all"
                                    onClick={() => handleMarkAsPaid(invoice.id, invoice.totalAmount)}
                                  >
                                    Authorize Full
                                  </Button>
                                )}
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => handleEditInvoice(invoice)}
                                  className="h-8 w-8 rounded-lg hover:bg-slate-900 hover:text-white text-slate-400 transition-all font-bold"
                                  title="Edit/Re-open Invoice"
                                >
                                  <Search size={16} />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => openReceipt(invoice)}
                                  className="h-8 w-8 rounded-lg hover:bg-slate-900 hover:text-white text-slate-400 transition-all font-bold"
                                >
                                  <Printer size={16} />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => handleDeleteInvoice(invoice.id)}
                                  className="h-8 w-8 rounded-lg hover:bg-rose-600 hover:text-white text-rose-400 transition-all font-bold"
                                >
                                  <Trash2 size={16} />
                                </Button>
                              </div>
                           </TableCell>
                       </TableRow>
                      ))}
                   </TableBody>
                </Table>
             </div>
          </div>
        </div>

        {/* Cart & Billing Column */}
        <div className="lg:col-span-4 flex flex-col gap-8">
          <Card className="flex-1 flex flex-col bento-card border-none overflow-hidden rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(30,41,59,0.15)] bg-white relative">
            <CardHeader className="bg-slate-900 text-white p-10 pb-16 relative overflow-hidden">
               <div className="absolute inset-0 bg-gradient-to-br from-sky-500/20 to-transparent opacity-30"></div>
               <div className="relative flex items-center justify-between">
                  <div className="space-y-1">
                     <CardTitle className="text-3xl font-display font-black tracking-tight">Checkout</CardTitle>
                     <p className="text-sky-300 text-[10px] font-black uppercase tracking-[0.2em] mt-1">
                       {selectedPatientId ? `Record: ${selectedPatient?.name}` : 'System Awaiting Identity'}
                     </p>
                  </div>
                  <div className="h-14 w-14 rounded-2xl bg-white/20 border border-white/10 flex items-center justify-center backdrop-blur-xl">
                     <CreditCard className="text-white" size={24} />
                  </div>
               </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-auto p-0 flex flex-col -mt-8 relative bg-white rounded-t-[3rem] shadow-[0_-12px_32px_rgba(0,0,0,0.05)]">
               <div className="flex-1 px-10 py-8 space-y-6">
                  <AnimatePresence mode="popLayout">
                    {cart.length === 0 ? (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex h-full flex-col items-center justify-center text-slate-300 gap-4 py-16"
                      >
                         <div className="w-16 h-16 rounded-[2rem] bg-slate-50 flex items-center justify-center">
                            <Receipt size={32} className="opacity-40" />
                         </div>
                         <p className="text-[10px] font-black uppercase tracking-widest">Order Terminal Empty</p>
                      </motion.div>
                    ) : (
                      cart.map((item, index) => (
                        <motion.div
                          key={item.id}
                          layout
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ delay: index * 0.05 }}
                          className="flex items-center justify-between group py-2 border-b border-slate-50 last:border-0"
                        >
                           <div className="flex items-center gap-4">
                              <div className="flex flex-col items-center gap-1">
                                 <button onClick={() => handleUpdateQuantity(item.id, 1)} className="p-1 hover:text-sky-500 transition-colors"><Plus size={12} /></button>
                                 <span className="text-xs font-black text-slate-900">{item.quantity}</span>
                                 <button onClick={() => handleUpdateQuantity(item.id, -1)} className="p-1 hover:text-rose-500 transition-colors"><Trash2 size={12} /></button>
                              </div>
                              <div className="flex flex-col">
                                 <span className="text-sm font-black text-slate-900 tracking-tight leading-none mb-1 uppercase">{item.name}</span>
                                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatCurrency(item.price)} per unit</span>
                              </div>
                           </div>
                           <div className="text-right">
                             <p className="font-display font-black text-slate-900 tracking-tighter text-lg">{formatCurrency(item.price * item.quantity)}</p>
                             <button onClick={() => handleRemoveFromCart(item.id)} className="text-[9px] font-black text-rose-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Remove</button>
                           </div>
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                  {cart.length > 0 && (
                    <Button 
                      variant="ghost" 
                      onClick={() => setCart([])}
                      className="w-full h-10 border-2 border-dashed border-slate-100 rounded-xl text-[10px] font-black text-slate-400 hover:text-rose-500 hover:bg-rose-50 hover:border-rose-100 transition-all uppercase tracking-widest"
                    >
                      Clear Checkout Order
                    </Button>
                  )}
               </div>

               <div className="px-10 py-8 bg-slate-50/50 space-y-4">
                  <div className="flex justify-between items-center group">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Service Total</span>
                     <span className="font-bold text-slate-700">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between items-center group">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tax Provision (10%)</span>
                     <span className="font-bold text-slate-700">{formatCurrency(tax)}</span>
                  </div>
                   <div className="flex flex-col gap-3 py-2">
                      <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Manual Discount Adjustment</Label>
                      <div className="flex items-center gap-2">
                         <div className="relative flex-1 group">
                            <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-sky-500 transition-colors" />
                            <Input 
                             type="number"
                             placeholder="0.00" 
                             value={discountValue || ''}
                             onChange={(e) => setDiscountValue(Number(e.target.value))}
                             className="h-11 text-xs font-bold rounded-xl bg-white border-slate-100 pl-10 shadow-sm" 
                            />
                         </div>
                         <div className="flex p-1 bg-slate-100 rounded-xl">
                            <button 
                              onClick={() => setDiscountType('fixed')}
                              className={cn(
                                "px-3 py-2 rounded-lg text-[10px] font-black uppercase transition-all",
                                discountType === 'fixed' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400"
                              )}
                            >
                              Fixed
                            </button>
                            <button 
                              onClick={() => setDiscountType('percent')}
                              className={cn(
                                "px-3 py-2 rounded-lg text-[10px] font-black uppercase transition-all",
                                discountType === 'percent' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400"
                              )}
                            >
                              %
                            </button>
                         </div>
                      </div>
                   </div>
                   
                   <div className="flex flex-col gap-4 p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Payment Authority</span>
                          <span className="text-[9px] text-slate-400 font-medium tracking-wide">Configure transaction settlement</span>
                        </div>
                        <Checkbox 
                          checked={isPaidOnCheckout}
                          onCheckedChange={(checked) => setIsPaidOnCheckout(!!checked)}
                          className="h-6 w-6 rounded-lg data-[state=checked]:bg-emerald-500 border-2"
                        />
                      </div>

                      <AnimatePresence>
                        {isPaidOnCheckout && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="space-y-4 pt-2 border-t border-slate-50 overflow-hidden"
                          >
                             <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                   <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Method</Label>
                                   <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                      <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-none font-bold text-xs">
                                         <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent className="rounded-xl font-bold uppercase text-[10px]">
                                         <SelectItem value="Cash">Cash</SelectItem>
                                         <SelectItem value="Card">Terminal (Card)</SelectItem>
                                         <SelectItem value="Transfer">Bank Transfer</SelectItem>
                                         <SelectItem value="Wallet">Digital Wallet</SelectItem>
                                      </SelectContent>
                                   </Select>
                                </div>
                                <div className="space-y-1.5">
                                   <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Payment Amount</Label>
                                   <Input 
                                      type="number"
                                      value={paymentAmount}
                                      onChange={(e) => setPaymentAmount(e.target.value)}
                                      className="h-10 rounded-xl bg-slate-50 border-none font-bold text-xs"
                                   />
                                </div>
                             </div>
                             {Number(paymentAmount) < total && (
                               <div className="px-3 py-2 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-between">
                                  <span className="text-[8px] font-black uppercase tracking-widest">Partial Sequence</span>
                                  <span className="text-[9px] font-bold">Remaining: {formatCurrency(total - Number(paymentAmount))}</span>
                               </div>
                             )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                   </div>

                   {calculatedDiscount > 0 && (
                     <div className="flex justify-between items-center bg-emerald-50 px-4 py-2 rounded-xl">
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Adjustment Applied</span>
                        <span className="font-bold text-emerald-600">-{formatCurrency(calculatedDiscount)}</span>
                     </div>
                   )}
                   <div className="pt-8 border-t border-slate-200">
                     <div className="flex flex-col gap-6">
                        <div className="flex justify-between items-end">
                           <div className="space-y-0.5">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Final Resolution</span>
                              <h4 className="text-4xl font-display font-black text-slate-900 tracking-tighter leading-none">{formatCurrency(total)}</h4>
                           </div>
                        </div>
                        
                        <Button 
                           disabled={cart.length === 0 || !selectedPatientId || processing}
                           onClick={handleCheckout}
                           className={cn(
                             "h-16 w-full text-base font-black rounded-2xl transition-all flex items-center justify-center gap-3 uppercase tracking-widest",
                             isPaidOnCheckout 
                               ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm" 
                               : "bg-slate-900 hover:bg-slate-800 text-white"
                           )}
                         >
                           {processing ? (
                             <Loader2 className="animate-spin" />
                           ) : (
                             <>
                               {isPaidOnCheckout ? <CheckCircle size={20} /> : <Receipt size={20} />}
                               {isPaidOnCheckout ? 'Authorize & Pay Now' : 'Generate unpaid Bill'}
                             </>
                           )}
                        </Button>                        <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
                           <DialogContent className="max-w-3xl bg-zinc-100 p-0 border-none overflow-hidden rounded-[3rem] shadow-2xl h-[94vh] max-h-[96vh] flex flex-col">
                              <div className="flex-1 overflow-y-auto px-10 py-12 bg-white scrollbar-hide">
                                 <div ref={receiptRef} className="bg-white flex flex-col items-center w-full max-w-[650px] mx-auto">
                                    <div className="flex flex-col items-center mb-10 text-center w-full">
                                       <div className="h-20 w-20 bg-slate-900 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-2xl shadow-slate-200">
                                          <Stethoscope size={36} className="text-white" />
                                       </div>
                                       <h2 className="text-4xl font-display font-black text-slate-900 tracking-tighter leading-none mb-3">{profile?.clinicName || 'DentaSync Enterprise'}</h2>
                                       <p className="text-[10px] font-black text-blue-600 tracking-[0.3em] uppercase opacity-80">Powered by DevOxis Teknologi</p>
                                       
                                       <div className="grid grid-cols-2 gap-10 w-full mt-12 text-left">
                                          <div>
                                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Provider Node</p>
                                             <p className="text-sm font-bold text-slate-900">Digital District, Operations HQ</p>
                                             <p className="text-xs font-medium text-slate-500">Registered Medical Provider</p>
                                          </div>
                                          <div className="text-right">
                                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Fiscal Authority</p>
                                             <p className="text-xl font-display font-black text-slate-900 tracking-tight leading-none mb-1">#{selectedInvoice?.invoiceNumber || 'PENDING'}</p>
                                             <p className="text-sm font-bold text-slate-500">{selectedInvoice ? formatDate(selectedInvoice.createdAt) : formatDate(new Date().toISOString())}</p>
                                          </div>
                                       </div>
                                    </div>

                                    <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent my-10" />

                                    <div className="w-full space-y-4 mb-12 bg-slate-50/80 p-10 rounded-[3rem]">
                                       <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Client Identity</span> <span className="font-extrabold text-slate-900 uppercase text-sm tracking-tight">{selectedInvoice?.patientName || selectedPatient?.name}</span></div>
                                       <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Identity ID</span> <span className="font-mono text-[10px] text-slate-500 font-bold">{(selectedInvoice?.patientId || selectedPatientId || 'unknown').toUpperCase()}</span></div>
                                       <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Authorized By</span> <span className="font-bold text-slate-700 text-sm">{profile?.displayName?.toUpperCase()}</span></div>
                                    </div>

                                    <div className="w-full space-y-8 mb-12 px-2">
                                       <p className="text-[11px] font-black text-slate-300 uppercase tracking-[0.3em] border-b border-slate-50 pb-4">Itemized Ledger</p>
                                       {(selectedInvoice?.items || cart.map(i => ({ description: i.name, amount: i.price, quantity: i.quantity }))).map((item: any, idx: number) => (
                                         <div key={idx} className="flex justify-between items-center group">
                                            <div className="flex flex-col gap-1">
                                               <span className="text-base font-black text-slate-900 tracking-tight leading-none">{item.description || item.name}</span>
                                               <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                 <Badge variant="outline" className="h-5 px-2 rounded-md text-[9px] border-slate-100 bg-white">{item.quantity} x</Badge>
                                                 {formatCurrency(item.amount || item.price)}
                                               </span>
                                            </div>
                                            <span className="text-xl font-display font-black text-slate-900 tracking-tighter">{formatCurrency((item.amount || item.price) * item.quantity)}</span>
                                         </div>
                                       ))}
                                    </div>

                                    <div className="w-full bg-slate-900 text-white rounded-[3rem] p-10 space-y-4 shadow-2xl shadow-slate-900/10">
                                       <div className="flex justify-between items-center opacity-60"><span className="text-[11px] font-black uppercase tracking-widest">Subtotal Sum</span> <span className="font-bold">{formatCurrency((selectedInvoice?.totalAmount || total) + (selectedInvoice?.discount || calculatedDiscount) - (selectedInvoice?.tax || tax))}</span></div>
                                       <div className="flex justify-between items-center opacity-60"><span className="text-[11px] font-black uppercase tracking-widest">Tax (10%)</span> <span className="font-bold">{formatCurrency(selectedInvoice?.tax || tax)}</span></div>
                                       {(selectedInvoice?.discount || calculatedDiscount) > 0 && <div className="flex justify-between items-center text-rose-300"><span className="text-[11px] font-black uppercase tracking-widest">Discounts</span> <span className="font-black">-{formatCurrency(selectedInvoice?.discount || calculatedDiscount)}</span></div>}
                                       
                                       <div className="h-px bg-white/10 my-4" />
                                       
                                       <div className="flex justify-between items-end">
                                          <div className="flex flex-col gap-1">
                                            <span className="font-black uppercase tracking-[0.3em] text-[11px] text-sky-400">Grand Total Resolution</span>
                                            <div className="flex items-center gap-2">
                                              <Badge className="bg-sky-500 text-white border-none py-1 h-6">ESTABLISHED</Badge>
                                              <span className="text-[11px] font-black text-white/50 uppercase tracking-widest">{selectedInvoice?.paymentMethod || 'CASH'}</span>
                                            </div>
                                          </div>
                                          <span className="text-6xl font-display font-black text-white tracking-tighter leading-none">{formatCurrency(selectedInvoice?.totalAmount || total)}</span>
                                       </div>
                                       
                                       <div className="flex justify-between items-center pt-8">
                                          <div className="flex flex-col gap-1">
                                            <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Status Check</span>
                                            <Badge className={cn(
                                              "h-8 px-4 rounded-xl border-none font-black text-[10px] uppercase tracking-widest",
                                              selectedInvoice?.status === 'paid' ? "bg-emerald-500 text-white" : "bg-amber-500 text-black"
                                            )}>
                                              {selectedInvoice?.status.toUpperCase()}
                                            </Badge>
                                          </div>
                                          <div className="flex flex-col items-end gap-1">
                                            <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Paid Magnitude</span>
                                            <span className="text-2xl font-display font-black underline decoration-sky-500 underline-offset-8">{formatCurrency(selectedInvoice?.paidAmount ?? (isPaidOnCheckout ? Number(paymentAmount) : 0))}</span>
                                          </div>
                                       </div>
                                       
                                       {((selectedInvoice?.totalAmount || total) - (selectedInvoice?.paidAmount ?? (isPaidOnCheckout ? Number(paymentAmount) : 0)) > 0) && (
                                         <div className="flex justify-between items-center py-4 px-8 border-t border-white/5 mt-4">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Balance Outstanding</span>
                                            <span className="text-2xl font-display font-black text-rose-400">{formatCurrency((selectedInvoice?.totalAmount || total) - (selectedInvoice?.paidAmount ?? (isPaidOnCheckout ? Number(paymentAmount) : 0)))}</span>
                                         </div>
                                       )}
                                    </div>

                                    <div className="w-full border-t border-dashed border-slate-200 my-16" />
                                    
                                    <div className="flex flex-col items-center w-full opacity-40 mb-12">
                                       <PackageCheck size={56} className="text-slate-200 mb-8" />
                                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] text-center mb-8">SECURE TRANSACTION VERIFIED • POWERED BY DEVOXIS</p>
                                       <div className="flex items-center gap-2 h-14 w-full justify-center">
                                         {[...Array(40)].map((_, i) => (
                                           <div 
                                            key={i} 
                                            className={cn("w-1 rounded-full", i % 5 === 0 ? "bg-slate-900" : "bg-slate-100")} 
                                            style={{ height: `${30 + Math.abs(Math.sin(i * 0.4)) * 70}%` }} 
                                           />
                                         ))}
                                       </div>
                                    </div>
                                 </div>
                              </div>
                              <div className="p-8 bg-zinc-50 flex gap-4 border-t border-zinc-100 relative shadow-inner mt-auto">
                                 <Button 
                                   variant="ghost" 
                                   className="flex-1 rounded-3xl h-18 font-black transition-all text-slate-400 hover:text-slate-900 hover:bg-slate-100 uppercase tracking-widest border-2 border-transparent hover:border-slate-200" 
                                   onClick={() => {
                                     setShowReceipt(false);
                                     setCart([]);
                                     setSelectedPatientId("");
                                     setSelectedInvoice(null);
                                   }}
                                 >
                                   Close Node
                                 </Button>
                                 <Button 
                                   className="flex-1 rounded-3xl h-18 bg-white hover:bg-slate-50 text-slate-900 font-black flex items-center justify-center gap-4 uppercase tracking-widest border-2 border-slate-100 shadow-sm transition-all active:scale-95" 
                                   onClick={handleDownloadPDF}
                                 >
                                   <Download size={22} className="text-sky-500" />
                                   Save PDF
                                 </Button>
                                 <Button className="flex-[2] rounded-3xl h-18 bg-slate-900 hover:bg-slate-800 text-white font-black shadow-2xl shadow-slate-900/20 flex items-center justify-center gap-4 uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95" onClick={handlePrint}>
                                   <Printer size={22} className="text-sky-400" />
                                   Authorize Print
                                 </Button>
                              </div>
                           </DialogContent>
                        </Dialog>
                     </div>
                  </div>
               </div>
            </CardContent>
          </Card>

          </div>
        </div>
      </div>
    );
}
