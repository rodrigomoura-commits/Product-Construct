import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, updateDoc, setDoc, serverTimestamp, addDoc, limit } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { cleanFirestoreData } from '../lib/utils';
import { Loader2 } from 'lucide-react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

export default function AcceptUserInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    async function accept() {
      if (!auth.currentUser) {
        // Simple auth check, if not logged in, prompt login
        try {
            const provider = new GoogleAuthProvider();
            provider.setCustomParameters({
              prompt: "select_account"
            });
            await signInWithPopup(auth, provider);
            return; // onAuthStateChanged will handle the rest
        } catch (e) {
            setError("Falha ao autenticar.");
            setLoading(false);
            return;
        }
      }

      if (token && auth.currentUser) {
        acceptInvite(token, auth.currentUser);
      }
    }
    accept();
  }, [token, auth.currentUser]);

  async function acceptInvite(token: string, currentUser: any) {
    try {
      const inviteQuery = query(collection(db, "user_invites"), where("token", "==", token), limit(1));
      const inviteSnap = await getDocs(inviteQuery);

      if (inviteSnap.empty) throw new Error("Convite inválido.");
      
      const inviteDoc = inviteSnap.docs[0];
      const invite = { id: inviteDoc.id, ...inviteDoc.data() } as any;

      if (invite.status !== "pending") throw new Error("Convite já utilizado ou indisponível.");
      if (invite.expires_at?.toDate?.() < new Date()) {
          await updateDoc(doc(db, "user_invites", invite.id), { status: "expired" });
          throw new Error("Convite expirou.");
      }
      
      if (currentUser.email?.toLowerCase() !== invite.email?.toLowerCase()) throw new Error("Este convite foi enviado para outro e-mail.");

      // Set user profile
      const userRef = doc(db, "users", currentUser.uid);
      await setDoc(userRef, cleanFirestoreData({
        id: currentUser.uid,
        uid: currentUser.uid,
        email: currentUser.email?.toLowerCase(),
        display_name: currentUser.displayName || currentUser.email,
        photo_url: currentUser.photoURL || null,
        system_role: invite.system_role || "user",
        status: "active",
        invited_by: invite.invited_by || null,
        invited_by_email: invite.invited_by_email || null,
        updated_at: serverTimestamp(),
        last_login_at: serverTimestamp()
      }), { merge: true });

      await updateDoc(doc(db, "user_invites", invite.id), cleanFirestoreData({
        status: "accepted",
        accepted_by: currentUser.uid,
        accepted_at: serverTimestamp()
      }));

      await addDoc(collection(db, "audit_logs"), cleanFirestoreData({
        type: "user_invite_accepted",
        actor_id: currentUser.uid,
        summary: `Convite aceito`,
        created_at: serverTimestamp()
      }));

      navigate('/products');
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  return (
    <div className="h-screen flex items-center justify-center">
        {loading ? <Loader2 className="animate-spin w-10 h-10" /> : <div className="text-red-500 font-bold">{error}</div>}
    </div>
  );
}
