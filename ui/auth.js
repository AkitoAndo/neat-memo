import { Amplify } from 'aws-amplify';
import { 
    signUp, 
    confirmSignUp, 
    signIn, 
    signOut, 
    getCurrentUser, 
    fetchAuthSession 
} from 'aws-amplify/auth';

const env = window.ENV || {};

// Configure Amplify
if (env.USER_POOL_ID && env.USER_POOL_CLIENT_ID) {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: env.USER_POOL_ID,
        userPoolClientId: env.USER_POOL_CLIENT_ID,
      }
    }
  });
}

// Export as an object to match app.js usage
export const auth = {
    signUp,
    confirmSignUp,
    signIn,
    signOut,
    getCurrentUser,
    fetchAuthSession
};