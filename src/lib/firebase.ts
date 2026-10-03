import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
  signInAnonymously,
  signOut,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  enableNetwork,
  disableNetwork,
} from 'firebase/firestore';

// Your web app's Firebase configuration
// Primary: CPT Korat project configured by user
export const firebaseConfig = {
  apiKey: "AIzaSyDZDXdGoKxu-PcZ5UQc0RX2UVUHh6phcAs",
  authDomain: "engine-oil---adblue-cptkorat.firebaseapp.com",
  projectId: "engine-oil---adblue-cptkorat",
  storageBucket: "engine-oil---adblue-cptkorat.firebasestorage.app",
  messagingSenderId: "293294422668",
  appId: "1:293294422668:web:f732de4c6f6dd00b4f59a9",
  measurementId: "G-X6LZ6F7BLH"
};

// Initialize Firebase
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);

// Real-time Cloud Sync Status Management
export type CloudSyncStatus = 'connected' | 'permission_denied' | 'connecting' | 'offline';

let currentCloudSyncStatus: CloudSyncStatus = 'connecting';
let lastSyncErrorMessage: string | null = null;
const syncStatusListeners: Array<(status: CloudSyncStatus, errorMsg?: string | null) => void> = [];

export const getCloudSyncStatus = (): CloudSyncStatus => currentCloudSyncStatus;
export const getLastSyncError = (): string | null => lastSyncErrorMessage;

export const setCloudSyncStatus = (status: CloudSyncStatus, errorMsg?: string | null) => {
  currentCloudSyncStatus = status;
  if (errorMsg !== undefined) {
    lastSyncErrorMessage = errorMsg;
  }
  syncStatusListeners.forEach((cb) => cb(status, lastSyncErrorMessage));
};

export const subscribeCloudSyncStatus = (
  cb: (status: CloudSyncStatus, errorMsg?: string | null) => void
) => {
  syncStatusListeners.push(cb);
  cb(currentCloudSyncStatus, lastSyncErrorMessage);
  return () => {
    const idx = syncStatusListeners.indexOf(cb);
    if (idx !== -1) syncStatusListeners.splice(idx, 1);
  };
};

// Attempt auto-anonymous auth if user is not signed in
try {
  onAuthStateChanged(auth, (usr) => {
    if (!usr) {
      signInAnonymously(auth).catch((err) => {
        console.warn('Firebase anonymous auth status:', err?.code || err?.message || err);
      });
    }
  });
} catch {
  // Ignore
}

// In-memory / storage Google access token cache for Google Sheets sync
let cachedGoogleAccessToken: string | null = null;
try {
  cachedGoogleAccessToken = localStorage.getItem('google_access_token');
} catch {
  // Ignore in case localStorage is blocked
}

export const getAccessToken = async (): Promise<string | null> => {
  if (cachedGoogleAccessToken) {
    return cachedGoogleAccessToken;
  }
  if (auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      return token;
    } catch {
      return null;
    }
  }
  return null;
};

// App User session interface (supports both Firebase User and Local Team Member session)
export interface AppUserSession {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isLocalSession?: boolean;
}

export const ADMIN_EMAILS = [
  'chalermpat.korat1499@gmail.com',
  'chalermpat.cptkorat@gmail.com',
];

export const ADMIN_EMAIL = 'chalermpat.korat1499@gmail.com';

export const isSoleAdmin = (user: AppUserSession | null): boolean => {
  if (!user) return false;
  if (user.email && ADMIN_EMAILS.some((e) => e.toLowerCase() === user.email!.trim().toLowerCase())) return true;
  if (user.displayName && (user.displayName.includes('เฉลิมพัฒน์') || user.displayName.includes('ผู้ดูแลระบบ'))) return true;
  return false;
};

// Local session storage helper
const LOCAL_USER_KEY = 'cpt_stock_local_user';
let activeLocalUser: AppUserSession | null = null;
try {
  const stored = localStorage.getItem(LOCAL_USER_KEY);
  if (stored) {
    activeLocalUser = JSON.parse(stored);
  }
} catch {
  activeLocalUser = null;
}

// Global auth callbacks
const authListeners: Array<(user: AppUserSession | null) => void> = [];

export const getActiveUser = (): AppUserSession | null => {
  if (auth.currentUser) {
    return {
      uid: auth.currentUser.uid,
      email: auth.currentUser.email,
      displayName: auth.currentUser.displayName,
      photoURL: auth.currentUser.photoURL,
      isLocalSession: false,
    };
  }
  return activeLocalUser;
};

// Authentication Methods
export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/spreadsheets');
  provider.addScope('https://www.googleapis.com/auth/drive.file');
  provider.setCustomParameters({
    prompt: 'select_account'
  });
  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (credential?.accessToken) {
    cachedGoogleAccessToken = credential.accessToken;
    try {
      localStorage.setItem('google_access_token', credential.accessToken);
    } catch {
      // Ignore
    }
  }
  return result;
};

export const signInWithFacebook = async () => {
  const provider = new FacebookAuthProvider();
  return await signInWithPopup(auth, provider);
};

export const loginWithEmail = async (email: string, password: string) => {
  return await signInWithEmailAndPassword(auth, email, password);
};

export const registerWithEmail = async (
  email: string,
  password: string,
  displayName: string
) => {
  const res = await createUserWithEmailAndPassword(auth, email, password);
  if (res.user && displayName) {
    await updateProfile(res.user, { displayName });
  }
  return res;
};

// Immediate Team Member Login (allows instant access on current device)
export const loginAsLocalMember = (displayName: string, email?: string): AppUserSession => {
  const user: AppUserSession = {
    uid: 'local-team-' + Date.now(),
    email: email || 'chalermpat.cptkorat@gmail.com',
    displayName: displayName || 'ช่างเฉลิมพัฒน์ (ผู้ดูแลระบบ CPT KR)',
    photoURL: null,
    isLocalSession: true,
  };
  activeLocalUser = user;
  try {
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
  } catch {
    // Ignore
  }
  authListeners.forEach((cb) => cb(user));
  return user;
};

export const initAuthObserver = (callback: (user: AppUserSession | null) => void) => {
  authListeners.push(callback);

  const unsubFirebase = onAuthStateChanged(auth, (firebaseUser) => {
    if (firebaseUser) {
      const u: AppUserSession = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        isLocalSession: false,
      };
      callback(u);
    } else if (activeLocalUser) {
      callback(activeLocalUser);
    } else {
      callback(null);
    }
  });

  // Call immediately with initial state
  callback(getActiveUser());

  return () => {
    unsubFirebase();
    const idx = authListeners.indexOf(callback);
    if (idx !== -1) {
      authListeners.splice(idx, 1);
    }
  };
};

export const logoutUser = async () => {
  cachedGoogleAccessToken = null;
  activeLocalUser = null;
  try {
    localStorage.removeItem('google_access_token');
    localStorage.removeItem(LOCAL_USER_KEY);
  } catch {
    // Ignore
  }
  authListeners.forEach((cb) => cb(null));
  try {
    await signOut(auth);
  } catch {
    // Ignore
  }
};

export const testFirestoreConnection = async () => {
  try {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000));
    await Promise.race([
      getDocFromServer(doc(db, 'test', 'connection')),
      timeout
    ]);
    setCloudSyncStatus('connected', null);
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('denied')) {
      setCloudSyncStatus('permission_denied', msg);
    } else if (msg.toLowerCase().includes('offline')) {
      setCloudSyncStatus('offline', msg);
    }
  }
};
