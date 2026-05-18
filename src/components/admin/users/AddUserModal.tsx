import React, { useState } from 'react';
import { collection, doc, setDoc, serverTimestamp, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { cleanFirestoreData } from '../../../lib/utils';
import { logAuditEvent } from '../../../lib/auditLog';
import { AlertCircle } from 'lucide-react';

interface AddUserModalProps {
  onClose: () => void;
}

export default function AddUserModal({ onClose }: AddUserModalProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'user' | 'admin' | 'owner'>('user');
  const [status, setStatus] = useState<'active' | 'suspended'>('active');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { profile } = useAuth();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail.includes('@')) throw new Error("E-mail inválido.");

      // Role permission check
      if (role !== 'user' && profile?.system_role !== 'owner') {
        throw new Error("Apenas Owner pode criar usuários Admin ou Owner.");
      }

      // Check for existing
      const existingQuery = query(collection(db, "users"), where("email", "==", normalizedEmail));
      const existingSnap = await getDocs(existingQuery);
      if (!existingSnap.empty) throw new Error("Já existe um usuário com este e-mail.");

      const userRef = doc(collection(db, "users"));
      await setDoc(userRef, cleanFirestoreData({
        id: userRef.id,
        uid: null,
        email: normalizedEmail,
        display_name: name.trim() || normalizedEmail,
        system_role: role,
        status: status,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        metadata: { source: "manual_admin_create", normalized: true }
      }));

      await logAuditEvent(
        profile?.id || '',
        profile?.email || '',
        'user_role_changed', // reusing or should add a new type? Let's use user_role_changed for now or create a better one.
        `Adicionou manualmente ${normalizedEmail} as ${role}`,
        userRef.id,
        normalizedEmail
      );

      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50">
      <div className="bg-white rounded-3xl w-full max-w-lg p-8 shadow-2xl">
        <h3 className="text-2xl font-black text-zinc-900">Adicionar Usuário</h3>
        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <input placeholder="Nome" className="w-full px-4 py-3 rounded-xl border border-zinc-200" value={name} onChange={e => setName(e.target.value)} />
          <input type="email" required placeholder="E-mail" className="w-full px-4 py-3 rounded-xl border border-zinc-200" value={email} onChange={e => setEmail(e.target.value)} />
          
          <select className="w-full px-4 py-3 rounded-xl border border-zinc-200" value={role} onChange={e => setRole(e.target.value as any)}>
            <option value="user">Usuário</option>
            {profile?.system_role === 'owner' && <option value="admin">Admin Operacional</option>}
            {profile?.system_role === 'owner' && <option value="owner">Owner da Instância</option>}
          </select>

          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={onClose} className="px-6 py-3 font-bold text-zinc-500">Cancelar</button>
            <button type="submit" disabled={loading} className="px-6 py-3 bg-zinc-900 text-white font-bold rounded-xl">{loading ? 'Adicionando...' : 'Adicionar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
