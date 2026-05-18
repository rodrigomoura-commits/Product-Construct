import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Profile, AdminCtx, SystemUser } from '../types';
import { cleanFirestoreData } from '../lib/utils';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  profile: SystemUser | null;
  adminCtx: AdminCtx | null;
  loading: boolean;
  quotaExceeded: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
  setQuotaExceeded: (exceeded: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

import { acceptPendingInvitesForUser } from '../lib/inviteAcceptance';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<SystemUser | null>(null);
  const [adminCtx, setAdminCtx] = useState<AdminCtx | null>(null);
  const [loading, setLoading] = useState(true);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setUser(user);
        if (user) {
          const syncedProfile = await syncUserProfile(user);
          setProfile(syncedProfile);
          await loadAdminContext(user.uid, syncedProfile);
        } else {
          setProfile(null);
          setAdminCtx(null);
        }
      } catch (error: any) {
        console.error('Error during auth identity sync:', error);
        if (error.message?.includes('Quota exceeded')) {
          setQuotaExceeded(true);
        }
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  async function syncUserProfile(user: User): Promise<SystemUser> {
    const email = user.email?.toLowerCase() || "";
    const sanitizedEmail = email.replace(/[.@]/g, '_');
    
    // Check if user was explicitly deleted/blocked
    const deletedUserRef = doc(db, "deleted_users", sanitizedEmail);
    const deletedUserSnap = await getDoc(deletedUserRef);
    
    if (deletedUserSnap.exists()) {
      await signOut(auth);
      throw new Error("Seu acesso foi removido desta instância. Entre em contato com o suporte se achar que isso é um erro.");
    }

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    const displayName = user.displayName || email || "Usuário";
    const photoUrl = user.photoURL || null;

    const ownerEmail = (import.meta as any).env.VITE_OWNER_EMAIL?.toLowerCase() || "celular@rodrigomoura.net";
    const isMasterOwner = email === ownerEmail;

    if (!userSnap.exists()) {
      try {
        // Try finding a manually created user by email
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const emailQuerySnap = await getDocs(query(collection(db, "users"), where("email", "==", email)));
        
        if (!emailQuerySnap.empty) {
          const manualUserDoc = emailQuerySnap.docs[0];
          const existing = manualUserDoc.data() as SystemUser;
          
          if (existing.status === "suspended") {
            throw new Error("Seu acesso está suspenso. Fale com um administrador.");
          }
          
          const patch = cleanFirestoreData({
            email,
            display_name: existing.display_name || displayName,
            photo_url: photoUrl || existing.photo_url || null,
            uid: user.uid, // link the real uid to this manual user document
            system_role: existing.system_role || (isMasterOwner ? "owner" : "user"),
            status: existing.status || "active",
            updated_at: serverTimestamp(),
            last_login_at: serverTimestamp(),
            metadata: {
              ...(existing.metadata || {}),
              normalized: true,
              merged_from_manual: true
            }
          });
          
          await setDoc(manualUserDoc.ref, patch, { merge: true });
          
          const updatedProfile = {
            ...existing,
            ...patch,
            id: manualUserDoc.id
          };
          
          try {
            await acceptPendingInvitesForUser(user, updatedProfile);
          } catch (e) {
            console.warn("[AuthContext] failed to accept pending invites for manual user", e);
          }
          
          return updatedProfile as SystemUser;
        }
      } catch (error) {
        console.warn("[AuthContext] failed to query manual user by email", error);
      }

      const newProfile = cleanFirestoreData({
        id: user.uid,
        uid: user.uid,
        email,
        display_name: displayName,
        photo_url: photoUrl,
        system_role: isMasterOwner ? "owner" : "user",
        status: "active",
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        last_login_at: serverTimestamp(),
        metadata: {
          source: isMasterOwner ? "bootstrap_owner" : "google_login",
          normalized: true
        }
      });

      await setDoc(userRef, newProfile);
      
      try {
        await acceptPendingInvitesForUser(user, newProfile);
      } catch (e) {
        console.warn("[AuthContext] failed to accept pending invites", e);
      }
      
      return newProfile as SystemUser;
    }

    const existing = userSnap.data() as SystemUser;

    if (existing.status === "suspended") {
      throw new Error("Seu acesso está suspenso. Fale com um administrador.");
    }

    const patch = cleanFirestoreData({
      email,
      display_name: existing.display_name || displayName,
      photo_url: photoUrl || existing.photo_url || null,
      uid: existing.uid || user.uid,
      system_role: existing.system_role || (isMasterOwner ? "owner" : "user"),
      status: existing.status || "active",
      updated_at: serverTimestamp(),
      last_login_at: serverTimestamp(),
      metadata: {
        ...(existing.metadata || {}),
        normalized: true
      }
    });

    await setDoc(userRef, patch, { merge: true });

    const updatedProfile = {
      ...existing,
      ...patch,
      id: userSnap.id
    };

    try {
      await acceptPendingInvitesForUser(user, updatedProfile);
    } catch (e) {
      console.warn("[AuthContext] failed to accept pending invites", e);
    }

    return updatedProfile as SystemUser;
  }

  async function loadAdminContext(userId: string, profile: SystemUser) {
    const role = profile.system_role || "user";

    const isOwner = role === "owner";
    const isAdmin = role === "admin" || role === "owner";

    setAdminCtx({
      isAdmin,
      isOwner,
      roles: [(role === "user" ? "viewer" : role) as any],
      userId,
      email: profile.email
    });
  }


  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: "select_account"
    });
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setProfile(null);
      setAdminCtx(null);
      localStorage.removeItem("activeProductId");
      localStorage.removeItem("activeProductContext");
      sessionStorage.clear();
    } catch (error) {
      console.error("[AuthContext] Error signing out:", error);
      throw error;
    }
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
