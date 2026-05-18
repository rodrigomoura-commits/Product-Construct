import { 
  collection, addDoc, serverTimestamp, Timestamp, 
  query, where, getDocs, updateDoc, doc, 
  arrayUnion, arrayRemove, getDoc, setDoc 
} from 'firebase/firestore';
import { db } from './firebase';
import { Product, AdminCtx } from '../types';
import { canManageProductAccess, recalculateProductAccess } from './productAccess';
import { addDays } from 'date-fns';

export async function createProductInvite({
  product,
  email,
  role,
  currentUser,
  adminCtx
}: {
  product: Product;
  email: string;
  role: "editor" | "commenter" | "viewer";
  currentUser: any;
  adminCtx?: AdminCtx;
}) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail.includes("@")) {
    throw new Error("Informe um e-mail válido.");
  }

  const canManage = canManageProductAccess(product, currentUser, adminCtx);

  if (!canManage) {
    throw new Error("Você não tem permissão para convidar pessoas para este produto.");
  }

  // 1. Verificar se usuário já existe no sistema
  const existingUserSnap = await getDocs(
    query(collection(db, "users"), where("email", "==", normalizedEmail))
  );

  if (!existingUserSnap.empty) {
    throw new Error("Este e-mail já pertence a um usuário do sistema. Use a opção Adicionar usuário.");
  }

  // 2. Verificar se já é colaborador do produto
  const existingCollaboratorSnap = await getDocs(
    query(
      collection(db, "products", product.id, "collaborators"),
      where("email", "==", normalizedEmail)
    )
  );

  const isAlreadyCollaborator = existingCollaboratorSnap.docs.some(docSnap => {
    const data = docSnap.data();
    return (data.status || "active") === "active";
  });

  if (isAlreadyCollaborator || product.collaborator_emails?.includes(normalizedEmail)) {
    throw new Error("Esta pessoa já tem acesso ao produto.");
  }

  const existingPendingInvite = await checkPendingInvite(product.id, normalizedEmail);

  if (existingPendingInvite) {
    throw new Error("Já existe um convite pendente para este e-mail.");
  }

  const token = crypto.randomUUID();

  const invite = {
    product_id: product.id,
    product_name: product.name,
    email: normalizedEmail,
    role,
    status: "pending",
    invited_by: currentUser.uid,
    invited_by_email: currentUser.email,
    invited_by_name: currentUser.displayName || currentUser.email,
    token,
    expires_at: Timestamp.fromDate(addDays(new Date(), 14)),
    created_at: serverTimestamp(),
    updated_at: serverTimestamp()
  };

  const globalRef = await addDoc(collection(db, "product_invites"), invite);

  await setDoc(
    doc(db, `products/${product.id}/invites`, globalRef.id),
    {
      ...invite,
      invite_id: globalRef.id
    }
  );

  await updateDoc(doc(db, "products", product.id), {
    pending_invite_emails: arrayUnion(normalizedEmail),
    updated_at: serverTimestamp()
  });

  await addDoc(collection(db, `products/${product.id}/history_events`), {
    type: "product_invite_sent",
    title: "Convite enviado",
    summary: `${normalizedEmail} foi convidado como ${role}.`,
    actor_id: currentUser.uid,
    actor_email: currentUser.email,
    target_email: normalizedEmail,
    role,
    created_at: serverTimestamp()
  });

  return {
    inviteId: globalRef.id,
    token,
    inviteLink: `${window.location.origin}/invites/product/${token}`
  };
}

async function checkPendingInvite(productId: string, email: string) {
  const q = query(
    collection(db, "product_invites"), 
    where("product_id", "==", productId),
    where("email", "==", email),
    where("status", "==", "pending")
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

export async function findInviteByToken(token: string) {
  const q = query(collection(db, "product_invites"), where("token", "==", token));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
}

export async function acceptProductInvite({ token, currentUser }: { token: string, currentUser: any }) {
  const invite = await findInviteByToken(token);

  if (!invite) throw new Error("Convite inválido.");
  if (invite.status !== "pending") throw new Error("Convite não está mais disponível.");
  if (invite.expires_at.toDate() < new Date()) throw new Error("Convite expirado.");

  if (invite.email.toLowerCase() !== currentUser.email.toLowerCase()) {
    throw new Error("Este convite foi enviado para outro e-mail.");
  }

  const productRef = doc(db, "products", invite.product_id);
  const productSnap = await getDoc(productRef);

  if (!productSnap.exists()) {
    throw new Error("Produto não encontrado.");
  }

  const product = { id: productSnap.id, ...productSnap.data() } as Product;

  const newCollaborator = {
    user_id: currentUser.uid,
    email: currentUser.email,
    name: currentUser.displayName || currentUser.email,
    role: invite.role,
    status: "active" as const,
    added_by: invite.invited_by,
    added_by_email: invite.invited_by_email,
    added_at: new Date()
  };

  const collaborators = [
    ...(product.collaborators || []).filter(c =>
      c.email?.toLowerCase() !== currentUser.email.toLowerCase()
    ),
    newCollaborator
  ];

  const updatedProduct = recalculateProductAccess({
    ...product,
    collaborators
  });

  await updateDoc(productRef, {
    collaborators: updatedProduct.collaborators,
    collaborator_ids: updatedProduct.collaborator_ids,
    collaborator_emails: updatedProduct.collaborator_emails,
    owner_ids: updatedProduct.owner_ids,
    editor_ids: updatedProduct.editor_ids,
    commenter_ids: updatedProduct.commenter_ids,
    viewer_ids: updatedProduct.viewer_ids,
    pending_invite_emails: arrayRemove(currentUser.email.toLowerCase()),
    updated_at: serverTimestamp()
  });

  await updateDoc(doc(db, "product_invites", invite.id), {
    status: "accepted",
    accepted_by: currentUser.uid,
    accepted_at: serverTimestamp(),
    updated_at: serverTimestamp()
  });

  await updateDoc(doc(db, `products/${invite.product_id}/invites`, invite.id), {
    status: "accepted",
    accepted_by: currentUser.uid,
    accepted_at: serverTimestamp(),
    updated_at: serverTimestamp()
  });

  await addDoc(collection(db, `products/${invite.product_id}/history_events`), {
    type: "product_invite_accepted",
    title: "Convite aceito",
    summary: `${currentUser.email} aceitou o convite como ${invite.role}.`,
    actor_id: currentUser.uid,
    actor_email: currentUser.email,
    role: invite.role,
    created_at: serverTimestamp()
  });

  return invite.product_id;
}
