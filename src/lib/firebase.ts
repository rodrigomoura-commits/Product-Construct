import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: any, operationType: OperationType, path: string | null) {
  const isQuotaError = error?.code === 'resource-exhausted' || 
                       (error?.message && error.message.includes('Quota limit exceeded'));

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  }
  
  if (isQuotaError) {
    console.warn('⚠️ FIRESTORE QUOTA EXCEEDED: Operation stopped to prevent further failures.', errInfo);
    // We could attach a specialized flag here
    (error as any).isQuotaExhausted = true;
  } else {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  }
  
  throw error;
}

/**
 * Safe version of database operations that ignores quota errors for non-critical non-blocking operations.
 */
export async function safeWrite(op: () => Promise<any>, label: string = 'operation') {
  try {
    return await op();
  } catch (error: any) {
    const isQuotaError = error?.code === 'resource-exhausted' || 
                         (error?.message && error.message.includes('Quota limit exceeded'));
    
    if (isQuotaError) {
      console.warn(`[SafeWrite] Quota exceeded for ${label}, skipping.`);
      return null;
    }
    throw error;
  }
}

/**
 * Removes undefined values from an object recursively to avoid Firestore errors.
 */
export function cleanFirestoreData(data: any): any {
  if (data === null || data === undefined) return null;
  
  if (Array.isArray(data)) {
    return data.map(item => cleanFirestoreData(item));
  }
  
  if (typeof data === 'object' && !(data instanceof Date) && !(data.constructor?.name === 'Timestamp') && !(data.constructor?.name === 'FieldValue')) {
    const cleaned: any = {};
    Object.keys(data).forEach(key => {
      const value = data[key];
      if (value !== undefined) {
        cleaned[key] = cleanFirestoreData(value);
      }
    });
    return cleaned;
  }
  
  return data;
}
