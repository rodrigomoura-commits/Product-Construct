import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { cleanFirestoreData } from './utils';

export type AuditLogType =
    | "user_invited"
    | "user_invite_accepted"
    | "user_role_changed"
    | "user_suspended"
    | "user_reactivated"
    | "admin_access_denied";

export async function logAuditEvent(
    actorId: string,
    actorEmail: string,
    type: AuditLogType,
    summary: string,
    targetUserId?: string,
    targetEmail?: string,
    metadata?: any
) {
    const logId = crypto.randomUUID();
    const logRef = doc(db, 'audit_logs', logId);

    await setDoc(logRef, cleanFirestoreData({
        id: logId,
        type,
        actor_id: actorId,
        actor_email: actorEmail,
        target_user_id: targetUserId,
        target_email: targetEmail,
        summary,
        metadata,
        created_at: serverTimestamp(),
    }));
}
