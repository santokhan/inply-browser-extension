import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  confirmPasswordReset,
  signOut,
  getAuth,
} from "firebase/auth";

import { app } from "./config";

const auth = getAuth(app);

export async function sign_up_with_email(email, password) {
  if (!email || !password) throw new Error("Email and password are required");

  const credential = await createUserWithEmailAndPassword(
    auth,
    email.trim(),
    password.trim()
  );

  return credential;
}

export async function sign_in_with_email(email, password) {
  if (!email || !password) throw new Error("Email and password are required");

  const credential = await signInWithEmailAndPassword(
    auth,
    email.trim(),
    password.trim()
  );

  return credential;
}

export async function forgot_password(email) {
  if (!email) throw new Error("Email is required");

  await sendPasswordResetEmail(auth, email.trim());

  return true;
}

export async function reset_password(oobCode, newPassword) {
  if (!oobCode || !newPassword) throw new Error("Reset code and new password are required");

  await confirmPasswordReset(
    auth,
    oobCode,
    newPassword.trim()
  );

  return true;
}

export async function get_token(forceRefresh = false) {
  const user = auth.currentUser;

  if (!user) throw new Error("User is not authenticated");

  return await user.getIdToken(forceRefresh);
}

export function get_current_user() {
  return auth.currentUser;
}

export async function sign_out() {
  await signOut(auth);
}