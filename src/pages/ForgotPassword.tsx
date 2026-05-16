import * as React from 'react';
import { useState } from 'react';
import { motion } from 'motion/react';
import { Stethoscope, ArrowLeft, Mail } from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSubmitted(true);
      toast.success("Reset link sent!");
    } catch (err: any) {
      console.error("Reset failed:", err);
      toast.error(err.message || "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-1/2 flex-col justify-between bg-emerald-950 p-12 lg:flex overflow-hidden">
        <div className="relative z-20 flex items-center gap-3 text-lg font-medium text-white">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 shadow-lg shadow-emerald-500/20">
            <Stethoscope className="text-white" />
          </div>
          <span className="tracking-tight">DentaSync Recovery</span>
        </div>
        
        <div className="absolute inset-0 z-10 bg-[radial-gradient(circle_at_50%_50%,_rgba(16,185,129,0.1),transparent_70%)]" />
        <div className="absolute inset-0 z-0 bg-[url('https://images.unsplash.com/photo-1629909605124-4259b6042921?q=80&w=2067&auto=format&fit=crop')] bg-cover bg-center opacity-20 grayscale" />

        <div className="relative z-20">
          <p className="text-4xl font-light leading-snug tracking-tight text-white/90">
             Ensuring your access remains <span className="text-emerald-400 font-medium italic underline underline-offset-8">uninterrupted</span>.
          </p>
        </div>
      </div>

      <div className="flex w-full items-center justify-center bg-white p-8 lg:w-1/2">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mx-auto flex w-full max-w-[400px] flex-col justify-center space-y-8"
        >
          {!submitted ? (
            <>
              <div className="flex flex-col space-y-2">
                <Link to="/login" className="flex items-center text-sm font-medium text-slate-500 hover:text-primary transition-colors mb-4">
                  <ArrowLeft size={16} className="mr-2" /> Back to Login
                </Link>
                <h1 className="text-3xl font-display font-black tracking-tight text-slate-900">Forgot Password?</h1>
                <p className="text-slate-500">No worries. Enter your work email and we'll send you a recovery link.</p>
              </div>

              <form onSubmit={handleReset} className="grid gap-6">
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

                <Button type="submit" disabled={loading} className="h-12 w-full bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl shadow-xl shadow-slate-200">
                  {loading ? "Sending link..." : "Send Recovery Link"}
                </Button>
              </form>
            </>
          ) : (
            <div className="text-center space-y-6">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
                <Mail size={40} />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-900">Check your inbox</h2>
                <p className="text-slate-500 px-4">
                  We've sent a password reset link to <span className="font-bold text-slate-900">{email}</span>. Click the link in the email to reset your password.
                </p>
              </div>
              <Link to="/login">
                <Button variant="outline" className="h-12 w-full rounded-2xl border-slate-200 font-bold text-slate-600">
                  <ArrowLeft size={16} className="mr-2" /> Return to Login
                </Button>
              </Link>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
