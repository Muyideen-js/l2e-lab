# L2E LAB pair programming setup

Pair programming is available in every unlocked **100 Days of Python** workspace. Firebase proves who the learner is; Liveblocks and Yjs synchronize the Monaco document and cursors.

## One-time setup

1. Create a Liveblocks project at <https://liveblocks.io/dashboard>.
2. Open **API keys**, copy the project's **secret key** (`sk_...`), and keep it private.
3. In Vercel, open the L2E LAB project, then **Settings → Environment Variables**.
4. Add `LIVEBLOCKS_SECRET_KEY` with the secret key for Production, Preview, and Development.
5. Confirm the existing `VITE_FIREBASE_API_KEY` is also available in those environments.
6. Redeploy the project.

Do not put the secret in any `VITE_` variable. Vite variables are bundled into browser JavaScript. For complete local testing, add the key only to your ignored `.env` and run `vercel dev`; plain `npm run dev` does not serve the `/api/liveblocks-auth` Vercel Function.

## Learner flow

1. Sign in and open any Python day.
2. Select **Pair program**.
3. Select **Invite** and send the private link to one learner.
4. The invited learner signs in and opens the link.
5. Both learners can type in the same editor and see live cursors. Each learner runs Python and checks the solution in their own browser.
6. Select the exit icon beside **Invite** to leave the room.

Rooms accept two learners and invite links expire after 24 hours. Completing the challenge is deliberately per learner: shared code does not mark either account complete until that learner runs **Check work** successfully.

## Security model

- The browser sends its current Firebase ID token to the same-origin auth endpoint.
- The endpoint validates that token with Firebase and accepts only L2E LAB username/password accounts.
- The endpoint grants a short-lived Liveblocks token for exactly the requested, unexpired room.
- `LIVEBLOCKS_SECRET_KEY` stays in the Vercel Function and is never sent to the browser.
