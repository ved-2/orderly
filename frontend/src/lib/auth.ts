
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";

import { auth } from "@/lib/firebase";

const googleProvider = new GoogleAuthProvider();

export async function registerWithEmail(
  email: string,
  password: string,
) {
  const credential = await createUserWithEmailAndPassword(
    auth,
    email.trim().toLowerCase(),
    password,
  );

  await sendEmailVerification(credential.user);

  return credential.user;
}

export async function loginWithEmail(
  email: string,
  password: string,
) {
  const credential = await signInWithEmailAndPassword(
    auth,
    email.trim().toLowerCase(),
    password,
  );

  return credential.user;
}

export async function loginWithGoogle() {
  const credential = await signInWithPopup(
    auth,
    googleProvider,
  );

  return credential.user;
}

export async function resendVerificationEmail() {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Please sign in first.");
  }

  await sendEmailVerification(user);
}

export async function refreshEmailVerification() {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Please sign in first.");
  }

  await reload(user);

  if (!user.emailVerified) {
    throw new Error("Your email is not verified yet.");
  }

  await user.getIdToken(true);

  return user;
}

export async function logout() {
  await signOut(auth);
}
