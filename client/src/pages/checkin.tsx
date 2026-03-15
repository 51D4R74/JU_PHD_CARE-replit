import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * /checkin route — redirects to dashboard where the inline check-in lives.
 * Kept as a named route to preserve deep-links and nav references.
 */
export default function CheckInPage() {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate("/dashboard", { replace: true });
  }, [navigate]);
  return (<></>);
}
