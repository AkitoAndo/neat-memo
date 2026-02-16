import { useState } from 'react';

export default function SignUpForm({ onSignUp, onSwitchToSignIn, onSwitchToConfirm, onMessage }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit() {
    try {
      await onSignUp({
        username: email,
        password,
        options: {
          userAttributes: { email }
        }
      });
      onSwitchToConfirm(email);
      onMessage('確認コードを送信しました。メールを確認してください。');
    } catch (e) {
      console.error(e);
      onMessage(`登録エラー: ${e.message}`);
    }
  }

  return (
    <div id="auth-signup">
      <h2>新規登録</h2>
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
      <button className="primary-btn full-width" onClick={handleSubmit}>登録</button>
      <p className="auth-link">
        既にアカウントをお持ちの方は{' '}
        <a href="#" onClick={e => { e.preventDefault(); onSwitchToSignIn(); }}>ログイン</a>
      </p>
    </div>
  );
}
