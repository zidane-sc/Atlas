import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";

const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied: "That GitHub account isn't the one this Atlas is bound to.",
  Configuration: "Auth isn't configured yet — missing GitHub OAuth env vars.",
  Default: "Sign-in failed. Try again.",
};

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? ERROR_MESSAGES.Default) : null;
  const isDev = process.env.NODE_ENV !== "production";

  return (
    <div
      className="flex h-screen flex-col items-center justify-center"
      style={{
        backgroundColor: "var(--color-bg-deep)",
        backgroundImage: "radial-gradient(ellipse at 50% 30%, color-mix(in srgb, var(--color-primary-gold) 8%, transparent) 0%, transparent 60%)",
      }}
    >
      <div
        className="w-full max-w-[420px] px-6 text-center"
        style={{ animation: "loginSlideUp 0.5s ease forwards" }}
      >
        {/* torches */}
        <div className="mb-8 flex items-center justify-center gap-6">
          <span className="text-3xl" style={{ animation: "torchFlicker 1.2s ease-in-out infinite" }}>
            🔥
          </span>
          <div>
            <div className="font-display" style={{ fontSize: "22px", color: "var(--color-primary-gold)", letterSpacing: "4px", textShadow: "0 0 30px color-mix(in srgb, var(--color-primary-gold) 60%, transparent)" }}>
              ATLAS
            </div>
            <div className="font-display mt-2" style={{ fontSize: "8px", color: "var(--color-text-muted)", letterSpacing: "2px" }}>
              YOUR SECOND BRAIN
            </div>
          </div>
          <span className="text-3xl" style={{ animation: "torchFlicker 1.2s ease-in-out infinite 0.4s" }}>
            🔥
          </span>
        </div>

        {/* hero pixel char */}
        <div className="mb-8 text-5xl" style={{ animation: "pixelPulse 3s ease-in-out infinite" }}>
          🧙
        </div>

        <p className="mb-10 text-base leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
          Track quests. Earn XP. Level up your life.
        </p>

        {errorMessage && (
          <div
            className="mb-4 border-2 px-4 py-3 text-sm"
            style={{ borderColor: "var(--color-status-blocked)", color: "var(--color-status-blocked)", backgroundColor: "var(--color-bg-panel)" }}
          >
            {errorMessage}
          </div>
        )}

        <form
          action={async () => {
            "use server";
            try {
              await signIn("github", { redirectTo: "/dashboard" });
            } catch (err) {
              if (err instanceof AuthError) {
                redirect(`/auth?error=${err.type}`);
              }
              throw err;
            }
          }}
        >
          <button
            type="submit"
            className="pixel-button flex w-full cursor-pointer items-center justify-center gap-3 border-2 px-6 py-3.5 transition-colors"
            style={{ backgroundColor: "#fff", borderColor: "var(--color-border)", color: "#1b1f24" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 0C5.37 0 0 5.5 0 12.3c0 5.44 3.44 10.05 8.21 11.68.6.12.82-.27.82-.6 0-.3-.01-1.08-.02-2.12-3.34.75-4.04-1.65-4.04-1.65-.55-1.42-1.34-1.8-1.34-1.8-1.09-.77.08-.75.08-.75 1.21.09 1.84 1.27 1.84 1.27 1.07 1.87 2.81 1.33 3.49 1.02.11-.79.42-1.33.76-1.64-2.67-.31-5.47-1.36-5.47-6.07 0-1.34.46-2.43 1.22-3.29-.12-.31-.53-1.55.12-3.23 0 0 1-.33 3.3 1.25a11.2 11.2 0 0 1 6 0c2.28-1.58 3.29-1.25 3.29-1.25.65 1.68.24 2.92.12 3.23.76.86 1.22 1.95 1.22 3.29 0 4.72-2.8 5.76-5.48 6.06.43.38.81 1.14.81 2.3 0 1.66-.02 3-.02 3.4 0 .33.22.72.83.6C20.57 22.34 24 17.74 24 12.3 24 5.5 18.63 0 12 0Z" />
            </svg>
            <span className="text-lg tracking-wide">Sign in with GitHub</span>
          </button>
        </form>

        {isDev && (
          <form
            className="mt-3"
            action={async () => {
              "use server";
              try {
                await signIn("dev", { redirectTo: "/dashboard" });
              } catch (err) {
                if (err instanceof AuthError) {
                  redirect(`/auth?error=${err.type}`);
                }
                throw err;
              }
            }}
          >
            <button
              type="submit"
              className="pixel-button flex w-full cursor-pointer items-center justify-center gap-2 border-2 px-6 py-2.5 transition-colors"
              style={{ backgroundColor: "transparent", borderColor: "var(--color-status-testing)", color: "var(--color-status-testing)" }}
            >
              <span className="text-base tracking-wide">◆ DEV LOGIN (LOCAL ONLY)</span>
            </button>
          </form>
        )}

        <p className="mt-7 text-sm" style={{ color: "var(--color-dim)" }}>
          Restricted to one account — no public sign-up.
        </p>
      </div>
    </div>
  );
}
