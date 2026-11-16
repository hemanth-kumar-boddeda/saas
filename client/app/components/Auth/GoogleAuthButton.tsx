"use client";

import { useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { useSocialAuthMutation } from "@/redux/features/auth/authApi";

type Props = {
  /** Called after the server verified the Google ID token and set the session cookie. */
  onSuccess: () => void;
};

/**
 * SEC-01: Google Identity Services issues an ID token in the browser; the server
 * verifies it (signature/issuer/audience/expiry/subject) before any account is
 * resolved. No NEXT_PUBLIC_GOOGLE_CLIENT_ID -> no button (fail closed).
 */
const GoogleAuthButton = ({ onSuccess }: Props) => {
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const onSuccessRef = useRef(onSuccess);
  const [socialAuth, { isSuccess, error }] = useSocialAuthMutation();

  onSuccessRef.current = onSuccess;

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId || !googleBtnRef.current) return;

    const initialize = () => {
      const g = (window as Window).google;
      if (!g || !googleBtnRef.current) return;
      g.accounts.id.initialize({
        client_id: clientId,
        callback: (resp: { credential?: string }) => {
          if (resp.credential) socialAuth({ idToken: resp.credential });
        },
      });
      g.accounts.id.renderButton(googleBtnRef.current, {
        theme: "outline",
        size: "medium",
        width: 240,
      });
    };

    if (document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) {
      initialize();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = initialize;
    document.body.appendChild(script);
  }, [socialAuth]);

  useEffect(() => {
    if (isSuccess) {
      onSuccessRef.current();
    }
    if (error && "data" in error) {
      toast.error((error as any).data.message);
    }
  }, [isSuccess, error]);

  if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) return null;

  return <div ref={googleBtnRef} />;
};

export default GoogleAuthButton;
