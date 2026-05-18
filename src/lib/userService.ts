import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, getDocs, where } from 'firebase/firestore';
import { db } from './firebase';
import { logAuditEvent, AuditLogType } from './auditLog';

export interface UserProfile {
  id: string;
  uid: string;
  email: string;
  display_name?: string;
  photo_url?: string;
  system_role: "owner" | "admin" | "user";
  status: "active" | "invited" | "suspended" | "disabled";
  created_at: any;
  updated_at: any;
  last_login_at?: any;
  metadata?: {
    source?: "google_login" | "admin_invite" | "migration" | "bootstrap",
    normalized?: boolean
  }
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return null;
    return snap.data() as UserProfile;
}

export async function updateUserRole(
    actorId: string, 
    actorEmail: string, 
    targetUserId: string, 
    newRole: "owner" | "admin" | "user",
    reason: string
) {
    const userRef = doc(db, 'users', targetUserId);
    const targetUser = await getUserProfile(targetUserId);
    
    if (!targetUser) throw new Error("Usuário não encontrado");

    await updateDoc(userRef, {
        system_role: newRole,
        updated_at: serverTimestamp()
    });
    
    await logAuditEvent(
        actorId,
        actorEmail,
        "user_role_changed",
        `Alterou papel de ${targetUser.email} para ${newRole}. Motivo: ${reason}`,
        targetUserId,
        targetUser.email,
        { previous_role: targetUser.system_role, new_role: newRole }
    );
}

export async function suspendUser(
    actorId: string,
    actorEmail: string,
    targetUserId: string,
    reason: string
) {
    const userRef = doc(db, 'users', targetUserId);
    const targetUser = await getUserProfile(targetUserId);
    if (!targetUser) throw new Error("Usuário não encontrado");

    await updateDoc(userRef, {
        status: "suspended",
        suspended_by: actorId,
        suspended_by_email: actorEmail,
        suspended_at: serverTimestamp(),
        suspension_reason: reason,
        updated_at: serverTimestamp()
    });

    await logAuditEvent(
        actorId,
        actorEmail,
        "user_suspended",
        `Suspendeu ${targetUser.email}. Motivo: ${reason}`,
        targetUserId,
        targetUser.email
    );
}
