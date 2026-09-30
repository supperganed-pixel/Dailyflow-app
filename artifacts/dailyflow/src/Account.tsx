import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { credentialsSchema } from "@workspace/flow-core";
import { authClient, firebaseConfigured } from "./services/firebase";
import { useAuth } from "./auth/AuthProvider";
import { Button, Choice, Label } from "./ui";

import { AuthScene, AuthField as Field, authColors } from "./auth/AuthScene";

function messageFor(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (
    [
      "auth/invalid-credential",
      "auth/wrong-password",
      "auth/user-not-found",
    ].includes(code ?? "")
  )
    return "Email or password is incorrect.";
  if (code === "auth/email-already-in-use")
    return "Unable to create this account. Try signing in or resetting your password.";
  if (code === "auth/too-many-requests")
    return "Too many attempts. Please wait a few minutes and try again.";
  if (code === "auth/network-request-failed")
    return "Could not connect. Check your internet connection and try again.";
  if (code === "auth/operation-not-allowed")
    return "Email sign-in is not enabled yet. Please contact the app owner.";
  return error instanceof Error
    ? error.message
    : "Could not complete the request. Please try again.";
}
export default function Account({ onConnect }: { onConnect?: () => void }) {
  const c = authColors,
    auth = useAuth();
  const [mode, setMode] = useState("sign in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [resendAfter, setResendAfter] = useState(0);
  const signup = mode === "sign up",
    forgot = mode === "forgot password";
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  }
  async function verifyEmail() {
    const user = authClient().currentUser;
    if (!user) throw new Error("Please sign in again.");
    if (Date.now() < resendAfter)
      throw new Error("Wait a minute before requesting another email.");
    await sendEmailVerification(user);
    setResendAfter(Date.now() + 60000);
    setMessage(
      "Verification email requested. Check your inbox and spam folder, follow the link, then return here and choose 'I verified my email'.",
    );
  }
  async function submit() {
    if (forgot) {
      const parsed = credentialsSchema.shape.email.safeParse(email);
      if (!parsed.success) throw new Error("Enter a valid email address.");
      try {
        await sendPasswordResetEmail(authClient(), parsed.data);
      } catch (e) {
        if ((e as { code?: string }).code !== "auth/user-not-found") throw e;
      }
      setMessage(
        "If an account exists, check your inbox and spam folder for a reset link. Set your password on the secure Firebase page, then return here to sign in.",
      );
      return;
    }
    const parsedEmail = credentialsSchema.shape.email.safeParse(email);
    if (!parsedEmail.success || !password || password.length > 128)
      throw new Error("Enter a valid email and password.");
    const parsed = signup
      ? credentialsSchema.safeParse({ email, password })
      : { success: true as const, data: { email: parsedEmail.data, password } };
    if (!parsed.success)
      throw new Error(
        "Enter a valid email and a password of 12–128 characters.",
      );
    if (signup) {
      if (password !== confirm) throw new Error("The passwords do not match.");
      const { user } = await createUserWithEmailAndPassword(
        authClient(),
        parsed.data.email,
        parsed.data.password,
      );
      setPassword("");
      setConfirm("");
      await updateProfile(user, { displayName: name.trim().slice(0, 80) });
      await verifyEmail();
    } else {
      await signInWithEmailAndPassword(
        authClient(),
        parsed.data.email,
        parsed.data.password,
      );
      setPassword("");
      await auth.refresh();
      onConnect?.();
    }
  }
  return (
    <AuthScene transitionKey={auth.user ? "verification" : mode}>
      <Text
        accessibilityRole="header"
        style={{
          fontSize: 30,
          fontWeight: "700",
          color: c.ink,
          letterSpacing: -0.8,
        }}
      >
        {auth.user
          ? auth.user.emailVerified
            ? "Connect your workspace"
            : "Verify your email"
          : forgot
            ? "Forgot your password?"
            : signup
              ? "Create your account"
              : "Welcome back"}
      </Text>
      <Label muted>
        {signup
          ? "A fresh start for your ideas and everyday plans."
          : forgot
            ? "We’ll send a link to help you get back to your day."
            : "A little focus starts here. Make yourself at home."}
      </Label>
      {!firebaseConfigured && (
        <Text accessibilityRole="alert" style={{ color: c.danger }}>
          Firebase Authentication isn't connected yet. The app owner must finish
          setup before sign-in is available.
        </Text>
      )}
      {auth.user ? (
        <>
          <Label>{auth.user.email}</Label>
          <Label muted>
            {auth.user.emailVerified
              ? "Your email is verified. Retry connecting to your private workspace."
              : "Open the verification email, follow its link, then return to DailyFlow."}
          </Label>
          <Button
            title={
              auth.user.emailVerified
                ? "Retry connection"
                : "I verified my email"
            }
            primary
            disabled={busy}
            onPress={() => void run(auth.refresh)}
          />
          {!auth.user.emailVerified && (
            <Button
              title="Resend verification email"
              disabled={busy}
              onPress={() => void run(verifyEmail)}
            />
          )}
          <Button
            title="Sign out"
            disabled={busy}
            onPress={() => void run(() => signOut(authClient()))}
          />
        </>
      ) : (
        <>
          <Choice
            options={["sign in", "sign up"]}
            value={mode}
            onChange={(value) => {
              if (!busy) {
                setMode(value);
                setError("");
                setMessage("");
                setPassword("");
                setConfirm("");
              }
            }}
          />
          {signup && (
            <Field
              label="Display name"
              value={name}
              onChangeText={setName}
              maxLength={80}
              autoComplete="name"
            />
          )}
          <Field
            label="Email address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            maxLength={254}
          />
          {!forgot && (
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={signup ? "new-password" : "current-password"}
              maxLength={128}
              onSubmitEditing={() => void run(submit)}
            />
          )}
          {signup && (
            <>
              <Label small muted>
                Use at least 12 characters. A memorable passphrase works well.
              </Label>
              <Field
                label="Confirm password"
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry
                autoComplete="new-password"
                maxLength={128}
              />
            </>
          )}
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => {
              setMode(forgot ? "sign in" : "forgot password");
              setError("");
              setMessage("");
              setPassword("");
              setConfirm("");
            }}
            style={{
              minHeight: 44,
              justifyContent: "center",
              alignSelf: "flex-end",
            }}
          >
            <Text style={{ color: c.brand, fontSize: 13 }}>
              {forgot ? "Back to sign in" : "Forgot password?"}
            </Text>
          </Pressable>
          <Button
            title={
              busy
                ? "Please wait…"
                : forgot
                  ? "Send reset link"
                  : signup
                    ? "Create account"
                    : "Sign in"
            }
            primary
            disabled={busy || !firebaseConfigured}
            onPress={() => void run(submit)}
          />
        </>
      )}
      {!!message && (
        <View
          accessibilityLiveRegion="polite"
          style={{ padding: 14, backgroundColor: c.soft, borderRadius: 12 }}
        >
          <Label>{message}</Label>
        </View>
      )}
      {!!(error || auth.error) && (
        <Text accessibilityRole="alert" style={{ color: c.danger }}>
          {error || auth.error}
        </Text>
      )}
      <Label small muted>
        Your tasks and files stay private. A little less noise, a little more
        focus.
      </Label>
    </AuthScene>
  );
}
