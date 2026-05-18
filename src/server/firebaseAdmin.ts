import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

console.log("[Firebase Admin] Initializing...");

function normalizePrivateKey(value?: string) {
  if (!value) return undefined;
  return value.replace(/\\n/g, "\n");
}

function parseServiceAccountFromEnv() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (raw) {
    let jsonString = raw.trim();

    try {
      if (!jsonString.startsWith("{")) {
        jsonString = Buffer.from(jsonString, "base64").toString("utf8");
      }

      const parsed = JSON.parse(jsonString);

      if (parsed.private_key) {
        parsed.private_key = normalizePrivateKey(parsed.private_key);
      }

      if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT incompleto. Campos obrigatórios: project_id, client_email, private_key.");
      }

      return parsed;
    } catch (error) {
      console.error("[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT:", error);
      throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT format");
    }
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    firebaseConfig.projectId;

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  if (projectId && clientEmail && privateKey) {
    return {
      project_id: projectId,
      client_email: clientEmail,
      private_key: privateKey
    };
  }

  return null;
}

const serviceAccount = parseServiceAccountFromEnv();

export const hasServiceAccount = Boolean(serviceAccount);

export const firebaseAdminProjectId = serviceAccount?.project_id || null;
export const firebaseClientProjectId = firebaseConfig.projectId;
export const firebaseDatabaseId = (firebaseConfig as any).firestoreDatabaseId || "(default)";

if (!serviceAccount) {
  console.error(
    "[Firebase Admin] Missing service account. Server jobs cannot access Firestore with admin privileges."
  );
}

if (serviceAccount && serviceAccount.project_id !== firebaseConfig.projectId) {
  console.error("[Firebase Admin] PROJECT MISMATCH", {
    serviceAccountProjectId: serviceAccount.project_id,
    firebaseConfigProjectId: firebaseConfig.projectId
  });
  
  // No rigido, podemos ate travar aqui se for ambiente de job, mas vamos deixar a funcao assert lidar.
}

let app: admin.app.App;

try {
  if (!admin.apps.length) {
    const appConfig: admin.AppOptions = {
      projectId: firebaseConfig.projectId,
      storageBucket: firebaseConfig.storageBucket
    };

    if (serviceAccount) {
      console.log("[Firebase Admin] Using service account credentials from environment.");
      appConfig.credential = admin.credential.cert(serviceAccount as admin.ServiceAccount);
    } else {
      // Só permitir fallback fora dos jobs, mas deixando diagnóstico explícito.
      console.warn("[Firebase Admin] Running without service account. Admin jobs will be blocked.");
      appConfig.credential = admin.credential.applicationDefault();
    }

    app = admin.initializeApp(appConfig);
    
    console.log("[Firebase Admin] Initialized.", {
      projectId: firebaseConfig.projectId,
      hasServiceAccount
    });
  } else {
    app = admin.app();
  }
} catch (error) {
  console.error("[Firebase Admin] Initialization failed:", error);
  throw error;
}

export const adminApp = app;

// Usar database id do AI Studio/Firebase config.
// Se firestoreDatabaseId estiver vazio, cair para default.
export const adminDb = (firebaseConfig as any).firestoreDatabaseId
  ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId)
  : getFirestore(app);

export const adminAuth = app.auth();
export const adminFieldValue = admin.firestore.FieldValue;
export const adminTimestamp = admin.firestore.Timestamp;

export function assertAdminServiceAccountReady() {
  if (!hasServiceAccount) {
    throw new Error(
      "FIREBASE_ADMIN_SERVICE_ACCOUNT_MISSING: Configure FIREBASE_SERVICE_ACCOUNT ou FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY/FIREBASE_PROJECT_ID para executar jobs server-side."
    );
  }

  if (firebaseAdminProjectId !== firebaseClientProjectId) {
    throw new Error(
      `FIREBASE_ADMIN_PROJECT_MISMATCH: Service Account project_id (${firebaseAdminProjectId}) diferente do app projectId (${firebaseClientProjectId}). Use uma Service Account do projeto ${firebaseClientProjectId}.`
    );
  }
}

console.log("[Firebase Admin] Services ready.", {
  hasServiceAccount,
  firebaseAdminProjectId,
  firebaseClientProjectId,
  firebaseDatabaseId
});
