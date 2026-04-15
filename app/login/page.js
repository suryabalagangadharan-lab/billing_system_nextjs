import LoginForm from "./login-form";

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const redirectTo =
    typeof params?.redirectTo === "string" && params.redirectTo.startsWith("/")
      ? params.redirectTo
      : "/dashboard";

  return (
    <section className="mx-auto flex min-h-screen max-w-md items-center px-6 py-16">
      <div className="w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">
          Phase 3 Authentication
        </p>
        <h1 className="mt-4 text-3xl font-semibold text-slate-950">Login</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Sign in with your username and password to receive a JWT-backed session.
        </p>
        <LoginForm redirectTo={redirectTo} />
      </div>
    </section>
  );
}
