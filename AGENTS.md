<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Expense Tracker Developer & Agent Guidelines

## 1. Build & Verification Commands
- **Typecheck**: `npx tsc --noEmit` (Must always pass with 0 errors).
- **Lint**: `npm run lint` (ESLint 9 flat config; 0 errors / 0 warnings).
- **Next.js Static Build**: `npm run build` (Outputs static export to `out/`). Note: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` must be set in `.env.local` (or provided as dummy HTTPS URL / key) for prerendering to succeed.
- **Android Web Sync**: `npx cap sync android` or `npx cap copy android`.
- **Android Debug APK**: `cd android && ./gradlew assembleDebug` (Windows: `.\gradlew.bat assembleDebug`). Output: `android/app/build/outputs/apk/debug/app-debug.apk`.

## 2. Read-Only-First Database Safety & Migration Rules
- **No Automatic DB Mutations**: Never execute production database DDL or DML without explicit user approval.
- **Manual Dashboard Execution**: Supabase production migrations are executed manually by the user via Supabase Dashboard SQL Editor, not via Supabase CLI. Do not run destructive CLI migration resets.
- **Security Definer Functions**: Always revoke `PUBLIC` and `anon` execute privileges on sensitive RPCs (`REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon;`) and grant only to `authenticated, service_role`. Always specify `SET search_path = public, auth`.
- **Reversibility**: Every migration must be accompanied by a safe rollback script and pre-flight dependency check.

## 3. Financial Data Integrity
- **Integer Cents**: All monetary values in storage and state must use integer cents (`Math.round(amount * 100)`) to eliminate floating-point drift.
- **Idempotency**: All payment and cashback submissions must reuse durable `operationId` UUIDs on retry to prevent double-deduction or duplicate reward posting.
- **Concurrency Locking**: Multi-account transfers and statement allocations must acquire row-level locks (`FOR UPDATE`) on account and statement rows inside RPCs.
- **Multi-Currency Safety**: Never mix raw foreign currency nominal values into base currency totals without a verified exchange rate (`isKnown = true`).

## 4. Android Build Precautions
- **Static Export**: The application compiles to static HTML/JS/CSS (`output: "export"` in `next.config.ts`). Never introduce server-only components or Node runtime dependencies in client pages.
- **Android Origin & Insets**: WebView uses secure `androidScheme: 'https'`. System bars use CSS insets (`env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`). Do not hardcode device status bar heights.
- **Release Inspection**: `webContentsDebuggingEnabled` is disabled for release builds in `capacitor.config.ts`.

## 5. Secret & Credential Handling
- Never commit `.env.local`, Supabase service role keys, user passwords, or keystore files.
- The Google Gemini API key is configured by the user at runtime in **Profile → AI Assistant** and stored locally, not in environment variables.

