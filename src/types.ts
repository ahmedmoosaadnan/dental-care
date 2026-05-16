export enum UserRole {
  ADMIN = 'admin',
  DOCTOR = 'doctor',
  RECEPTIONIST = 'receptionist',
  ASSISTANT = 'assistant',
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  clinicId: string;
  clinicName?: string;
  createdAt: string;
  updatedAt: string;
}

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

export interface MedicalRecord {
  id: string;
  type: 'condition' | 'allergy' | 'medication' | 'surgery';
  value: string;
  date: string;
  notes?: string;
}

export type MedicalHistoryItem = MedicalRecord;

export interface Patient {
  id: string;
  clinicId: string;
  name: string;
  phone: string;
  email?: string;
  gender: Gender;
  age: number;
  address: string;
  medicalHistory: MedicalHistoryItem[];
  dentalHistory?: string;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  createdAt: string;
  updatedAt: string;
}

export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  CHECKED_IN = 'checked-in',
  IN_TREATMENT = 'in-treatment',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no-show',
}

export interface Appointment {
  id: string;
  clinicId: string;
  patientId: string;
  patientName: string; // denormalized for search/display performance
  doctorId: string;
  doctorName: string; // denormalized
  startTime: string; // ISO
  endTime: string; // ISO
  reason: string;
  status: AppointmentStatus;
  notes?: string;
  updatedAt: string;
  actions?: Array<{
    status: string;
    timestamp: string;
    note: string;
  }>;
}

export enum TreatmentStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed',
}

export interface Treatment {
  id: string;
  clinicId: string;
  patientId: string;
  appointmentId?: string;
  procedureName: string;
  notes?: string;
  cost: number;
  status: TreatmentStatus;
  date: string;
}

export enum InvoiceStatus {
  UNPAID = 'unpaid',
  PARTIALLY_PAID = 'partially-paid',
  PAID = 'paid',
  CANCELLED = 'cancelled',
}

export interface InvoiceItem {
  id: string;
  description: string;
  amount: number;
  quantity: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clinicId: string;
  patientId: string;
  patientName: string;
  treatmentIds: string[];
  items: InvoiceItem[];
  totalAmount: number;
  discount: number;
  tax: number;
  paidAmount: number;
  status: InvoiceStatus;
  paymentMethod?: string;
  createdAt: string;
  notes?: string;
}

export interface Prescription {
  id: string;
  clinicId: string;
  patientId: string;
  patientName: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes?: string;
  prescribedBy: string;
  date: string;
}

export interface InventoryItem {
  id: string;
  clinicId: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  minThreshold: number;
  unit: string;
  supplier: string;
  lastRestockedAt: string;
  pricePerUnit: number;
}
