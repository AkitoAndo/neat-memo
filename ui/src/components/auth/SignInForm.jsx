import { useState } from 'react';

export default function SignInForm({ onSignIn, onSwitchToSignUp, onMessage }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit() {
    try {
      await onSignIn({ username: email, password });
    } catch (e) {
      console.error(e);
      onMessage(`ログインエラー: ${e.message}`);
    }
  }

  return (
    <div id="auth-signin">
      <h2>ログイン</h2>
      <input
        type="email"
        placeholder="メールアドレス"
        value={email}
        onChange={e => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="パスワード"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />
      <button className="primary-btn full-width" onClick={handleSubmit}>ログイン</button>
      <p className="auth-link">
        アカウントをお持ちでない方は{' '}
        <a href="#" onClick={e => { e.preventDefault(); onSwitchToSignUp(); }}>新規登録</a>
      </p>
    </div>
  );
}
