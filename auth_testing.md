# Auth-Gated App Testing Playbook (Bounce)

Bounce uses Emergent-managed Google Auth (no passwords). Sessions are stored in Mongo
(`user_sessions`) and validated via `session_token` cookie OR `Authorization: Bearer` header.

## Step 1 — Create a test user + session
```bash
mongosh "$MONGO_URL" --eval "
const dbn = 'test_database';
const d = db.getSiblingDB(dbn);
const userId = 'user_test' + Date.now();
const token = 'test_session_' + Date.now();
d.users.insertOne({ user_id: userId, email: 'test.user@example.com', name: 'Test User', picture: '', provider: 'google', created_at: new Date().toISOString() });
['Startup','Marketing','Research','Coding','Personal'].forEach(n => d.folders.insertOne({ folder_id: 'fld_' + Math.random().toString(16).slice(2,14), user_id: userId, name: n, created_at: new Date().toISOString() }));
d.user_sessions.insertOne({ user_id: userId, session_token: token, expires_at: new Date(Date.now()+7*864e5).toISOString(), created_at: new Date().toISOString() });
print('TOKEN=' + token); print('USER=' + userId);
"
```

## Step 2 — Backend API (use external URL + /api prefix, Bearer token)
```bash
curl -s "$URL/api/auth/me" -H "Authorization: Bearer $TOKEN"
curl -s "$URL/api/folders" -H "Authorization: Bearer $TOKEN"
curl -s -X POST "$URL/api/memory/save" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"conversation":"User: build a react todo app with fastapi. Decision: use JWT. TODO: dark mode.","folder_id":"<FOLDER_ID>"}'
```

## Step 3 — Browser testing (set cookie, then navigate)
```python
await page.context.add_cookies([{ "name":"session_token","value":"<TOKEN>","domain":"<host>","path":"/","httpOnly":True,"secure":True,"sameSite":"None" }])
# OR seed localStorage for the axios Bearer fallback:
await page.add_init_script("localStorage.setItem('bounce_token','<TOKEN>')")
await page.goto("<URL>/dashboard")
```

## Success
- `/api/auth/me` returns the user (not 401)
- `/dashboard` renders sidebar + Recent (no redirect to /login)
