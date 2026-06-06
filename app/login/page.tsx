"use client";

import { Suspense, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { login, type LoginState } from "./actions";

const initialState: LoginState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-4 w-full rounded-2xl bg-blue-300 px-4 py-4 text-base font-bold text-white transition hover:bg-blue-400 disabled:opacity-50"
    >
      {pending ? "처리 중…" : "로그인"}
    </button>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const [state, formAction] = useFormState(login, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="-mt-12 w-full max-w-sm">
        <a href="/" className="mb-5 inline-flex w-fit items-center">
          <Image
            src="/HRCoach_v2_transparent.png"
            alt="HRCoach"
            width={136}
            height={40}
            priority
            className="h-10 w-auto"
          />
        </a>

        <form action={formAction} className="space-y-3">
          <input type="hidden" name="next" value={next} />
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="이메일 또는 ID"
            className="w-full rounded-2xl bg-gray-50 px-5 py-4 text-sm text-gray-900 placeholder:text-gray-400 focus:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />

          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              placeholder="비밀번호"
              className="w-full rounded-2xl bg-gray-50 px-5 py-4 pr-12 text-sm text-gray-900 placeholder:text-gray-400 focus:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
            >
              {showPassword ? (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.584 10.587a2 2 0 002.828 2.83M9.363 5.365A9.466 9.466 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411M6.222 6.224A10.05 10.05 0 002.458 12C3.732 16.057 7.523 19 12 19c1.61 0 3.13-.38 4.477-1.057" />
                </svg>
              )}
            </button>
          </div>

          <label className="flex cursor-pointer items-center gap-2 pt-1 pl-1 text-xs text-gray-600">
            <input
              type="checkbox"
              name="remember"
              className="h-3.5 w-3.5 rounded-lg border-gray-300 text-blue-500 focus:ring-blue-200"
            />
            이메일 기억하기
          </label>

          {state.error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          )}

          <SubmitButton />
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          <a href="/signup" className="font-medium hover:text-gray-900">
            회원가입
          </a>
        </p>
      </div>
    </main>
  );
}
