# OAuth Login Demo - Architecture Documentation

## Table of Contents
1. [Overview](#overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Technology Stack](#technology-stack)
4. [Component Architecture](#component-architecture)
5. [Authentication Flows](#authentication-flows)
6. [File Structure](#file-structure)
7. [Data Flow](#data-flow)
8. [Security Architecture](#security-architecture)
9. [Deployment Architecture](#deployment-architecture)
10. [Sequence Diagrams](#sequence-diagrams)

---

## Overview

This is a **Node.js web application** demonstrating OAuth 2.0 authentication with Google and Apple Sign In. The application uses **Express.js** as the web framework and **Passport.js** for OAuth authentication strategy implementation.

**Purpose:** Showcase secure third-party authentication integration with modern OAuth providers.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Browser                             │
│                    (Client Application)                          │
└────────────┬────────────────────────────────────────────────────┘
             │
             │ HTTPS Request
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Nginx Reverse Proxy                         │
│                  (Port 80/443 → Port 3000)                       │
└────────────┬────────────────────────────────────────────────────┘
             │
             │ HTTP (localhost:3000)
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Node.js Application                           │
│                     (Express.js Server)                          │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐    │
│  │   Routes     │  │  Middleware  │  │  Passport.js       │    │
│  │   Handler    │  │   Layer      │  │  OAuth Strategies  │    │
│  └──────────────┘  └──────────────┘  └────────────────────┘    │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │             Session Management                            │   │
│  │        (express-session + in-memory store)                │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────┬────────────────────────────────────┬───────────────────┘
         │                                    │
         │ OAuth Flow                         │ OAuth Flow
         │                                    │
         ▼                                    ▼
┌─────────────────────────┐        ┌──────────────────────────┐
│   Google OAuth 2.0      │        │   Apple Sign In          │
│   Authorization Server  │        │   Authorization Server   │
└─────────────────────────┘        └──────────────────────────┘
```

---

## Technology Stack

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | v14+ | JavaScript runtime environment |
| **Express.js** | ^4.18.2 | Web application framework |
| **Passport.js** | ^0.7.0 | Authentication middleware |
| **passport-google-oauth20** | ^2.0.0 | Google OAuth 2.0 strategy |
| **passport-apple** | ^2.0.2 | Apple Sign In strategy |
| **express-session** | ^1.17.3 | Session management middleware |
| **dotenv** | ^16.3.1 | Environment variable management |

### Frontend
| Technology | Purpose |
|------------|---------|
| **EJS** | Server-side templating engine |
| **CSS3** | Styling and responsive design |
| **SVG** | OAuth provider icons |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| **Nginx** | Reverse proxy and SSL termination |
| **PM2** | Process manager for Node.js |

---

## Component Architecture

### 1. Application Server (`server.js`)

**Responsibilities:**
- HTTP server initialization
- Middleware configuration
- Route definition
- OAuth strategy configuration
- Session management
- Error handling

**Key Components:**

#### Middleware Stack (Order Matters!)
```javascript
1. express.json()              // Parse JSON bodies
2. express.urlencoded()        // Parse URL-encoded bodies (Apple requires this)
3. express-session             // Session management
4. passport.initialize()       // Initialize Passport
5. passport.session()          // Persistent login sessions
6. express.static()            // Serve static files
```

#### OAuth Strategies
```javascript
GoogleStrategy      // Google OAuth 2.0
AppleStrategy       // Apple Sign In
```

#### Route Handlers
```javascript
GET  /                          // Home page
GET  /profile                   // User profile (protected)
GET  /auth/google              // Initiate Google OAuth
GET  /auth/google/callback     // Google callback
POST /auth/apple               // Initiate Apple Sign In
POST /auth/apple/callback      // Apple callback
GET  /logout                   // Logout user
GET  /health                   // Health check endpoint
```

### 2. View Layer (`views/*.ejs`)

**Files:**
- `index.ejs` - Landing page with OAuth login buttons
- `profile.ejs` - User profile display page

**Responsibilities:**
- Render dynamic HTML content
- Display user information
- Provide login/logout UI

### 3. Static Assets (`public/css/style.css`)

**Responsibilities:**
- Application styling
- Responsive design
- OAuth button styling
- Layout and typography

### 4. Configuration Layer

**Environment Variables (`.env`):**
```env
PORT                      # Application port
SESSION_SECRET            # Session encryption key
GOOGLE_CLIENT_ID          # Google OAuth credentials
GOOGLE_CLIENT_SECRET
GOOGLE_CALLBACK_URL
APPLE_CLIENT_ID           # Apple Sign In credentials
APPLE_TEAM_ID
APPLE_KEY_ID
APPLE_PRIVATE_KEY_PATH
APPLE_CALLBACK_URL
```

---

## Authentication Flows

### Google OAuth 2.0 Flow

```
┌─────────┐                                                    ┌──────────┐
│ Browser │                                                    │  Google  │
└────┬────┘                                                    └────┬─────┘
     │                                                              │
     │ 1. Click "Sign in with Google"                              │
     ├──────────────────────────────────────────────────────────►  │
     │    GET /auth/google                                          │
     │                                                              │
     │ 2. Redirect to Google                                       │
     │ ◄───────────────────────────────────────────────────────────┤
     │    302 https://accounts.google.com/o/oauth2/v2/auth         │
     │        ?client_id=...                                        │
     │        &redirect_uri=https://ologin.wetigu.com/auth/        │
     │         google/callback                                      │
     │        &scope=profile+email                                  │
     │                                                              │
     │ 3. User authenticates with Google                           │
     ├─────────────────────────────────────────────────────────►   │
     │                                                              │
     │ 4. Google redirects back with authorization code            │
     │ ◄─────────────────────────────────────────────────────────  │
     │    302 https://ologin.wetigu.com/auth/google/callback       │
     │        ?code=AUTHORIZATION_CODE                              │
     │                                                              │
┌────┴────┐                                                    ┌────┴─────┐
│  App    │                                                    │  Google  │
│ Server  │                                                    │   APIs   │
└────┬────┘                                                    └────┬─────┘
     │                                                              │
     │ 5. Exchange code for access token                           │
     ├─────────────────────────────────────────────────────────►   │
     │    POST https://oauth2.googleapis.com/token                 │
     │    code=AUTHORIZATION_CODE                                   │
     │    client_id=...                                             │
     │    client_secret=...                                         │
     │                                                              │
     │ 6. Return access token                                      │
     │ ◄─────────────────────────────────────────────────────────  │
     │    { access_token: "...", id_token: "..." }                 │
     │                                                              │
     │ 7. Fetch user profile                                       │
     ├─────────────────────────────────────────────────────────►   │
     │    GET https://www.googleapis.com/oauth2/v1/userinfo        │
     │    Authorization: Bearer ACCESS_TOKEN                        │
     │                                                              │
     │ 8. Return user data                                         │
     │ ◄─────────────────────────────────────────────────────────  │
     │    { id, email, name, picture, ... }                        │
     │                                                              │
     │ 9. Create session and redirect to profile                   │
     ├──────────────────────────────────────────────────────────►  │
     │    302 /profile                                              │
     │    Set-Cookie: connect.sid=SESSION_ID                        │
     │                                                              │
```

**Key Points:**
- Uses **Authorization Code Grant** flow
- Requires **client_secret** (secure, server-side only)
- Callback is **GET** request with query parameter `code`
- Fetches user profile from Google APIs

### Apple Sign In Flow

```
┌─────────┐                                                    ┌──────────┐
│ Browser │                                                    │  Apple   │
└────┬────┘                                                    └────┬─────┘
     │                                                              │
     │ 1. Submit Apple Sign In form                                │
     ├──────────────────────────────────────────────────────────►  │
     │    POST /auth/apple                                          │
     │                                                              │
     │ 2. Redirect to Apple                                        │
     │ ◄───────────────────────────────────────────────────────────┤
     │    302 https://appleid.apple.com/auth/authorize             │
     │        ?client_id=com.wetigu.web                            │
     │        &redirect_uri=https://ologin.wetigu.com/auth/        │
     │         apple/callback                                       │
     │        &response_type=code                                   │
     │        &response_mode=form_post                              │
     │                                                              │
     │ 3. User authenticates with Apple ID                         │
     ├─────────────────────────────────────────────────────────►   │
     │                                                              │
     │ 4. Apple POSTs back with authorization code                 │
     │ ◄─────────────────────────────────────────────────────────  │
     │    POST https://ologin.wetigu.com/auth/apple/callback       │
     │    Content-Type: application/x-www-form-urlencoded          │
     │    code=AUTHORIZATION_CODE                                   │
     │    id_token=JWT_TOKEN                                        │
     │    user={"name":{"firstName":"...","lastName":"..."}}       │
     │                                                              │
┌────┴────┐                                                    ┌────┴─────┐
│  App    │                                                    │  Apple   │
│ Server  │                                                    │   APIs   │
└────┬────┘                                                    └────┬─────┘
     │                                                              │
     │ 5. Verify JWT and extract user data                         │
     ├──────────────────────────────────────────                   │
     │    Decode id_token (JWT)                                    │
     │    Verify signature with Apple's public key                 │
     │    Extract: sub (user id), email                            │
     │                                                              │
     │ 6. Exchange code for tokens (optional, for refresh)         │
     ├─────────────────────────────────────────────────────────►   │
     │    POST https://appleid.apple.com/auth/token                │
     │    code=AUTHORIZATION_CODE                                   │
     │    client_id=com.wetigu.web                                 │
     │    client_secret=JWT_SIGNED_WITH_P8_KEY                     │
     │                                                              │
     │ 7. Return tokens                                            │
     │ ◄─────────────────────────────────────────────────────────  │
     │    { access_token: "...", id_token: "...", refresh_token }  │
     │                                                              │
     │ 8. Create session and redirect to profile                   │
     ├──────────────────────────────────────────────────────────►  │
     │    302 /profile                                              │
     │    Set-Cookie: connect.sid=SESSION_ID                        │
     │                                                              │
```

**Key Points:**
- Uses **Authorization Code Grant** with **form_post** response mode
- Callback is **POST** request (not GET like Google)
- Requires **.p8 private key** to generate client_secret JWT
- User data comes in **id_token (JWT)** and optional `user` parameter
- **First sign-in only** includes full name in `user` parameter

### Differences: Google vs Apple

| Aspect | Google OAuth | Apple Sign In |
|--------|--------------|---------------|
| **Callback Method** | GET with query params | POST with form data |
| **Client Secret** | Static string | JWT signed with .p8 key |
| **User Data** | From API call | From JWT id_token |
| **Name Availability** | Always available | First sign-in only |
| **Email Sharing** | Required | Optional (user choice) |
| **Privacy** | Email visible | Can hide email |

---

## File Structure

```
ologin/
│
├── server.js                  # Main application server
├── package.json               # Dependencies and scripts
├── ecosystem.config.js        # PM2 process configuration
├── nginx.conf                 # Nginx reverse proxy config
│
├── .env                       # Environment variables (SECRET)
├── .env.example               # Environment template
├── .gitignore                 # Git ignore rules
│
├── views/                     # EJS templates
│   ├── index.ejs             # Landing page
│   └── profile.ejs           # User profile page
│
├── public/                    # Static assets
│   └── css/
│       └── style.css         # Application styles
│
├── logs/                      # PM2 logs (auto-generated)
│   ├── error.log
│   ├── output.log
│   └── combined.log
│
├── apple_*.p8                 # Apple private key (SECRET)
│
└── Documentation/
    ├── README.md              # Main documentation
    ├── DEPLOY-SIMPLE.md       # Deployment guide
    ├── APPLE-SIGNIN-FIX.md    # Apple troubleshooting
    └── ARCHITECTURE.md        # This file
```

**File Responsibilities:**

### `server.js` (163 lines)
- **Lines 1-11:** Import dependencies and initialize app
- **Lines 13-15:** Body parsing middleware (critical for Apple)
- **Lines 17-26:** Session configuration
- **Lines 28-34:** Passport serialization
- **Lines 36-57:** Google OAuth strategy
- **Lines 60-89:** Apple Sign In strategy
- **Lines 91-93:** View and static file configuration
- **Lines 95-139:** Route handlers
- **Lines 141-163:** Server startup and health check

### `views/index.ejs`
- Dynamic home page with conditional rendering
- Shows login buttons if not authenticated
- Shows welcome message if authenticated
- OAuth provider buttons with SVG icons

### `views/profile.ejs`
- Protected route (requires authentication)
- Displays user information from OAuth provider
- Shows raw user data in JSON format
- Logout functionality

### `public/css/style.css`
- CSS custom properties for theming
- Responsive design (mobile-first)
- OAuth button styling
- Card-based layout

---

## Data Flow

### 1. Request Flow

```
Browser Request
    ↓
Nginx (SSL Termination, Reverse Proxy)
    ↓
Express.js Server
    ↓
Middleware Chain:
    1. Body Parser (parse request body)
    2. Session (load session from cookie)
    3. Passport Initialize (setup auth)
    4. Passport Session (load user from session)
    5. Static Files (serve CSS/images if needed)
    ↓
Route Handler
    ↓
Passport Strategy (if auth route)
    ↓
OAuth Provider (Google/Apple)
    ↓
Callback Handler
    ↓
Session Storage (save user data)
    ↓
Response (redirect or render view)
    ↓
Browser (display page with session cookie)
```

### 2. Session Data Flow

```
User Login (OAuth Success)
    ↓
Passport Callback Function
    ↓
User Object Created:
    {
      provider: 'google' | 'apple',
      id: 'provider_user_id',
      displayName: 'User Name',
      email: 'user@example.com',
      photo: 'https://...' (Google only)
    }
    ↓
passport.serializeUser(user, done)
    ↓
Session Store (In-Memory)
    {
      cookie: { ... },
      passport: {
        user: { provider, id, displayName, email, photo }
      }
    }
    ↓
Session Cookie Sent to Browser
    Set-Cookie: connect.sid=SESSION_ID; HttpOnly; Secure
    ↓
Subsequent Requests
    ↓
Browser sends cookie: Cookie: connect.sid=SESSION_ID
    ↓
passport.deserializeUser(user, done)
    ↓
req.user populated
    ↓
Route handler can access req.user
```

### 3. Authentication State Check

```javascript
// Middleware checks:
app.get('/profile', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/');  // Not logged in
  }
  res.render('profile', { user: req.user });  // Logged in
});
```

---

## Security Architecture

### 1. Environment Variable Protection

**Secrets stored in `.env`:**
- Session secret (encryption key)
- Google OAuth credentials
- Apple credentials and private key

**Never committed to version control:**
```gitignore
.env
*.p8
```

### 2. Session Security

```javascript
session({
  secret: process.env.SESSION_SECRET,  // Secret signing key
  resave: false,                        // Don't save unchanged sessions
  saveUninitialized: false,             // Don't create session until login
  cookie: {
    secure: process.env.NODE_ENV === 'production',  // HTTPS only in prod
    maxAge: 24 * 60 * 60 * 1000          // 24 hour expiration
  }
})
```

**Session Cookie Attributes:**
- `HttpOnly` - JavaScript cannot access cookie (XSS protection)
- `Secure` - Only sent over HTTPS in production
- `SameSite` - CSRF protection (default: Lax)

### 3. OAuth Security

**Google OAuth:**
- Client secret never exposed to browser
- Server-side only authentication
- Token exchange happens on backend

**Apple Sign In:**
- Private key (.p8) never leaves server
- JWT client secret generated on-demand
- Callback uses POST (harder to leak in logs)

### 4. Input Validation

```javascript
// Body parsing with limits
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
```

### 5. HTTPS/SSL Termination

**Nginx handles SSL:**
- SSL certificates managed by Nginx
- Forces HTTPS in production
- Secure headers added:
  ```nginx
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header X-Real-IP $remote_addr;
  ```

### 6. Authentication Middleware

```javascript
// Protected route example:
function requireAuth(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.redirect('/');
  }
  next();
}

app.get('/profile', requireAuth, (req, res) => {
  // Only accessible when authenticated
});
```

### 7. Error Handling

```javascript
// OAuth failure redirects (no error details exposed)
passport.authenticate('google', { failureRedirect: '/' })
```

---

## Deployment Architecture

### Development Environment

```
┌─────────────────────────────┐
│   Developer Machine         │
│                              │
│  ┌────────────────────────┐ │
│  │  Node.js (port 3000)   │ │
│  │  npm run dev           │ │
│  │  (with nodemon)        │ │
│  └────────────────────────┘ │
│                              │
│  Access: http://localhost:3000│
└─────────────────────────────┘
```

### Production Environment

```
┌──────────────────────────────────────────────────────────┐
│                    Production Server                      │
│                                                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Nginx (Port 80/443)                 │    │
│  │          SSL Termination & Reverse Proxy         │    │
│  └──────────────────┬──────────────────────────────┘    │
│                     │                                     │
│                     │ HTTP (localhost:3000)               │
│                     ▼                                     │
│  ┌─────────────────────────────────────────────────┐    │
│  │         PM2 Process Manager                      │    │
│  │                                                   │    │
│  │  ┌─────────────────────────────────────────┐    │    │
│  │  │   Node.js App Instance 1 (Port 3000)    │    │    │
│  │  │   - Auto-restart on crash                │    │    │
│  │  │   - Log management                       │    │    │
│  │  │   - Memory monitoring                    │    │    │
│  │  └─────────────────────────────────────────┘    │    │
│  │                                                   │    │
│  │  Optional: Can run multiple instances for        │    │
│  │  load balancing (cluster mode)                   │    │
│  └─────────────────────────────────────────────────┘    │
│                                                           │
│  Access: https://ologin.wetigu.com                       │
└──────────────────────────────────────────────────────────┘
```

### PM2 Process Management

**Ecosystem Configuration** (`ecosystem.config.js`):
```javascript
{
  name: 'oauth-login',
  script: './server.js',
  instances: 1,              // Single instance
  autorestart: true,         // Restart on crash
  watch: false,              // Don't watch files in production
  max_memory_restart: '200M', // Restart if > 200MB
  env: {
    NODE_ENV: 'production',
    PORT: 3000
  }
}
```

**PM2 Features:**
- **Auto-restart** on application crash
- **Log rotation** and management
- **Memory monitoring** and limits
- **Startup script** for system boot
- **Zero-downtime** reloads (with cluster mode)

### Nginx Configuration

**Key Features:**
```nginx
# SSL/TLS
listen 443 ssl http2;
ssl_certificate /path/to/cert.crt;
ssl_certificate_key /path/to/private.key;

# Proxy headers (preserve client info)
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;

# WebSocket support
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection 'upgrade';
proxy_cache_bypass $http_upgrade;
```

---

## Sequence Diagrams

### Complete Login Flow (Google)

```
User         Browser      Nginx      App Server    Passport    Google
 │              │           │            │            │          │
 │ 1. Visit     │           │            │            │          │
 │  website     │           │            │            │          │
 ├─────────────►│           │            │            │          │
 │              │           │            │            │          │
 │              │ 2. GET /  │            │            │          │
 │              ├──────────►│            │            │          │
 │              │           │ 3. Proxy   │            │          │
 │              │           ├───────────►│            │          │
 │              │           │            │ 4. Render  │          │
 │              │           │            │   index.ejs│          │
 │              │           │            │◄───────────┤          │
 │              │           │ 5. HTML    │            │          │
 │              │◄──────────┤            │            │          │
 │              │           │            │            │          │
 │ 6. Click     │           │            │            │          │
 │  "Google"    │           │            │            │          │
 ├─────────────►│           │            │            │          │
 │              │ 7. GET    │            │            │          │
 │              │ /auth/    │            │            │          │
 │              │  google   │            │            │          │
 │              ├──────────►│            │            │          │
 │              │           ├───────────►│            │          │
 │              │           │            │ 8. Init    │          │
 │              │           │            │   Google   │          │
 │              │           │            │   Strategy │          │
 │              │           │            ├───────────►│          │
 │              │           │            │            │ 9. Redirect│
 │              │           │            │            │   to Google│
 │              │           │            │            ├─────────►│
 │              │           │ 10. 302    │            │          │
 │              │◄──────────┴────────────┴────────────┘          │
 │              │ Location: https://accounts.google.com/...     │
 │              │                                                 │
 │ 11. Redirected│                                               │
 │  to Google   ├────────────────────────────────────────────────►│
 │              │                                                 │
 │ 12. Enter    │                                                 │
 │  credentials │◄────────────────────────────────────────────────┤
 ├─────────────►│                                                 │
 │              │ 13. Submit                                      │
 │              ├────────────────────────────────────────────────►│
 │              │                                                 │
 │              │ 14. Redirect with code                         │
 │              │◄────────────────────────────────────────────────┤
 │              │ Location: https://ologin.wetigu.com/auth/       │
 │              │           google/callback?code=AUTH_CODE        │
 │              │                                                 │
 │              │ 15. GET callback                               │
 │              ├──────────►│                                     │
 │              │           ├───────────►│                        │
 │              │           │            ├───────────►│           │
 │              │           │            │            │ 16. Exchange│
 │              │           │            │            │    code   │
 │              │           │            │            ├──────────►│
 │              │           │            │            │           │
 │              │           │            │            │ 17. Token │
 │              │           │            │            │◄──────────┤
 │              │           │            │            │           │
 │              │           │            │            │ 18. Get   │
 │              │           │            │            │    profile│
 │              │           │            │            ├──────────►│
 │              │           │            │            │           │
 │              │           │            │            │ 19. User  │
 │              │           │            │            │    data   │
 │              │           │            │            │◄──────────┤
 │              │           │            │            │           │
 │              │           │            │ 20. Create │           │
 │              │           │            │    session │           │
 │              │           │            │◄───────────┤           │
 │              │           │            │            │           │
 │              │           │ 21. 302 /profile       │           │
 │              │           │    Set-Cookie: sid=... │           │
 │              │◄──────────┴────────────┘            │           │
 │              │                                                 │
 │ 22. Logged   │                                                 │
 │   in!        │                                                 │
 │◄─────────────┤                                                 │
```

---

## Key Design Decisions

### 1. Why Passport.js?

**Advantages:**
- ✅ Standard OAuth 2.0 implementation
- ✅ Supports 500+ authentication strategies
- ✅ Easy to add more providers (Facebook, GitHub, etc.)
- ✅ Well-documented and maintained
- ✅ Handles complex OAuth flows automatically

### 2. Why In-Memory Sessions?

**Current Implementation:**
- Simple for demo purposes
- No database required
- Fast access

**Production Consideration:**
- Sessions lost on server restart
- Not suitable for multiple server instances
- **Recommendation:** Use Redis or database session store for production

### 3. Why EJS Templating?

**Advantages:**
- ✅ Simple syntax (embedded JavaScript)
- ✅ Server-side rendering (better SEO)
- ✅ No build step required
- ✅ Easy to pass server data to views

### 4. Why POST for Apple Callback?

**Apple Sign In Requirement:**
- Apple uses `response_mode=form_post`
- Callback data sent as POST form data
- More secure than query parameters (no URL logging)
- Requires `express.urlencoded()` middleware

### 5. Why Nginx Reverse Proxy?

**Benefits:**
- ✅ SSL/TLS termination (offload from Node.js)
- ✅ Static file serving (better performance)
- ✅ Load balancing capability
- ✅ Request buffering
- ✅ DDoS protection
- ✅ Compression (gzip)

---

## Performance Considerations

### 1. Session Storage

**Current:** In-memory (fast but limited)

**Production Options:**
```javascript
// Redis session store
const RedisStore = require('connect-redis')(session);
app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET
}));
```

### 2. Static File Caching

**Nginx configuration:**
```nginx
location ~* \.(css|js|jpg|png|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### 3. Compression

**Enable gzip in Nginx:**
```nginx
gzip on;
gzip_types text/css application/javascript application/json;
gzip_min_length 1000;
```

---

## Monitoring & Debugging

### Health Check Endpoint

```
GET /health

Response:
{
  "status": "ok",
  "providers": {
    "google": "configured",
    "apple": "configured"
  }
}
```

### PM2 Monitoring

```bash
pm2 status              # Application status
pm2 logs oauth-login    # View logs
pm2 monit               # Real-time monitoring
```

### Log Files

```
logs/error.log          # Error logs
logs/output.log         # Console output
logs/combined.log       # All logs
```

---

## Scaling Considerations

### Horizontal Scaling (Multiple Instances)

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'oauth-login',
    script: './server.js',
    instances: 4,           // Run 4 instances
    exec_mode: 'cluster',   // Cluster mode
    // ... other config
  }]
};
```

**Requirements:**
- Session store must be external (Redis/database)
- Sticky sessions in load balancer (or use Redis)

### Vertical Scaling

```javascript
max_memory_restart: '500M'  // Increase memory limit
```

---

## Future Enhancements

### Recommended Improvements

1. **Database Integration**
   - Store user profiles in database
   - Persistent user data

2. **Redis Session Store**
   - Persistent sessions
   - Multi-instance support

3. **More OAuth Providers**
   - Facebook
   - GitHub
   - Microsoft
   - Twitter

4. **User Profile Management**
   - Allow users to update profile
   - Link multiple OAuth accounts

5. **Rate Limiting**
   ```javascript
   const rateLimit = require('express-rate-limit');
   app.use('/auth', rateLimit({ max: 10, windowMs: 60000 }));
   ```

6. **CSRF Protection**
   ```javascript
   const csrf = require('csurf');
   app.use(csrf());
   ```

7. **Logging Framework**
   ```javascript
   const winston = require('winston');
   // Structured logging
   ```

---

## Conclusion

This OAuth login demo showcases a **production-ready architecture** for implementing third-party authentication. The design emphasizes:

- **Security:** Environment variables, HTTPS, secure sessions
- **Scalability:** PM2 process management, Nginx reverse proxy
- **Maintainability:** Clear separation of concerns, well-documented code
- **Extensibility:** Easy to add more OAuth providers

The architecture follows **industry best practices** and can serve as a foundation for larger applications requiring OAuth authentication.
