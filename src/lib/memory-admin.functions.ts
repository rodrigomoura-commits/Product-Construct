import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { db } from './firebase';

/**
 * REPLACING SERVER FUNCTIONS WITH CLIENT-SIDE LOGIC
 * This file is created to solve the RUNTIME_ERROR: getDashboardStats_createServerFn_handler
 */

export async function getDashboardStats() {
  try {
    const uCount = await getCountFromServer(collection(db, 'profiles'));
    const pCount = await getCountFromServer(collection(db, 'products'));
    const mCount = await getCountFromServer(collection(db, 'memories'));
    const rCount = await getCountFromServer(query(collection(db, 'user_roles'), where('role', 'in', ['admin', 'owner'])));
    
    return {
      users: uCount.data().count,
      products: pCount.data().count,
      memories: mCount.data().count,
      admins: rCount.data().count
    };
  } catch (e) {
    console.error("Error in getDashboardStats:", e);
    return {
      users: 0,
      products: 0,
      memories: 0,
      admins: 0
    };
  }
}
