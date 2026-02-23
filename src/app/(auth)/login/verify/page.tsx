export default function VerifyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="w-full max-w-sm text-center">
        <div className="text-4xl mb-4">📬</div>
        <h1 className="text-xl font-semibold text-stone-900 mb-2">
          Check your email
        </h1>
        <p className="text-sm text-stone-500">
          We sent a sign-in link to your email address. Click the link to
          continue.
        </p>
        <p className="mt-4 text-xs text-stone-400">
          You can close this tab.
        </p>
      </div>
    </div>
  );
}
