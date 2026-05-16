export type UserRole = 'admin' | 'doctor' | 'receptionist' | 'assistant';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  clinicId: string;
  photoURL?: string;
  createdAt: string;
}

export interface MedicalHistoryItem {
  id: string;
  type: 'condition' | 'allergy' | 'medication' | 'surgery';
  value: string;
  date?: string;
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

export interface Patient {
  id: string;
  clinicId: string;
  name: string;
  phone: string;
  email?: string;
  gender: 'male' | 'female' | 'other';
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

export interface Appointment {
  id: string;
  clinicId: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  startTime: string;
  endTime: string;
  reason: string;
  status: 'scheduled' | 'checked-in' | 'completed' | 'cancelled' | 'no-show';
  notes?: string;
}

export interface Treatment {
  id: string;
  clinicId: string;
  patientId: string;
  appointmentId?: string;
  procedureName: string;
  description?: string;
  cost: number;
  status: 'planned' | 'in-progress' | 'completed';
  date: string;
}

export interface Invoice {
  id: string;
  clinicId: string;
  patientId: string;
  patientName: string;
  items: {
    treatmentId: string;
    description: string;
    amount: number;
  }[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paidAmount: number;
  status: 'unpaid' | 'partially-paid' | 'paid';
  paymentMethod?: 'cash' | 'card' | 'transfer' | 'insurance';
  createdAt: string;
  dueDate?: string;
}

export interface InventoryItem {
  id: string;
  clinicId: string;
  name: string;
  category: string;
  sku: string;
  quantity: number;
  minThreshold: number;
  unit: string;
  supplier?: string;
  lastRestockedAt?: string;
}

export interface ClinicSettings {
  name: string;
  address: string;
  phone: string;
  email: string;
  logo?: string;
  taxRate: number;
  currency: string;
}
