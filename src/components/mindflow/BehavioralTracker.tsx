import React, { useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { recordBehavioralSignal } from '../../lib/mindflowBehavioral';

export const BehavioralTracker: React.FC = () => {
  const { user } = useAuth();
  const lastActiveRef = useRef<number>(Date.now());
  const interactionCountRef = useRef<number>(0);

  useEffect(() => {
    if (!user) return;

    const handleInteraction = async (type: string, value: string, evidence?: string, metadata?: any) => {
      // Throttle significantly to save quota
      const now = Date.now();
      if (type !== 'NAVIGATION' && now - lastActiveRef.current < 300000) { // Only allow interaction signals once per 5 minutes
        return;
      }
      
      interactionCountRef.current += 1;
      const timeSinceLast = now - lastActiveRef.current;
      lastActiveRef.current = now;

      try {
        await recordBehavioralSignal({
          user_id: user.uid,
          signal_type: 'interaction_cadence',
          signal_value: value,
          signal_strength: 0.5,
          confidence_score: 0.6,
          evidence: evidence || `Interaction cluster: ${type}`,
          source_type: 'user_interaction',
          metadata: {
            ...metadata,
            interaction_type: type,
            timeSinceLastInteraction: timeSinceLast,
            path: window.location.pathname,
            interactionCount: interactionCountRef.current
          }
        });
      } catch (error) {
        console.error('Failed to record behavioral signal:', error);
      }
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      handleInteraction('CLICK', 'user_click', `Clicked on ${target.tagName}`, {
        element: target.tagName,
        id: target.id,
        text: target.innerText?.slice(0, 50),
      });
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (['Enter', 'Tab'].includes(e.key)) {
        handleInteraction('KEYPRESS', 'user_key_action', `Pressed ${e.key}`, {
          key: e.key,
        });
      }
    };

    const handleScroll = () => {
      // Throttle scroll recording
      if (Date.now() - lastActiveRef.current > 10000) {
        handleInteraction('SCROLL', 'user_scroll', 'Page scroll detected', {
          scrollDepth: window.scrollY,
        });
      }
    };

    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('scroll', handleScroll);

    // Initial signal for session start
    handleInteraction('NAVIGATION', 'session_start', 'User started a new session');

    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [user]);

  return null;
};
