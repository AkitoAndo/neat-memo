import { useState } from 'react';

export default function ConfirmForm({ email, onConfirm, onBack, onMessage }) {
  const [code, setCode] = useState('');

  async function handleSubmit() {
    try {
      await onConfirm({ username: email, confirmationCode: code });
      onBack();
      onMessage('確認完了。ログインしてください。');
    } catch (e) {
      console.error(e);
      onMessage(`確認エラー: ${e.message}`);
    }
  }

  return (
    <div id="auth-confirm">
      <h2>確認コード入力</h2>
      <p>メールアドレスに送信されたコードを入力してください。</p>
      <input
        type="text"
        placeholder="確認コード"
        value={code}
        onChange={e => setCode(e.target.value)}
      />
      <button className="primary-btn full-width" onClick={handleSubmit}>確認</button>
      <button
        className="secondary-btn full-width"
        style={{ marginTop: '10px' }}
        onClick={onBack}
      >
        戻る
      </button>
    </div>
  );
}
