import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import SignInForm from './SignInForm.jsx';
import SignUpForm from './SignUpForm.jsx';
import ConfirmForm from './ConfirmForm.jsx';

export default function AuthView() {
  const { user, signIn, signUp, confirmSignUp } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState('signin');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  function showMessage(msg) {
    setMessage(msg);
    setTimeout(() => setMessage(''), 5000);
  }

  async function handleSignIn(creds) {
    await signIn(creds);
    navigate('/', { replace: true });
  }

  function handleSwitchToConfirm(email) {
    setConfirmEmail(email);
    setForm('confirm');
  }

  return (
    <div id="view-auth" className="view" style={{ display: 'block' }}>
      <div className="auth-container">
        <h1>NeatMemo</h1>

        {form === 'signin' && (
          <SignInForm
            onSignIn={handleSignIn}
            onSwitchToSignUp={() => setForm('signup')}
            onMessage={showMessage}
          />
        )}

        {form === 'signup' && (
          <SignUpForm
            onSignUp={signUp}
            onSwitchToSignIn={() => setForm('signin')}
            onSwitchToConfirm={handleSwitchToConfirm}
            onMessage={showMessage}
          />
        )}

        {form === 'confirm' && (
          <ConfirmForm
            email={confirmEmail}
            onConfirm={confirmSignUp}
            onBack={() => setForm('signin')}
            onMessage={showMessage}
          />
        )}

        {message && (
          <p style={{ color: 'red', marginTop: '10px' }}>{message}</p>
        )}
      </div>
    </div>
  );
}
