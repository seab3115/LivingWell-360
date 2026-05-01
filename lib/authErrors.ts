interface FirebaseLikeError {
  code?: string;
  message?: string;
}

function isFirebaseError(e: unknown): e is FirebaseLikeError {
  return typeof e === "object" && e !== null && "code" in e;
}

export function mapAuthError(e: unknown): string {
  if (isFirebaseError(e)) {
    switch (e.code) {
      case "auth/invalid-email":
        return "That email address looks invalid. Please check and try again.";
      case "auth/email-already-in-use":
        return "An account with this email already exists. Try signing in instead.";
      case "auth/weak-password":
        return "Your password is too weak. Use at least 6 characters.";
      case "auth/missing-password":
        return "Please enter a password.";
      case "auth/user-not-found":
      case "auth/invalid-credential":
      case "auth/wrong-password":
        return "Email or password is incorrect.";
      case "auth/user-disabled":
        return "This account has been disabled.";
      case "auth/too-many-requests":
        return "Too many attempts. Please wait a moment and try again.";
      case "auth/network-request-failed":
        return "Network error. Check your internet connection and try again.";
      case "auth/operation-not-allowed":
        return "Email/password sign-in isn't enabled in your Firebase project. Enable it in Firebase Console → Authentication → Sign-in method.";
      case "permission-denied":
        return "Database permission denied. In your Firebase Console → Firestore Database → Rules, allow authenticated reads & writes.";
      case "unavailable":
        return "Database is unavailable. Make sure Firestore Database is created in your Firebase Console.";
      case "failed-precondition":
        return "Database isn't ready. Make sure Firestore Database is created in your Firebase Console.";
      default:
        return e.message ?? "Something went wrong. Please try again.";
    }
  }
  if (e instanceof Error) return e.message;
  return "Something went wrong. Please try again.";
}
