import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, query, collection, where, getDocs } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Profile, UserRole, AdminCtx } from '../types';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  adminCtx: AdminCtx | null;
  loading: boolean;
  quotaExceeded: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
  setQuotaExceeded: (exceeded: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [adminCtx, setAdminCtx] = useState<AdminCtx | null>(null);
  const [loading, setLoading] = useState(true);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  // Helper to handle context-wide quota state
  const handleQuotaError = (error: any) => {
    if (error.message?.includes('Quota exceeded')) {
      setQuotaExceeded(true);
      return true;
    }
    return false;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setUser(user);
        if (user) {
          // Sync profile
          const profileRef = doc(db, 'profiles', user.uid);
          
          try {
            const profileSnap = await getDoc(profileRef);
            
            if (!profileSnap.exists()) {
              const newProfile = {
                id: user.uid,
                display_name: user.displayName || 'Usuário',
                email: user.email || '',
                avatar_url: user.photoURL || '',
                created_at: serverTimestamp(),
                updated_at: serverTimestamp(),
              };
              await setDoc(profileRef, newProfile);
              setProfile(newProfile as unknown as Profile);
            } else {
              setProfile(profileSnap.data() as Profile);
            }
          } catch (profileError: any) {
            console.error('Profile sync failed:', profileError);
            if (profileError.message?.includes('Quota exceeded')) {
              // Fallback profile if quota is dead
              setProfile({
                id: user.uid,
                display_name: user.displayName || 'User (Limited Mode)',
                email: user.email || '',
                avatar_url: user.photoURL || '',
              } as any);
            }
          }

          // Check roles for admin context
          await loadAdminContext(user.uid);
        } else {
          setProfile(null);
          setAdminCtx(null);
        }
      } catch (error: any) {
        console.error('Error during auth identity sync:', error);
        if (error.message?.includes('Quota exceeded')) {
          setQuotaExceeded(true);
          toast.error("Limite de uso (Quota) do Firebase excedido. Algumas funcionalidades podem não funcionar até o reset diário.", {
            id: 'quota-error',
            duration: 10000
          });
        }
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  async function loadAdminContext(userId: string) {
    const roles: UserRole[] = [];
    
    // Check if user is the hardcoded owner
    const targetEmail = 'celular@rodrigomoura.net';
    const userEmail = auth.currentUser?.email?.toLowerCase();
    const isGlobalAdmin = userEmail === targetEmail;

    if (isGlobalAdmin) {
      roles.push('owner');
      // Attempt to sync to DB but don't block if quota is dead
      try {
        const roleRef = doc(db, 'user_roles', `${userId}_owner`);
        const roleSnap = await getDoc(roleRef);
        if (!roleSnap.exists()) {
          await setDoc(roleRef, {
            user_id: userId,
            role: 'owner',
            granted_by: 'system',
            created_at: serverTimestamp()
          });
        }
      } catch (error) {
        console.warn('Could not sync owner role to DB (likely quota):', error);
      }
    }

    // Only try to fetch external roles if NOT global admin or if quota permits
    if (!isGlobalAdmin) {
      try {
        const q = query(collection(db, 'user_roles'), where('user_id', '==', userId));
        const querySnap = await getDocs(q);
        querySnap.docs.forEach(d => {
          const roleData = d.data();
          if (roleData.role && !roles.includes(roleData.role)) {
            roles.push(roleData.role as UserRole);
          }
        });
      } catch (error: any) {
        console.warn('Failed to fetch user roles:', error);
        if (error.message?.includes('Quota exceeded')) {
          setQuotaExceeded(true);
        }
      }
    }

    const isOwner = roles.includes('owner');
    const isAdmin = roles.includes('admin') || isOwner;

    setAdminCtx({
      isAdmin,
      isOwner,
      roles,
      userId
    });
  }

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      adminCtx, 
      loading, 
      quotaExceeded, 
      signIn, 
      logout,
      setQuotaExceeded
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
