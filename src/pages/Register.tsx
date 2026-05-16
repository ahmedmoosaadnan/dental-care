import * as React from 'react';
import { useState } from 'react';
import { motion } from 'motion/react';
import { Stethoscope, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Link, useNavigate } from 'react-router-dom';
import { UserRole } from '../types';
import { toast } from 'sonner';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: fullName });

      // Create clinic and user profile
      const clinicId = `clinic_${user.uid}`;
      const profileRef = doc(db, 'users', user.uid);
      const newProfile = {
        uid: user.uid,
        email: user.email || '',
        displayName: fullName,
        role: UserRole.ADMIN,
        clinicId: clinicId,
        clinicName: clinicName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(profileRef, newProfile);
      
      toast.success("Account created successfully!");
      navigate('/');
    } catch (err: any) {
      console.error("Registration failed:", err);
      if (err.code === 'auth/operation-not-allowed') {
        setError("Registration is currently disabled because Email/Password provider is not enabled in your Firebase Project. Please enable it in the Firebase Console.");
      } else if (err.code === 'auth/email-already-in-use') {
        setError("This email is already registered. Please log in or use a different email.");
      } else if (err.code === 'auth/weak-password') {
        setError("Password is too weak. Please use a stronger password.");
      } else {
        setError(err.message || "Registration failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-1/2 flex-col justify-between bg-zinc-900 p-12 lg:flex">
        <div className="relative z-20 flex items-center gap-3 text-lg font-medium text-white">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/20">
            <Stethoscope className="text-white" />
          </div>
          <span className="tracking-tight">DentaSync Enterprise</span>
        </div>
        
        <div className="absolute inset-0 z-10 bg-[radial-gradient(circle_at_50%_50%,_rgba(var(--color-primary),0.15),transparent_70%)]" />
        <div className="absolute inset-0 z-0 bg-[url('https://images.unsplash.com/photo-1629909605124-4259b6042921?q=80&w=2067&auto=format&fit=crop')] bg-cover bg-center opacity-30 grayscale mix-blend-overlay" />

        <div className="relative z-20">
          <blockquote className="space-y-4">
            <p className="text-3xl font-light leading-snug tracking-tight text-white/90">
              "Equipping dental professionals with the <span className="text-primary font-medium italic underline underline-offset-8">tools of tomorrow</span>, today."
            </p>
            <footer className="text-sm font-medium text-white/60">— The DentaSync Architecture Team</footer>
          </blockquote>
        </div>
      </div>

      <div className="flex w-full items-center justify-center bg-white p-8 lg:w-1/2 overflow-y-auto">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mx-auto flex w-full max-w-[450px] flex-col justify-center space-y-8 py-12"
        >
          <div className="flex flex-col space-y-2">
            <Link to="/login" className="flex items-center text-sm font-medium text-slate-500 hover:text-primary transition-colors mb-4">
              <ArrowLeft size={16} className="mr-2" /> Back to Login
            </Link>
            <h1 className="text-4xl font-display font-black tracking-tight text-slate-900">Join DentaSync</h1>
            <p className="text-slate-500">Create an account to start managing your clinical operations.</p>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="grid gap-6">
            <div className="grid grid-cols-1 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  placeholder="Dr. John Doe"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-11 rounded-xl border-slate-200 bg-slate-50/50"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="clinicName">Clinic Name</Label>
                <Input
                  id="clinicName"
                  placeholder="Summit Dental Arts"
                  required
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  className="h-11 rounded-xl border-slate-200 bg-slate-50/50"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="email">Work Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@clinic.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-xl border-slate-200 bg-slate-50/50"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="password">Security Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 rounded-xl border-slate-200 bg-slate-50/50 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            <Button type="submit" disabled={loading} className="h-12 w-full bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl shadow-xl shadow-slate-200 transition-all active:scale-[0.98]">
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
                  Initializing Workspace...
                </div>
              ) : "Create Clinic Account"}
            </Button>
          </form>

          <p className="text-center text-sm text-slate-500">
            By registering, you agree to our <span className="text-slate-900 font-semibold underline underline-offset-4 cursor-pointer">Terms of Service</span> and <span className="text-slate-900 font-semibold underline underline-offset-4 cursor-pointer">Privacy Policy</span>.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
