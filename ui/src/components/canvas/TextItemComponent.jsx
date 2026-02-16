import { useRef } from 'react';

export default function TextItemComponent({ item, onContentChange }) {
  const textareaRef = useRef(null);

  function handleInput(e) {
    item.content = e.target.value;
    if (onContentChange) onContentChange();
  }

  function handleMouseDown(e) {
    e.stopPropagation();
  }

  return (
    <textarea
      ref={textareaRef}
      className="text-content"
      placeholder="メモを入力..."
      defaultValue={item.content}
      onInput={handleInput}
      onMouseDown={handleMouseDown}
    />
  );
}
