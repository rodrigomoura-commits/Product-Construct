import {
  doc,
  increment,
  serverTimestamp,
  setDoc
} from "firebase/firestore";
import { db } from "./firebase";

export async function recordProductInteraction({
  productId,
  user,
  profile,
  role,
  section,
  event
}: any) {
  if (!productId || !user?.uid) return;

  const patch: any = {
    uid: user.uid,
    email: user.email || profile?.email || null,
    display_name: profile?.display_name || user.displayName || user.email || null,
    role: role || "viewer",
    last_opened_at: serverTimestamp(),
    last_section: section || null,
    updated_at: serverTimestamp()
  };

  if (event === "message_created") {
    patch.last_message_at = serverTimestamp();
    patch["counters.messages_created"] = increment(1);
  }

  if (event === "artifact_created") {
    patch.last_edited_at = serverTimestamp();
    patch["counters.artifacts_created"] = increment(1);
  }

  if (event === "decision_created") {
    patch.last_edited_at = serverTimestamp();
    patch["counters.decisions_created"] = increment(1);
  }

  if (event === "document_uploaded") {
    patch.last_edited_at = serverTimestamp();
    patch["counters.documents_uploaded"] = increment(1);
  }

  await setDoc(
    doc(db, "products", productId, "user_interactions", user.uid),
    patch,
    { merge: true }
  );
}
