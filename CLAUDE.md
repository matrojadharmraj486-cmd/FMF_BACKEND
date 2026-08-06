# FMF_BACKEND — Family Medicine Flashback API

Express 5 + Mongoose 9 REST API (ESM, `"type": "module"`). Serves a mobile app (students
revising past exam papers) and a React admin panel. Node entry: `src/index.js` → `src/app.js`.

```
npm start                      # node src/index.js  (no dev/watch script, no tests)
npm run migrate:deleted-users  # anonymize soft-deleted users
npm run migrate:banners        # normalize legacy bannerType values
npm run cloudinary:audit       # report Cloudinary assets referenced in DB
npm run cloudinary:migrate[:apply]     # copy assets between Cloudinary accounts
npm run cloudinary:rewrite-db[:apply]  # repoint DB URLs at the new account
```

`npm run migrate:cluster` is declared in package.json but `scripts/migrate-cluster.js` does not exist.

Deploy: push to `main` → GitHub Action SSHes to a DigitalOcean droplet, `git pull`,
`npm install --omit=dev`, `pm2 restart fmf-backend` (`.github/workflows/deploy.yml`).

## Layout

```
src/
  app.js            express wiring, CORS allowlist, route mounts, error handlers
  index.js          dotenv → connectDB() → listen
  config/database.js
  controller/       auth, bookmark, otp, profile, state  (SINGULAR — older code)
  controllers/      everything else                      (PLURAL — newer code)
  middleware/       auth.js, adminAuth.js, upload.js, apiErrorLogger.js
  middlewares/      adminAuth.js  — DUPLICATE, nothing imports it
  models/           18 mongoose models
  routes/           35 routers
  utils/            jwt, otp, email, bulk9 (SMS), cloudinary, firebase, razorpay, logger, response
  data/             state-districts.json, questions.json
```

Two parallel controller directories (`controller/` vs `controllers/`) and two
`adminAuth` copies are a historical split, not a design. New code goes in `controllers/`
and imports `middleware/adminAuth.js`.

### Conventions

- Responses go through `utils/response.js`: `{ status, message, data }` /
  `{ status, message }`. Several newer controllers bypass it and emit
  `{ success, data }` or bare objects instead — see "Response shape drift" below.
- Errors: `try/catch` → `errorResponse(res, 500, e.message)`. Express 5 auto-forwards
  rejected async handlers, so the handful of controllers without try/catch
  (all of `controller/bookmark.controller.js`, `opinion` create/list,
  `admin.stats`) still land in `globalErrorHandler`.
- Image URLs are stored relative (`/uploads/x.png`) or absolute (Cloudinary). Every
  read path runs a local `toAbsolute(url, req)` helper — it is copy-pasted into
  ~7 controllers, some honouring `x-forwarded-proto` and some not.

## Request pipeline (`src/app.js`)

1. `express.json({ limit: JSON_BODY_LIMIT ?? "10mb", verify })` — `verify` stashes
   `req.rawBody`, required by the Razorpay webhook HMAC.
2. `express.urlencoded`
3. `helmet({ crossOriginResourcePolicy: "cross-origin" })`
4. `cors` — hardcoded `allowedOrigins` array (trailing slash stripped);
   requests with **no** Origin header are always allowed.
5. `apiFailureLogger` — wraps `res.json`, logs any `/api/*` response ≥ 400 to
   `logs/api.log` + `logs/api-errors.log`.
6. route mounts
7. `/uploads` static
8. `notFoundHandler` → 404 for `/api/*`
9. `globalErrorHandler` → 500s are masked as "Internal server error"

`adminStatsRoutes` is mounted **twice**: `/api/admin` and `/admin`. The `/admin` copy
sits outside the `/api` prefix, so the failure logger, the 404 handler and the global
error handler all skip it.

## Auth

Three schemes, all JWT `{ userId }` signed with `JWT_SECRET`, 7-day expiry (`utils/jwt.js`):

| middleware | source | rejects |
|---|---|---|
| `authenticate` | `Authorization: Bearer` | missing/invalid token, `isDeleted`, `isActive === false` |
| `optionalAuthenticate` | same | never — attaches `req.user` when valid, else continues |
| `adminAuthenticate` | Bearer **or `?token=`** | non-`admin` role → 403 |

Admin login (`POST /api/admin/auth/login`) does **not** check a password hash: it
string-compares `req.body` against `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars
(defaults `admin@fmf.local` / `Admin@123`), then lazily creates or promotes that
User row to `role: "Admin"`.

App-user auth flows:
- **OTP** — `send-otp` (email via SMTP, or SMS via Bulk9) → `verify-otp` → `register` or `login`.
  OTPs are stored SHA-256-hashed (`hashOtp(otp, identifier, OTP_HASH_SECRET)`) in
  `Otp`, TTL-indexed on `expiresAt`.
- **Password** — email + password, bcrypt via `User.comparePassword`.
- **Social** — `POST /api/auth/social-login` with a Firebase `idToken`; only
  `google.com` and `apple.com` providers accepted. Links to an existing account by
  verified email, otherwise creates one with `firebaseUid` set. Response carries
  `isProfileComplete` / `missingFields` (from `PROFILE_REQUIRED_FIELDS = ["fullName","mobileNumber"]`)
  so the client can route to the profile-completion screen.

`String(otp) === "123456"` is accepted as a master OTP in both `verifyOtp` and
`resetPassword`, bypassing the stored hash and expiry.

### Single-device sessions

App accounts may be signed in on **one device at a time**. `utils/session.js` owns this:

- Every app login calls `startSession(user, req.body)`, which writes a fresh
  `crypto.randomUUID()` to `User.activeSessionId` and returns it. `generateToken`
  embeds it in the JWT as `sid`.
- `authenticate` runs `isSessionValid(user, decoded)`; a token whose `sid` is not the
  account's current one gets **401** with `data.code === "SESSION_REVOKED"`, which the
  app uses to distinguish "signed in elsewhere" from an ordinary expired token.
  `optionalAuthenticate` degrades to anonymous instead of erroring.
- **Admin accounts are exempt** — `startSession` returns `null` for `role: "Admin"`,
  admin tokens carry no `sid`, and `isSessionValid` short-circuits true. The admin
  panel stays multi-browser, and `adminAuthenticate` is not involved at all.
- If the client sends `deviceId` at login, a device that already owns the session keeps
  it instead of rotating — this stops an app retrying a timed-out login from
  invalidating the token its own first attempt just received. Optional; login works
  without it.
- `POST /api/auth/logout` (`authenticate`) calls `endSession`, nulling the field so the
  token is dead server-side rather than only dropped by the client.
- Tokens minted before this feature have no `sid` and are rejected, so the rollout logs
  every existing user out exactly once. Push tokens are deliberately left alone.

## Data model

- **User** — contact, `role` (`"App"` / `"Admin"`), embedded `subscription`
  (`plan` ref, `status`, `startDate`, `endDate`, `lastPaymentId`), `isVerified`,
  `isActive`, `isDeleted`, `firebaseUid` (sparse-unique), `authProvider`.
  `password` is `select: false`; bcrypt-hashed in a `pre("save")` hook.
  Soft delete prefixes email/mobile with `deleted_<ts>_` to free the unique index.
- **StructuredQuestion** — the live question model. `year`, `part` (`"Part 1"|"Part 2"`),
  `paper`, `question_text`, `isDirect`, `main_question_answer[]`, `main_answer_blocks[]`,
  and `sub_questions[]` each with `answerType` `text` | `image` | `rich`
  (`rich` → `answerBlocks[]` of `{type:"text"|"image", text|url, alt}`).
  A single doc carries `QOTD: true` to mark question-of-the-day.
- **Question** — legacy flat model. Still written by `/api/admin/questions*` and
  counted in admin stats, but no read endpoint is routed (`getQuestions` is exported and unused).
- **Qotd** — legacy QOTD collection. See "QOTD split" below.
- **Bookmark** — `{ user, name, questions: [{id, question_text, sub_questions}] }`.
  Questions are **denormalized copies**, so edits to the source question never
  reach existing bookmarks (the read path re-fetches by id to compensate).
- **Payment** — amount in **paise**, `orderNumber` from an atomic `Counter`
  (`paymentOrderNumber`, seeded at 1001), full coupon/discount snapshot,
  `status: created|paid|failed|refunded`.
- **Subscription** — `price` (INR), `gstPercent` ∈ {0,5,18}, `durationDays`,
  `isActive`, `isDeleted`. Delete is soft when any User or Payment references it.
- **Coupon** — `code` (upper, unique), `discountType` `percentage|fixed`, `discountValue`.
  No expiry, no usage cap, no per-user limit.
- Also: Banner (5 positions, ≤5 active), Testimonial, Faq, Opinion, SupportTicket
  (`TKT-<ts>-<rand>`, status machine + history), Notification, FcmToken,
  PaymentGatewayConfig, Otp, Counter.

## API surface

### Public — no token
```
POST   /api/auth/send-otp | verify-otp | login | social-login | register
       | forgot-password | reset-password
GET    /api/v1/states                    GET /api/v1/districts/:state
GET    /api/questions                    ?year&part&paper&format=plain
GET    /api/question-of-the-day          reads StructuredQuestion{QOTD:true}
GET    /api/banners  /api/testimonials  /api/faqs  /api/subscriptions
GET    /api/opinions                     POST /api/opinions
GET    /api/home                         optionalAuthenticate → adds `subscription`
GET    /api/questions/years | parts | papers   optionalAuthenticate
POST   /api/payments/webhook             HMAC-verified, not token-auth
GET    /uploads/*                        static
```

### App user — `authenticate`
```
GET|PUT|DELETE /api/user/profile
/api/bookmark            POST / · GET / · GET /:id · POST /add · POST /:collectionId/add
                         GET /collection/:collectionId/questions · GET /check/:questionId
                         PUT|PATCH /:collectionId · DELETE /:collectionId
                         PATCH /:collectionId/questions/:questionId
                         DELETE /:collectionId/remove/:questionId
GET    /api/questions/search             ?year&search (year + search required)
POST   /api/payments/orders              GET /api/payments/history
POST   /api/payments/verify | /fail
GET|POST /api/support-tickets            GET /api/support-tickets/:id
GET|POST /api/notifications              register · unregister · :id/read · read-all
GET    /api/coupons                      POST /api/coupons/validate
GET    /api/admin/app-testimonials       (app-facing despite the /admin prefix)
```

### Admin — `adminAuthenticate`, all under `/api/admin`
```
auth/login (public)   stats · stats/timeseries (also at /admin/stats)
users · users/:id · users/:id/subscription · users/bulk-delete
questions · questions/:id · questions/upload          (legacy Question model)
questions-structured · /:id · /:id/sub/:subId · /:id/sub/:subId/image
   /upload · /years · /parts · /papers · /qotd/clear · /qotd/active/:id
   /bulk-delete · DELETE ?year&part&paper
banners · banner · testimonials · faqs · opinions · opinions/bulk-delete
subscriptions · /:id · /:id/status        coupons · coupons/:id
orders · orders/:id · orders/:id/invoice · orders/bulk-delete
payments · payment-gateway · support-tickets · notifications/send[-bulk]
editor-image
```

`GET /api/admin/questions-structured` is registered **without** `adminAuthenticate`.

## Subsystems

**Payments (Razorpay).** `getRazorpayClient()` prefers the DB `PaymentGatewayConfig`
row (`keyId` / `saltId`), falling back to `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`.
`createOrder` recomputes price server-side — plan price + GST, then coupon discount —
so a tampered client amount cannot stick. `verifyPayment` checks
`HMAC-SHA256(order_id|payment_id, keySecret)`; the webhook checks
`HMAC-SHA256(rawBody, RAZORPAY_WEBHOOK_SECRET)`. Both paths converge on
`activateSubscriptionForUser`, which is idempotent via `if (payment.status !== "paid")`.
Activation emails are best-effort.

**Question ingestion.** `POST /api/admin/questions-structured/upload` takes .xlsx/.csv
and runs two parsers: a header-driven one (wide alias table — `question_text`,
`sub_part`, `answer_text`, … normalized by stripping non-alphanumerics) and a
positional fallback that walks raw cells looking for `answer` / `image` / numeric
tokens. **When both `year` and `part` form fields are sent, matching questions are
`deleteMany`'d before insert** — the upload is a replace, not an append.

**Notifications.** FCM via `firebase-admin`, credentials from
`FIREBASE_SERVICE_ACCOUNT_JSON`. Tokens live in `FcmToken`; sends chunk at 500,
and tokens rejected as unregistered/invalid are flipped to `isActive: false`.
Bulk send returns a per-user `failedDetails` breakdown and always HTTP 200.

**Email.** `utils/email.js` → nodemailer SMTP (`SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/
`SMTP_PASS`, IPv4-forced lookup via `SMTP_FAMILY`), or `service: gmail` when no host.
Templates in `utils/emailTemplates.js` (OTP, welcome, subscription activated/expiring/
expired, password reset, support ticket created/updated) — each returns `{subject, text, html}`.
`sendBrevoEmail` is a legacy alias for `sendEmail`. `BULK9_EMAIL_URL`, when set, diverts
OTP mail to Bulk9 instead of SMTP. Bulk9 also carries all OTP **SMS** (DLT route).

**Images.** Uploaded to disk by multer, then pushed to Cloudinary
(`fmf/profiles`, `fmf/banners`, `fmf/testimonials`, `fmf/editor`, `fmf/structured-answers`)
and the local temp file is unlinked. Support-ticket attachments and legacy
question images are the exception — they stay on local disk under `/uploads`.

## Known issues

Ranked, found by full read of every file. Nothing here has been changed.

### Authentication bypasses

1. **Mobile login trusts a client-supplied flag.** `controller/authController.js`
   `login()` branches on `req.body.isVerified` — posting
   `{ identifier: "<any 10-digit mobile>", isVerified: true }` returns a valid JWT
   for that account with no OTP and no password.
2. **Registration mass-assignment.** `register()` does `User.create({ ...req.body, … })`
   and the reclaim branch does `existingUser.set({ ...req.body, … })`. `role`,
   `isSubscribed` and the whole `subscription` sub-document are settable by the
   caller, so a registration can mint an `Admin` or a paid account. `register` also
   never confirms an OTP was verified for the identifier — it just sets `isVerified: true`.
3. **Master OTP `123456`** in `otp.controller.js` (`verifyOtp`) and `resetPassword.js`
   — accepted for any identifier, so any account's password can be reset.
4. **Default admin credentials.** `admin@fmf.local` / `Admin@123` are live whenever
   `ADMIN_EMAIL` / `ADMIN_PASSWORD` are unset, and the password is compared in plaintext.

### Authorization / exposure

5. **`GET /api/admin/questions-structured` is unauthenticated** — full question bank
   with answers, ignoring the admin guard on every sibling route.
6. **No paywall.** Nothing in the codebase gates content on `isSubscribed` or
   `subscription.status` — `GET /api/questions` returns every question and answer to
   anonymous callers. Subscriptions are sold and tracked but never enforced.
7. **Anonymous is treated as admin** in `listStructuredYears` / `listStructuredParts` /
   `listStructuredPapers`: `const isAdmin = !req.user || role === "admin" || …`.
   Under `optionalAuthenticate` a no-token request takes the admin branch and gets the
   hardcoded fallback lists; a logged-in app user gets the real `distinct()` values.
8. **Admin JWT in query strings.** `adminAuthenticate` accepts `?token=`, and
   `admin.order.controller.formatOrder` *builds* `invoiceUrl` with the caller's token
   embedded and returns it in JSON — the token then lands in proxy logs, browser
   history and `Referer` headers.
9. **Uploads are unauthenticated and unfiltered.** Multer has no `fileFilter` and no
   `limits`; anything goes to disk and is served from `/uploads`. Any logged-in user
   can attach an `.html` or `.svg` to a support ticket and get it served same-origin
   (stored XSS), and every attachment is readable by anyone who has the URL.

### Correctness

10. **QOTD split.** `POST|PUT /api/question-of-the-day` write the **`Qotd`** collection;
    `GET /api/question-of-the-day` reads **`StructuredQuestion{QOTD:true}`**. The admin
    write endpoints therefore have no effect on what the app displays. The only working
    path is `POST /api/admin/questions-structured/qotd/active/:id`. `getActiveQotd`,
    which would read `Qotd`, is exported but never routed.
11. **`updateProfile` silently drops `city`.** It assigns `user.city`, which is not in
    the User schema (the schema has `cityId` and `address.city`), so strict mode discards it.
12. **Unvalidated ObjectIds → 500 instead of 400/404.** `bookmark.addQuestion` and
    `checkStatus` (`{_id: questionId}`), `admin.user.updateSubscription`,
    `bulkDeleteOpinions`, `bulkDeleteSupportTicketsAdmin`, `deleteOpinion`,
    the FAQ/testimonial/banner `:id` routes.
13. **`markPaymentFailed` accepts any status transition** — a user can POST
    `/api/payments/fail` for an already-`paid` order and flip it to `failed`
    (the subscription stays active, so orders and access disagree).
14. **Password logged in plaintext on failure.** `apiErrorLogger`'s `SENSITIVE_KEYS`
    covers `password` but not `newPassword`, so a failing `POST /api/auth/reset-password`
    writes the new password to `logs/api-errors.log`. `photoBase64` is unredacted too
    and will bloat the log.
15. **Rejected CORS origins get 500.** The `Error("Not allowed by CORS")` reaches
    `globalErrorHandler` with no `statusCode`, so it is reported as an internal error.

### Operational

16. **No rate limiting anywhere** — `send-otp` and `forgot-password` bill real SMS and
    email per request; `POST /api/opinions` is public and unauthenticated.
17. **Logs never rotate.** `utils/logger.js` appends to `logs/api.log` and
    `logs/api-errors.log` forever.
18. **In-process stats cache.** `admin.stats.controller` caches in a module-level `Map`,
    which is per-process — it will diverge under pm2 cluster mode.
19. **Response shape drift.** Three shapes coexist: `{status, message, data}`
    (`utils/response.js`), `{success, data}` (`admin.coupon`, `createStructuredQuestion`,
    bulk deletes), and bare objects (`admin.stats`, `qotd`, `uploadEditorImage`).
    Clients must special-case per endpoint.
20. **Dead code**: `src/middlewares/adminAuth.js`, `admin.question.controller.getQuestions`,
    `qotd.controller.getActiveQotd`, `email.sendBrevoEmail`, the entire legacy `Question`
    model read path, `test-email.js` at the repo root, and the `migrate:cluster` script.
21. `.gitignore` lists itself, and `.env` is committed to the working tree with live
    Razorpay, Cloudinary, SMTP, Firebase and Mongo credentials (it *is* gitignored).

## Environment

`MONGODB_URI` `JWT_SECRET` `PORT` `NODE_ENV`
`ADMIN_EMAIL` `ADMIN_PASSWORD` `ADMIN_NAME` `ADMIN_USER_ID`
`OTP_TTL_MINUTES` `OTP_HASH_SECRET` `OTP_EMAIL_SUBJECT` `DEFAULT_OTP`
`SMTP_HOST` `SMTP_PORT` `SMTP_SECURE` `SMTP_FAMILY` `SMTP_USER` `SMTP_PASS`
`EMAIL_USER` `EMAIL_PASS` `EMAIL_FROM` `EMAIL_FROM_NAME` `EMAIL_SERVICE`
`SMTP_CONNECTION_TIMEOUT_MS` `SMTP_GREETING_TIMEOUT_MS` `SMTP_SOCKET_TIMEOUT_MS`
`BULK9_SMS_URL` `BULK9_EMAIL_URL` `BULK9_API_KEY` `BULK9_AUTH_HEADER` `BULK9_AUTH_VALUE`
`BULK9_ROUTE` `BULK9_SENDER_ID` `BULK9_TEMPLATE_ID` `BULK9_ENTITY_ID` `BULK9_MESSAGE_ID`
`BULK9_FLASH` `BULK9_FROM_EMAIL` `HTTP_CLIENT_TIMEOUT`
`RAZORPAY_KEY_ID` `RAZORPAY_KEY_SECRET` `RAZORPAY_WEBHOOK_SECRET`
`CLOUDINARY_CLOUD_NAME` `CLOUDINARY_API_KEY` `CLOUDINARY_API_SECRET`
`CLOUDINARY_DEST_*` (migration scripts only)
`FIREBASE_SERVICE_ACCOUNT_JSON`
`UPLOAD_DIR` `LOG_DIR` `API_LOG_FILE` `API_ERROR_LOG_FILE`
`JSON_BODY_LIMIT` `ADMIN_STATS_CACHE_TTL_MS`

## Postman

`postman/` holds 10 collections; `fmf-backend-complete.postman_collection.json` is the
broadest. `samples/` has example question upload files (.xlsx/.csv/.json) covering the
structured, hybrid, minimal and medical-reference header layouts.
