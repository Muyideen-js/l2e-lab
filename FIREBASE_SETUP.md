# Firebase setup for L2E LAB

L2E LAB learners sign up and sign in with a username and password. The browser converts the normalized username to a deterministic internal Firebase email; learners never see or use that internal address.

The admin code remains dormant. There is no active admin route or Firestore admin permission in this phase.

## 1. Configure the Firebase web client

Copy `.env.example` to an untracked `.env.local` file and copy the web configuration from **Firebase Console > Project settings > General > Your apps > SDK setup and configuration**:

```dotenv
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

`API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID`, and `APP_ID` are required by this app. Copy the other values when Firebase supplies them; `MEASUREMENT_ID` is optional because Analytics is not initialized. Do not commit `.env.local`. In Vercel, add the same configured variables under **Project > Settings > Environment Variables** and select **Production**, **Preview**, and **Development** for each value. Vite injects them at build time, so redeploy after adding or changing them.

Firebase web configuration is public client metadata and remains visible in built browser JavaScript. Never put a service-account credential, private key, user password, or refresh token in a `VITE_` variable.

### Restrict the browser API key

In **Google Cloud Console > APIs & Services > Credentials**, open the Firebase browser key:

- Restrict HTTP referrers to the real L2E LAB origins, including `https://l2e-lab.vercel.app/*`, approved preview domains, custom production domains, and local origins only when required.
- Keep the key restricted to Firebase-related APIs required by Authentication and Firestore. Do not add unrelated APIs such as the Generative Language API.
- Test account creation, sign-in, and Firestore sync before disabling an older key.

Because a Firebase browser key was previously committed, restrict or rotate it, update `.env.local` and every Vercel environment, redeploy, verify the replacement, and only then disable the old key. Resolve the GitHub secret-scanning alert after that remediation; removing the value from the latest source file does not make a usable key in Git history safe.

## 2. Enable learner authentication

In **Firebase Console > Authentication > Sign-in method**:

1. Enable **Email/Password**.
2. Do not add a public email form. L2E LAB uses Firebase Email/Password internally while the UI asks only for username and password.
3. After the new account-based deployment is live and tested, disable **Anonymous**. The checked-in Firestore rules already reject anonymous sessions.

Under **Authentication > Settings > Authorized domains**, add every deployed L2E LAB domain, including `l2e-lab.vercel.app`.

Usernames are normalized to lowercase, spaces and separators collapse to hyphens, and only 3-24 letters or numbers with internal hyphens are accepted. For example, `Ada Dev` and `ada-dev` address the same Firebase account. Internally, `ada-dev` becomes `l2e-ada-dev@learners.l2e-lab.invalid` so Firebase can provide password authentication without collecting a learner email.

Firebase Authentication enforces uniqueness through that deterministic internal email. The Auth profile `displayName` is also updated to the normalized username.

## 3. Password recovery limitation

There is no learner email recovery in this version because the Firebase email is an internal placeholder and no real learner email is collected. Do not show Firebase's “send password reset email” flow to learners.

If a learner forgets a password, a trusted operator must first verify the learner through an agreed offline process. Find the UID for the normalized username in **Firebase Console > Authentication > Users**, then reset the password from a trusted server or Cloud Shell with the Firebase Admin SDK (`updateUser(uid, { password })`). Never put Admin SDK credentials or this recovery operation in the browser application. A future release should add a verified recovery method before promising self-service password resets.

Learner passwords must contain 8-72 characters. Learners should use memorable, unique passwords and should not reuse passwords from other services. L2E LAB never stores plaintext passwords; Firebase Authentication handles them.

## 4. Create Firestore and deploy rules

Create the default Cloud Firestore database in **Production mode** if it does not exist. Then deploy the checked-in rules and index configuration from this repository:

```bash
npx firebase-tools login
npx firebase-tools deploy --project l2e-lab --only firestore
```

The deployed client permissions are deliberately narrow:

- A password-authenticated Firebase user with the reserved L2E learner email may get, create, and update only `learners/{theirUid}`.
- Learners cannot list the `learners` collection or read another UID.
- Deletes are denied.
- The dormant admin client has no route or collection access. An `admin` custom claim grants no extra, list, or cross-learner permission.
- Every unspecified Firestore path is denied.

Firebase Console access is governed by Google Cloud IAM and is not blocked by browser Security Rules.

### View learner usernames and progress

Open **Firebase Console > Firestore Database > Data > learners**. Every learner who completes signup or signin gets one document whose ID is their Firebase UID. The useful fields are:

- `displayName`: the normalized Learn2Earn username.
- `dailyProgress.python`: the completed Python day numbers.
- `finishedProjectIds`: completed assessment/project IDs.
- `firstSeenAt` and `lastSeenAt`: account activity timestamps.

The web app deliberately cannot list the `learners` collection or read another learner's document. Project owners can still see every learner document in Firebase Console through Google Cloud IAM.

## 5. Migration from anonymous learners

Anonymous Firebase identities cannot be safely matched to a new password account from the browser. Existing anonymous Firestore documents therefore remain separate historical records. When a returning learner creates a username/password account, locally stored progress can sync into the new UID after sign-in.

The current application contains no anonymous-signup call. After the password-account release is verified, disable **Anonymous** under **Firebase Console > Authentication > Sign-in method** so no older deployment or client can create another anonymous identity. Disabling the provider does not delete existing rows in **Authentication > Users**.

Before removing old anonymous users, confirm that none contains progress you still need. Delete a small number from **Authentication > Users**; for a large reviewed cleanup, use the Firebase Admin SDK only from a trusted server environment. Projects upgraded to Firebase Authentication with Identity Platform can instead enable automatic cleanup for anonymous accounts older than 30 days.

Recommended rollout order:

1. Configure all local and Vercel Firebase environment variables.
2. Enable Email/Password Authentication.
3. Deploy the new Firestore rules and the username/password application as one coordinated release (rules immediately before the application).
4. Confirm the production deployment is using the new environment variables and rules.
5. Verify signup, sign-in, refresh persistence, own progress hydration, and sign-out.
6. Disable Anonymous Authentication after no old deployment is serving anonymous sign-in code.

## 6. Verification checklist

- Creating a new normalized username succeeds once and a duplicate reports “username taken.”
- Wrong username/password combinations reveal neither which field was wrong nor the internal email.
- Refreshing the browser preserves a valid learner session.
- Signing out removes access until the learner signs in again.
- A learner can read and update only their own document.
- A collection query and another learner's document read both return `permission-denied`.
- An anonymous session cannot read learner documents, and an `admin` claim adds no list or cross-learner access under the deployed browser rules.

Firebase web configuration is not authorization. Firebase Authentication and Firestore Security Rules form the access boundary. Never add the Firebase Admin SDK or a service-account JSON key to the browser application.
