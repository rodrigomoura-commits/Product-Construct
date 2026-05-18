import React, { useState } from 'react';
import { Mail, Shield, AlertCircle } from 'lucide-react';
import { logAuditEvent } from '../../../lib/auditLog';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../contexts/AuthContext';

interface InviteUserModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function InviteUserModal({ onClose, onSuccess }: InviteUserModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'user' | 'admin' | 'owner'>('user');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { adminCtx, profile } = useAuth();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Basic validations
      if (!email || !email.includes('@')) throw new Error("E-mail inválido");

      // Verify if user already exists
      const q = query(collection(db, 'users'), where('email', '==', email.toLowerCase()));
      const snap = await getDocs(q);
      if (!snap.empty) throw new Error("Usuário já cadastrado.");

      // Verify invite already exists
      const iq = query(collection(db, 'user_invites'), where('email', '==', email.toLowerCase()), where('status', '==', 'pending'));
      const iSnap = await getDocs(iq);
      if (!iSnap.empty) throw new Error("Convite já enviado para este e-mail.");

      // Check role authorization
      if (role === 'owner' && profile?.system_role !== 'owner') throw new Error("Apenas Owner pode convidar outro Owner.");
      if (role === 'admin' && profile?.system_role !== 'owner') throw new Error("Apenas Owner pode convidar Admin.");

      // Create invite
      const inviteData = {
        email: email.toLowerCase(),
        system_role: role,
        status: 'pending',
        token: crypto.randomUUID(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        invited_by: profile?.id,
        invited_by_email: profile?.email,
        message,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      };

      await addDoc(collection(db, 'user_invites'), inviteData);
      
      await logAuditEvent(
        profile?.id || '',
        profile?.email || '',
        'user_invited',
        `Convidou ${email} como ${role}`,
        undefined,
        email.toLowerCase()
      );

      onSuccess();
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
        <h3 className="text-2xl font-black text-zinc-900">Convidar Usuário</h3>
        <p className="text-zinc-500 mt-1 mb-6">Envie um convite para acessar o Product Constructor.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-zinc-700 mb-1">E-mail</label>
            <input 
              type="email" 
              required
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-900 outline-none"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-zinc-700 mb-1">Papel Inicial</label>
            <select 
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-900 outline-none"
                value={role}
                onChange={e => setRole(e.target.value as any)}
            >
                <option value="user">Usuário</option>
                {profile?.system_role === 'owner' && <option value="admin">Admin Operacional</option>}
                {profile?.system_role === 'owner' && <option value="owner">Owner da Instância</option>}
            </select>
          </div>

          {error && <p className="text-red-500 font-bold text-sm bg-red-50 p-3 rounded-lg flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</p>}
          
          <div className="flex gap-3 justify-end mt-8">
            <button type="button" onClick={onClose} className="px-6 py-3 font-bold text-zinc-500">Cancelar</button>
            <button type="submit" disabled={loading} className="px-6 py-3 bg-zinc-900 rounded-xl text-white font-bold hover:opacity-90">{loading ? 'Enviando...' : 'Enviar convite'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
