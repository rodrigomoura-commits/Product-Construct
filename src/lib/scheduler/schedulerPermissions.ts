export function canEditSchedulerJob(userRole: string | undefined, job: any) {
  if (userRole === "owner") return true;
  if (job?.system_job) return false;
  return userRole === "admin" && job?.allow_admin_edit === true;
}

export function canPauseSchedulerJob(userRole: string | undefined, job: any) {
  if (userRole === "owner") return true;
  if (job?.system_job) return false;
  return userRole === "admin" && job?.allow_pause === true;
}

export function canRunSchedulerJob(userRole: string | undefined, job: any) {
  if (userRole === "owner") return true;
  if (userRole === "admin" && job?.allow_manual_run !== false) return true;
  return false;
}

export function canDeleteSchedulerJob(userRole: string | undefined, job: any) {
  if (userRole !== "owner") return false;
  if (job?.system_job) return false;
  return job?.allow_delete === true;
}
