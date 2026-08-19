import { useEffect, useRef, useState } from 'react';

export default function MessageComposer({ onSend, onTyping, disabled }) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const typingTimer = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => () => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    onTyping?.(false);
  }, [onTyping]);

  const handleChange = (e) => {
    setText(e.target.value);
    onTyping?.(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => onTyping?.(false), 1200);
  };

  const onPickFiles = (e) => {
    const next = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...next].slice(0, 5));
    e.target.value = '';
  };

  const submit = (e) => {
    e.preventDefault();
    const value = text.trim();
    if ((!value && !files.length) || disabled) return;
    onSend(value, files);
    setText('');
    setFiles([]);
    onTyping?.(false);
  };

  return (
    <form className="msg-composer" onSubmit={submit}>
      <input
        ref={fileRef}
        type="file"
        hidden
        multiple
        accept="image/*,video/*,.pdf,.zip,.rar,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt"
        onChange={onPickFiles}
      />
      <button
        type="button"
        className="msg-composer__attach"
        title="Attach photo, video, PDF, ZIP…"
        onClick={() => fileRef.current?.click()}
        disabled={disabled}
      >
        +
      </button>
      <div className="msg-composer__field">
        {files.length > 0 && (
          <div className="msg-composer__files">
            {files.map((f) => (
              <span key={`${f.name}-${f.size}`}>
                {f.name}
                <button
                  type="button"
                  aria-label={`Remove ${f.name}`}
                  onClick={() => setFiles((prev) => prev.filter((x) => x !== f))}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          type="text"
          value={text}
          onChange={handleChange}
          placeholder="iMessage"
          disabled={disabled}
          maxLength={4000}
          aria-label="Message"
        />
      </div>
      <button type="submit" disabled={disabled || (!text.trim() && !files.length)}>
        Send
      </button>
    </form>
  );
}
