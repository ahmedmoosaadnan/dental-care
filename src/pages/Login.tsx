import * as React from 'react';
import { useState } from 'react';
import { motion } from 'motion/react';
import { Stethoscope, Eye, EyeOff, Github, Chrome } from 'lucide-react';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Link } from 'react-router-dom';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    setError(null);
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Google login failed:", err);
      if (err.code === 'auth/unauthorized-domain') {
        setError("This domain is not authorized in Firebase. Please add the current domain to your Firebase Authorized Domains list.");
      } else {
        setError(err.message || "Login failed");
      }
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error("Email login failed:", err);
      if (err.code === 'auth/operation-not-allowed') {
        setError("Email/Password login is not enabled in Firebase. Please enable it in the Firebase Console (Authentication > Sign-in method).");
      } else if (err.code === 'auth/invalid-credential') {
        setError("Invalid email or password. Please try again.");
      } else if (err.code === 'auth/user-not-found') {
        setError("No account found with this email.");
      } else {
        setError(err.message || "Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left side: Branding/Visual */}
      <div className="relative hidden w-1/2 flex-col justify-between bg-zinc-900 p-12 lg:flex">
        <div className="relative z-20 flex items-center gap-3 text-lg font-medium text-white">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/20">
            <Stethoscope className="text-white" />
          </div>
          <span className="tracking-tight">DentaSync Enterprise</span>
        </div>
        
        {/* Decorative background elements */}
        <div className="absolute inset-0 z-10 bg-[radial-gradient(circle_at_50%_50%,_rgba(var(--color-primary),0.15),transparent_70%)]" />
        <div className="absolute inset-0 z-0 bg-[url('https://images.unsplash.com/photo-1629909605124-4259b6042921?q=80&w=2067&auto=format&fit=crop')] bg-cover bg-center opacity-30 grayscale mix-blend-overlay" />

        <div className="relative z-20">
          <blockquote className="space-y-2">
            <p className="text-3xl font-light leading-snug tracking-tight text-white/90">
              "The future of dental practice management is not just digital, it's <span className="text-primary font-medium italic underline underline-offset-8">synchronous</span>."
            </p>
            <footer className="text-sm font-medium text-white/60">— Dr. Moosa Alvi, Clinical Lead</footer>
          </blockquote>
        </div>
      </div>

      {/* Right side: Login Form */}
      <div className="flex w-full items-center justify-center bg-white p-8 lg:w-1/2">
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mx-auto flex w-full max-w-[400px] flex-col justify-center space-y-8"
        >
          <div className="flex flex-col space-y-2 text-center lg:text-left">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Welcome back</h1>
            <p className="text-slate-500">Sign in to manage your clinic with DentaSync.</p>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium animate-in fade-in slide-in-from-top-1 duration-300">
              {error}
            </div>
          )}

          <div className="grid gap-6">
            <form onSubmit={handleEmailLogin}>
              <div className="grid gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@clinic.com"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect="off"
                    disabled={loading}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 rounded-lg border-slate-200 bg-slate-50/50"
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link to="/forgot-password" size="sm" className="text-xs font-medium text-primary hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      disabled={loading}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 rounded-lg border-slate-200 bg-slate-50/50 pr-10"
                      required
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
                <Button type="submit" disabled={loading} className="h-11 w-full bg-primary hover:bg-primary/90">
                  {loading ? "Signing in..." : "Sign in with Email"}
                </Button>
              </div>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-500">Or continue with</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <Button 
                variant="outline" 
                type="button" 
                onClick={handleGoogleLogin}
                className="h-11 border-slate-200 hover:bg-slate-50"
              >
                <Chrome className="mr-2 h-4 w-4" />
                Google
              </Button>
            </div>
          </div>

          <p className="px-8 text-center text-sm text-slate-500">
            Don't have an account?{" "}
            <Link to="/register" className="font-semibold text-primary hover:underline">
              Register Clinic
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
