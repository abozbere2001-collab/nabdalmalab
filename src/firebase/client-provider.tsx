
"use client";

import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';
import { FirebaseProvider } from './provider';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

// This is a re-implementation of the context provider to simplify initialization
export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const services = useMemo(() => {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    const firestore = getFirestore(app);
    
    // Dynamically set authDomain to fix popup authentication issues in ephemeral environments
    const auth = getAuth(app);
    if (typeof window !== 'undefined') {
      auth.tenantId = null; // Reset any previous tenant ID
      auth.settings.authDomain = window.location.hostname;
    }

    return { firebaseApp: app, auth, firestore };
  }, []);

  return (
    <FirebaseProvider
      firebaseApp={services.firebaseApp}
      auth={services.auth}
      firestore={services.firestore}
    >
      {children}
    </FirebaseProvider>
  );
}
