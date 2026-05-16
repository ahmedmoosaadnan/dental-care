import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { doc, getDocFromServer } from 'firebase/firestore';
import { db } from './lib/firebase';
import { useAuthStore } from './store/useAuthStore';
import { motion, AnimatePresence } from 'motion/react';
import { Stethoscope } from 'lucide-react';

// Temporary Mock Components
const Login = () => <div className="flex h-screen items-center justify-center">Login Page (Coming Soon)</div>;
const Dashboard = () => <div>Dashboard Home</div>;
const Patients = () => <div>Patients Management</div>;
const Appointments = () => <div>Appointment Calendar</div>;
const POS = () => <div>Point of Sale & Billing</div>;
const Inventory = () => <div>Inventory Management</div>;
const Settings = () => <div>Settings</div>;

import DashboardLayout from './components/DashboardLayout';
import LoginPage from './pages/Login';
import RegisterPage from './pages/Register';
import ForgotPasswordPage from './pages/ForgotPassword';
import OverviewPage from './pages/Overview';
import PatientsPage from './pages/Patients';
import AppointmentsPage from './pages/Appointments';
import POSPage from './pages/POS';
import InventoryPage from './pages/Inventory';
import SettingsPage from './pages/Settings';
import JournalPage from './pages/Journal';
import DoctorsPage from './pages/Doctors';
import TreatmentsPage from './pages/Treatments';
import RemindersPage from './pages/Reminders';
import ReportsPage from './pages/Reports';
import MediaManagerPage from './pages/MediaManager';
import FollowUpsPage from './pages/FollowUps';
import NotificationsPage from './pages/Notifications';

export default function App() {
  const { initialize, loading, user } = useAuthStore();

  useEffect(() => {
    initialize();

    // Global Chart.js defaults (requested for design system)
    const setChartDefaults = () => {
      // @ts-ignore - Chart.js might not be in types but check if it exists in window
      if (window.Chart) {
        // @ts-ignore
        window.Chart.defaults.animation.duration = 600;
        // @ts-ignore
        window.Chart.defaults.animation.easing = 'easeInOutQuart';
        // @ts-ignore
        window.Chart.defaults.plugins.tooltip.animation.duration = 150;
        // @ts-ignore
        window.Chart.defaults.font.family = 'DM Sans';
      }
    };
    setChartDefaults();

    // Test connection to Firestore
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration or internet connection.");
        }
      }
    };
    testConnection();
  }, [initialize]);

  const [isSplashVisible, setIsSplashVisible] = useState(!sessionStorage.getItem('dentaSync-splash-seen'));

  useEffect(() => {
    if (isSplashVisible) {
      const timer = setTimeout(() => {
        sessionStorage.setItem('dentaSync-splash-seen', 'true');
        setIsSplashVisible(false);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [isSplashVisible]);

  if (isSplashVisible) {
    return (
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ delay: 1.5, duration: 0.5 }}
        onAnimationComplete={() => setIsSplashVisible(false)}
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0f1f2e]"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center gap-6"
        >
          <div className="h-20 w-20 flex items-center justify-center rounded-3xl bg-blue-600 text-white">
            <Stethoscope size={40} />
          </div>
          <div className="text-center">
            <h1 className="text-4xl font-display font-black text-white tracking-tight uppercase">DentaSync</h1>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.4em] mt-2">Powered by DevOxis</p>
          </div>
          <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden mt-4">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 1.2, ease: "easeInOut" }}
              className="h-full bg-blue-600"
            />
          </div>
        </motion.div>
      </motion.div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent shadow-lg"></div>
          <p className="text-sm font-medium text-slate-500">Syncing Practice Data...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/" />} />
        <Route path="/register" element={!user ? <RegisterPage /> : <Navigate to="/" />} />
        <Route path="/forgot-password" element={!user ? <ForgotPasswordPage /> : <Navigate to="/" />} />

        <Route element={user ? <DashboardLayout /> : <Navigate to="/login" />}>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/patients" element={<PatientsPage />} />
          <Route path="/appointments" element={<AppointmentsPage />} />
          <Route path="/pos" element={<POSPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/doctors" element={<DoctorsPage />} />
          <Route path="/treatments" element={<TreatmentsPage />} />
          <Route path="/reminders" element={<RemindersPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/media" element={<MediaManagerPage />} />
          <Route path="/follow-ups" element={<FollowUpsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/journal" element={<JournalPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}
