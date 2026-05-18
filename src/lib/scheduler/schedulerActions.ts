import {
  doc,
  updateDoc,
  setDoc,
  serverTimestamp,
  addDoc,
  collection,
  Timestamp,
  getDoc
} from "firebase/firestore";
import { db, cleanFirestoreData } from "../firebase";

export function getNextRunAtFromInterval(intervalMinutes: number) {
  const now = new Date();
  return Timestamp.fromDate(
    new Date(now.getTime() + intervalMinutes * 60 * 1000)
  );
}

export async function updateSchedulerFrequency({
  jobId,
  intervalMinutes,
  user,
  reason
}: {
  jobId: string;
  intervalMinutes: number;
  user: any;
  reason?: string;
}) {
  const safeInterval = Math.max(1, Math.min(Number(intervalMinutes || 1), 10080));

  await updateDoc(doc(db, "scheduler_jobs", jobId), cleanFirestoreData({
    recurrence_type: "fixed_interval",
    interval_minutes: safeInterval,
    cron_expression: null,
    next_run_at: getNextRunAtFromInterval(safeInterval),
    status: "active",
    updated_by: user?.uid || null,
    updated_by_email: user?.email || null,
    update_reason: reason || null,
    updated_at: serverTimestamp()
  }));

  await addDoc(collection(db, "scheduler_audit_logs"), cleanFirestoreData({
    job_id: jobId,
    action: "frequency_updated",
    interval_minutes: safeInterval,
    reason: reason || null,
    actor_uid: user?.uid || null,
    actor_email: user?.email || null,
    created_at: serverTimestamp()
  }));
}

export async function pauseSchedulerJob({ jobId, user, reason }: { jobId: string; user: any; reason?: string }) {
  await updateDoc(doc(db, "scheduler_jobs", jobId), cleanFirestoreData({
    status: "paused",
    paused_at: serverTimestamp(),
    paused_by: user?.uid || null,
    paused_by_email: user?.email || null,
    pause_reason: reason || null,
    updated_at: serverTimestamp()
  }));

  await addDoc(collection(db, "scheduler_audit_logs"), cleanFirestoreData({
    job_id: jobId,
    action: "paused",
    reason: reason || null,
    actor_uid: user?.uid || null,
    actor_email: user?.email || null,
    created_at: serverTimestamp()
  }));
}

export async function resumeSchedulerJob({ jobId, intervalMinutes, user, reason }: { jobId: string; intervalMinutes: number; user: any; reason?: string }) {
  const safeInterval = Math.max(1, Math.min(Number(intervalMinutes || 1), 10080));

  await updateDoc(doc(db, "scheduler_jobs", jobId), cleanFirestoreData({
    status: "active",
    resumed_at: serverTimestamp(),
    resumed_by: user?.uid || null,
    resumed_by_email: user?.email || null,
    interval_minutes: safeInterval,
    next_run_at: getNextRunAtFromInterval(safeInterval),
    resume_reason: reason || null,
    updated_at: serverTimestamp()
  }));

  await addDoc(collection(db, "scheduler_audit_logs"), cleanFirestoreData({
    job_id: jobId,
    action: "resumed",
    interval_minutes: safeInterval,
    reason: reason || null,
    actor_uid: user?.uid || null,
    actor_email: user?.email || null,
    created_at: serverTimestamp()
  }));
}

export async function disableSchedulerJob({ jobId, user, reason }: { jobId: string; user: any; reason?: string }) {
  await updateDoc(doc(db, "scheduler_jobs", jobId), cleanFirestoreData({
    status: "disabled",
    disabled_at: serverTimestamp(),
    disabled_by: user?.uid || null,
    disabled_by_email: user?.email || null,
    disable_reason: reason || null,
    updated_at: serverTimestamp()
  }));

  await addDoc(collection(db, "scheduler_audit_logs"), cleanFirestoreData({
    job_id: jobId,
    action: "disabled",
    reason: reason || null,
    actor_uid: user?.uid || null,
    actor_email: user?.email || null,
    created_at: serverTimestamp()
  }));
}

export async function updateOneTimeSchedule({ jobId, scheduledAt, user }: { jobId: string; scheduledAt: Timestamp | Date; user: any }) {
  const nextRunAt = scheduledAt instanceof Timestamp ? scheduledAt : Timestamp.fromDate(new Date(scheduledAt));

  await updateDoc(doc(db, "scheduler_jobs", jobId), cleanFirestoreData({
    recurrence_type: "one_time",
    scheduled_at: nextRunAt,
    next_run_at: nextRunAt,
    status: "active",
    updated_by: user?.uid || null,
    updated_by_email: user?.email || null,
    updated_at: serverTimestamp()
  }));

  await addDoc(collection(db, "scheduler_audit_logs"), cleanFirestoreData({
    job_id: jobId,
    action: "one_time_rescheduled",
    scheduled_at: nextRunAt,
    actor_uid: user?.uid || null,
    actor_email: user?.email || null,
    created_at: serverTimestamp()
  }));
}

export async function updateJobConfig({ jobId, config, user }: { jobId: string; config: any; user: any }) {
  await updateDoc(doc(db, "scheduler_jobs", jobId), cleanFirestoreData({
    config: config || {},
    updated_by: user?.uid || null,
    updated_by_email: user?.email || null,
    updated_at: serverTimestamp()
  }));

  await addDoc(collection(db, "scheduler_audit_logs"), cleanFirestoreData({
    job_id: jobId,
    action: "config_updated",
    actor_uid: user?.uid || null,
    actor_email: user?.email || null,
    created_at: serverTimestamp()
  }));
}
