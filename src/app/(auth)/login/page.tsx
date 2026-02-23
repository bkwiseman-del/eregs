import { signIn } from "@/lib/auth";
import { redirect } from "next/navigation";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="font-serif text-3xl font-semibold text-stone-900">
            e<span className="text-orange-600">R</span>egs
          </span>
          <p className="mt-2 text-sm text-stone-500">
            Sign in to your account
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
          <form
            action={async (formData: FormData) => {
              "use server";
              await signIn("resend", {
                email: formData.get("email") as string,
                redirectTo: "/dashboard",
              });
            }}
          >
            <div className="mb-4">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-stone-700 mb-1.5"
              >
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="you@company.com"
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Send sign-in link
            </button>
          </form>

          <p className="mt-4 text-xs text-center text-stone-400">
            We&apos;ll email you a magic link — no password needed.
          </p>
        </div>
      </div>
    </div>
  );
}
