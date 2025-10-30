require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const AppleStrategy = require('passport-apple').Strategy;
const path = require('path');
const fs = require('fs');

// Import database and models
const db = require('./db/database');
const models = require('./db/models');

// Import routes
const oauthRoutes = require('./routes/oauth');
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Body parsing middleware (required for Apple Sign In)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Serialize user - store user ID in session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user - retrieve user from database
passport.deserializeUser(async (id, done) => {
  try {
    const user = await models.getUserById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback'
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const userData = {
        id: profile.id,
        displayName: profile.displayName,
        email: profile.emails?.[0]?.value,
        photo: profile.photos?.[0]?.value
      };

      const user = await models.findOrCreateUser('google', userData);
      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }));
}

// Apple Sign In Strategy
if (process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID) {
  try {
    const privateKeyPath = process.env.APPLE_PRIVATE_KEY_PATH;
    let privateKey = '';

    if (privateKeyPath && fs.existsSync(privateKeyPath)) {
      privateKey = fs.readFileSync(privateKeyPath, 'utf8');

      passport.use(new AppleStrategy({
        clientID: process.env.APPLE_CLIENT_ID,
        teamID: process.env.APPLE_TEAM_ID,
        keyID: process.env.APPLE_KEY_ID,
        privateKeyString: privateKey,
        callbackURL: process.env.APPLE_CALLBACK_URL || '/auth/apple/callback',
        passReqToCallback: false
      },
      async (accessToken, refreshToken, idToken, profile, done) => {
        try {
          console.log('Apple idToken received:', idToken ? 'present' : 'missing');
          console.log('Apple profile received:', JSON.stringify(profile, null, 2));

          // Apple's user ID is in the idToken.sub field
          // The idToken is a JWT, decode it to get the subject (user ID)
          let userId = null;

          if (idToken) {
            try {
              // Decode JWT without verification (Apple already verified it)
              const base64Payload = idToken.split('.')[1];
              const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString());
              userId = payload.sub;
              console.log('Decoded Apple ID token:', payload);
            } catch (decodeError) {
              console.error('Failed to decode Apple ID token:', decodeError);
            }
          }

          // Fallback to profile fields
          userId = userId || profile.sub || profile.id || profile.user;

          if (!userId) {
            console.error('No user ID found in Apple response');
            return done(new Error('Apple did not provide user ID'), null);
          }

          // Apple may not provide email on subsequent logins
          const email = profile.email || null;

          // Construct display name from Apple profile
          let displayName = 'Apple User';
          if (profile.name) {
            const firstName = profile.name.firstName || '';
            const lastName = profile.name.lastName || '';
            displayName = `${firstName} ${lastName}`.trim() || 'Apple User';
          }

          const userData = {
            id: userId,
            email: email,
            displayName: displayName,
            photo: null
          };

          console.log('Apple login userData:', userData);
          const user = await models.findOrCreateUser('apple', userData);
          return done(null, user);
        } catch (error) {
          console.error('Apple login error:', error);
          return done(error, null);
        }
      }));
    }
  } catch (error) {
    console.warn('Apple Sign In configuration incomplete:', error.message);
  }
}

// Set up EJS for templating
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static('public'));

// Mount OAuth and API routes
app.use('/oauth', oauthRoutes);
app.use('/api', apiRoutes);
app.use('/admin', adminRoutes);

// Routes
app.get('/', (req, res) => {
  res.render('index', { user: req.user });
});

app.get('/profile', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/');
  }
  res.render('profile', { user: req.user });
});

// Google OAuth routes
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    // Redirect to OAuth flow if there's a returnTo URL
    const returnTo = req.session.returnTo || '/profile';
    console.log('✅ Google login successful');
    console.log('   Session returnTo:', req.session.returnTo || 'not set');
    console.log('   Redirecting to:', returnTo);
    delete req.session.returnTo;
    res.redirect(returnTo);
  }
);

// Apple Sign In routes
app.post('/auth/apple',
  passport.authenticate('apple')
);

app.post('/auth/apple/callback',
  passport.authenticate('apple', { failureRedirect: '/' }),
  (req, res) => {
    // Redirect to OAuth flow if there's a returnTo URL
    const returnTo = req.session.returnTo || '/profile';
    delete req.session.returnTo;
    res.redirect(returnTo);
  }
);

// Logout
app.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/');
  });
});

// Health check
app.get('/health', (req, res) => {
  const googleConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const appleConfigured = !!(process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID);

  res.json({
    status: 'ok',
    providers: {
      google: googleConfigured ? 'configured' : 'not configured',
      apple: appleConfigured ? 'configured' : 'not configured'
    }
  });
});

// Initialize database and start server
async function startServer() {
  try {
    // Test database connection
    await db.testConnection();

    // Initialize database schema
    await db.initializeDatabase();

    // Schedule token cleanup
    db.scheduleTokenCleanup();

    // Start server
    app.listen(PORT, () => {
      console.log(`\n✓ OAuth Gateway Server running on http://localhost:${PORT}`);
      console.log(`\n=== OAuth Providers ===`);
      console.log(`Google OAuth: ${process.env.GOOGLE_CLIENT_ID ? '✓' : '✗'} configured`);
      console.log(`Apple Sign In: ${process.env.APPLE_CLIENT_ID ? '✓' : '✗'} configured`);
      console.log(`\n=== OAuth Endpoints ===`);
      console.log(`Authorization: http://localhost:${PORT}/oauth/authorize`);
      console.log(`Token:         http://localhost:${PORT}/oauth/token`);
      console.log(`Revoke:        http://localhost:${PORT}/oauth/revoke`);
      console.log(`Introspect:    http://localhost:${PORT}/oauth/introspect`);
      console.log(`UserInfo:      http://localhost:${PORT}/api/userinfo`);
      console.log(`\n=== Admin API ===`);
      console.log(`Client Mgmt:   http://localhost:${PORT}/api/admin/clients`);
      console.log(`Admin Key:     ${process.env.ADMIN_API_KEY ? '✓ Set' : '✗ Not set (required)'}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('\nSIGTERM signal received: closing HTTP server');
      await db.closeDatabase();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('\nSIGINT signal received: closing HTTP server');
      await db.closeDatabase();
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
