import { collection, query, where, orderBy, limit as firestoreLimit, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, cleanFirestoreData } from './firebase';

export interface ConversationMessage {
  id?: string;
  product_id: string;
  user_id: string;
  user_email: string;
  conversation_id?: string;
  stage_key: string;
  role: "user" | "assistant" | "system";
  content: string;
  structured_data?: any;
  question_strategy?: any;
  memory_updates?: any[];
  is_error?: boolean;
  metadata?: any;
  source: "tona_chat" | "resume" | "system" | "tona_chat_reopen";
  created_at?: any;
}

export async function saveConversationMessage(params: Omit<ConversationMessage, 'id' | 'created_at'>) {
  try {
    const messagesRef = collection(db, `products/${params.product_id}/conversation_messages`);
    const docRef = await addDoc(messagesRef, cleanFirestoreData({
      ...params,
      created_at: serverTimestamp()
    }));
    return docRef.id;
  } catch (error) {
    console.error("Failed to save conversation message:", error);
    return null;
  }
}

export async function getRecentConversationMessages(params: {
  productId: string;
  userId: string;
  stageKey?: string;
  limit?: number;
}) {
  try {
    const messagesRef = collection(db, `products/${params.productId}/conversation_messages`);
    let q = query(
      messagesRef,
      where('user_id', '==', params.userId),
      orderBy('created_at', 'desc'),
      firestoreLimit(params.limit || 30)
    );
    
    // In case we don't have index for stage_key, maybe just sort globally for now to reduce index complex.
    // If strict we should where('stage_key', '==', params.stageKey) but it requires composite index. 
    // Let's filter locally for MVP or just get all product messages. Actually getting all product messages is better for continuity!
    
    const snapshot = await getDocs(q);
    const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ConversationMessage));
    
    return messages.reverse(); // Return in chronological order
  } catch (error) {
    console.error("Failed to get conversation messages:", error);
    return [];
  }
}

export async function buildConversationHistoryPack(params: {
  productId: string;
  userId: string;
  stageKey?: string;
  limit?: number;
}) {
  const recentMessages = await getRecentConversationMessages(params);
  
  return {
    recent_messages: recentMessages,
    last_user_message: recentMessages.filter(m => m.role === 'user').pop() || null,
    last_assistant_message: recentMessages.filter(m => m.role === 'assistant').pop() || null,
  };
}
