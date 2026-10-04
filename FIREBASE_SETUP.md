# Firebase Setup Guide - Melan Jaya POS

## 🔥 Firebase Configuration

### 1. Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project named `agnes-pos` (or use existing)
3. Enable **Authentication** and **Firestore Database**

### 2. Authentication Setup

1. In Firebase Console → Authentication → Sign-in method
2. Enable **Google** as sign-in provider
3. Add your email domains to the whitelist:
   - `gmail.com`
   - Or specific emails: `tiuss75@gmail.com`, `owner2.tiuss168@gmail.com`, `owner1.melawatisubrata@gmail.com`

### 3. Firestore Database Setup

1. In Firebase Console → Firestore Database
2. Create database in **test mode** (for development) or **locked mode** (for production)
3. Start in **Asia Southeast (Singapore)** or **Asia Southeast (Jakarta)** for better latency

### 4. Firestore Security Rules

Replace the default rules with the following:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Main POS data document
    match /pos_data/store_data {
      // Public read access (for E-Katalog)
      allow read: if true;
      // Only allowed emails can write
      allow write: if request.auth != null && 
        (request.auth.token.email in [
          'owner.tiuss75@gmail.com', 
          'tiuss75@gmail.com',
          'owner2.tiuss168@gmail.com',
          'owner1.melawatisubrata@gmail.com'
        ]);
    }
    
    // Allow read for all collections under pos_data for public catalog
    match /pos_data/{document=**} {
      allow read: if true;
      allow write: if request.auth != null && 
        (request.auth.token.email in [
          'owner.tiuss75@gmail.com', 
          'tiuss75@gmail.com',
          'owner2.tiuss168@gmail.com',
          'owner1.melawatisubrata@gmail.com'
        ]);
    }
    
    // Legacy collections fallback
    match /{collection}/{document=**} {
      allow read: if true;
      allow write: if request.auth != null && 
        (request.auth.token.email in [
          'owner.tiuss75@gmail.com', 
          'tiuss75@gmail.com',
          'owner2.tiuss168@gmail.com',
          'owner1.melawatisubrata@gmail.com'
        ]);
    }
  }
}
```

### 5. Environment Variables

Create `.env.local` file in your project root:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=YOUR_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=agnes-pos.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=agnes-pos
VITE_FIREBASE_STORAGE_BUCKET=agnes-pos.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=YOUR_SENDER_ID
VITE_FIREBASE_APP_ID=YOUR_APP_ID

# App Configuration
VITE_APP_NAME=Melan Jaya POS
VITE_APP_VERSION=2.1.0
```

### 6. Deploy Rules

After updating the rules, deploy them using Firebase CLI:

```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Login to Firebase
firebase login

# Deploy rules only
firebase deploy --only firestore:rules
```

## 🛠 Troubleshooting

### Common Issues

1. **Login Failed / Redirect Issues**
   - Make sure your domain is whitelisted in Firebase Authentication
   - For GitHub Pages, use popup authentication instead of redirect
   - Check if your Firebase configuration is correct

2. **Permission Denied Errors**
   - Verify your Firestore rules are deployed correctly
   - Make sure you're logged in with an authorized email
   - Check the email in your Google account matches the whitelist

3. **Data Not Syncing**
   - Check if Firebase is configured (`.env.local` file)
   - Verify you have internet connection
   - Check browser console for errors
   - Try refreshing the page

4. **Firebase Not Initialized**
   - Ensure all environment variables are set correctly
   - Restart your development server after changing `.env.local`
   - Clear browser cache if changes don't take effect

### Debug Mode

The application has a built-in Firebase Debug Inspector in Settings → Firebase Debug Inspector. Use it to:
- Check if Firebase is configured
- View raw data from Firestore
- Test read/write permissions
- Diagnose connection issues

## 📋 Authorized Owner Emails

The following emails have write access to Firebase:

- `owner.tiuss75@gmail.com`
- `tiuss75@gmail.com`
- `owner2.tiuss168@gmail.com`
- `owner1.melawatisubrata@gmail.com`

To add more owners, update both:
1. Firestore security rules
2. `ALLOWED_OWNER_EMAILS` array in `SettingsPage.jsx`

## 🔄 Data Flow

```
User Action → React State → Local Storage → Firebase Firestore
                          ↓
                    DataContext → Sync Status
                          ↓
                    Real-time Updates
```

- All data is first saved locally
- Then synced to Firebase if authenticated and authorized
- Real-time updates from Firebase to all connected clients
- Offline mode works with local storage cache