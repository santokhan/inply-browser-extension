import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";

import { tenantAuth } from "./config";

export async function signUpTenantWithEmail(email, password) {
  if (!email || !password) throw new Error("Email and password are required");

  const credential = await createUserWithEmailAndPassword(
    tenantAuth,
    email.trim(),
    password.trim()
  );

  return credential;
}

export async function signInTenantWithEmail(email, password) {
  if (!email || !password) throw new Error("Email and password are required");

  const credential = await signInWithEmailAndPassword(
    tenantAuth,
    email.trim(),
    password.trim()
  );

  return credential;
}

export async function sendTenantPasswordReset(email) {
  if (!email) throw new Error("Email is required");

  await sendPasswordResetEmail(tenantAuth, email.trim());

  return true;
}
