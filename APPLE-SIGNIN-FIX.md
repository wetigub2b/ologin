# Apple Sign In - Loop Issue Fix

## ✅ Code Fix Applied

Added body parsing middleware to `server.js` - **Apple Sign In requires this to handle form data!**

```javascript
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
```

## 🔍 Verify Apple Developer Portal Configuration

Apple Sign In callback URL: **`https://ologin.wetigu.com/auth/apple/callback`**

### Step 1: Check Service ID Configuration

1. Go to [Apple Developer Portal](https://developer.apple.com/account/resources/identifiers/list/serviceId)
2. Select your Service ID: **`com.wetigu.web`**
3. Click "Configure" next to "Sign In with Apple"
4. Verify configuration:

   **Domains and Subdomains:**
   ```
   ologin.wetigu.com
   ```

   **Return URLs:**
   ```
   https://ologin.wetigu.com/auth/apple/callback
   ```

5. Click "Save" and "Continue"

### Step 2: Verify Your Current Configuration

Your `.env` settings:
```env
APPLE_CLIENT_ID=com.wetigu.web
APPLE_TEAM_ID=KA8D6U5MW3
APPLE_KEY_ID=GZRD4D43HG
APPLE_PRIVATE_KEY_PATH=./apple_wetigu_teamid_KA8D6U5MW3_AuthKey_GZRD4D43HG.p8
APPLE_CALLBACK_URL=https://ologin.wetigu.com/auth/apple/callback
```

✅ Private key file exists
✅ Callback URL is set correctly
✅ Body parsing middleware added

## 🚀 Apply the Fix

**Restart your application:**

```bash
# If using PM2
pm2 restart oauth-login

# If using npm start
# Press Ctrl+C and run again
npm start
```

## 🧪 Test the Fix

1. Visit: https://ologin.wetigu.com
2. Click "Continue with Apple"
3. Sign in with your Apple ID
4. Should redirect to: https://ologin.wetigu.com/profile

## ❌ Common Issues & Solutions

### Issue 1: "invalid_request" Error
**Cause:** Return URL mismatch
**Fix:**
- Callback URL in `.env` must **exactly** match the Return URL in Apple Developer Portal
- Both must use `https://` (not `http://`)
- No trailing slashes

### Issue 2: Still Looping After Fix
**Cause:** Session cookie not being saved
**Fix:** Check nginx configuration has proxy headers:
```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

### Issue 3: "invalid_client" Error
**Cause:** Wrong credentials or expired key
**Fix:**
- Verify `APPLE_CLIENT_ID` matches Service ID
- Verify `APPLE_TEAM_ID` is correct
- Verify `APPLE_KEY_ID` matches the key in Developer Portal
- Check if `.p8` key has been revoked

### Issue 4: CORS or Domain Not Verified
**Cause:** Domain not verified in Apple Developer Portal
**Fix:**
- Download the verification file from Apple
- Upload to: https://ologin.wetigu.com/.well-known/apple-developer-domain-association.txt
- Wait for Apple to verify (can take a few minutes)

## 🔧 Debug Mode

Add debug logging to see what's happening:

```bash
# Check PM2 logs
pm2 logs oauth-login

# Or check if errors are logged
tail -f /home/mli/tigub2b/ologin/logs/error.log
```

Add this to `server.js` after line 128 for debugging:

```javascript
app.post('/auth/apple/callback',
  (req, res, next) => {
    console.log('Apple callback received:', req.body);
    next();
  },
  passport.authenticate('apple', { failureRedirect: '/' }),
  (req, res) => {
    console.log('Apple auth successful:', req.user);
    res.redirect('/profile');
  }
);
```

## ✅ Checklist

- [x] Body parsing middleware added
- [ ] Apple Developer Portal Return URL: `https://ologin.wetigu.com/auth/apple/callback`
- [ ] Apple Developer Portal Domain: `ologin.wetigu.com`
- [ ] Application restarted
- [ ] Test Apple Sign In

## 📞 Still Not Working?

Check the health endpoint: https://ologin.wetigu.com/health

It should show:
```json
{
  "status": "ok",
  "providers": {
    "google": "configured",
    "apple": "configured"
  }
}
```
