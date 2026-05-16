import { create } from 'zustand';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  initialized: boolean;
  setLoading: (loading: boolean) => void;
  initialize: () => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  initialized: false,
  setLoading: (loading) => set({ loading }),
  initialize: () => {
    if (get().initialized) return;
    
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        set({ user, loading: true });
        try {
          const profileRef = doc(db, 'users', user.uid);
          const profileDoc = await getDoc(profileRef);
          
          if (profileDoc.exists()) {
            set({ profile: profileDoc.data() as UserProfile });
          } else {
            // Create a default profile for new users
              const newProfile: UserProfile = {
                uid: user.uid,
                email: user.email || '',
                displayName: user.displayName || 'Doctor',
                role: UserRole.DOCTOR, // Default role
                clinicId: `clinic_${user.uid}`, // Use UID as default clinic ID for isolation
                photoURL: user.photoURL || undefined,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
            await setDoc(profileRef, newProfile);
            set({ profile: newProfile });
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      } else {
        set({ user: null, profile: null });
      }
      set({ loading: false, initialized: true });
    });
  },
  signOut: async () => {
    await auth.signOut();
    set({ user: null, profile: null });
  }
}));
