import { useState } from 'react';

export default function TagInput({ tags, onChange, placeholder }) {
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);

  const add = () => {
    const t = input.trim();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setInput('');
  };

  return (
    <div className={`ep-tags ${focused ? 'ep-tags--focused' : ''}`}>
      <div className="ep-tags__surface">
        <div className="ep-tags__list">
          {tags.map((tag) => (
            <span key={tag} className="ep-tag">
              {tag}
              <button type="button" onClick={() => onChange(tags.filter((x) => x !== tag))} aria-label={`Remove ${tag}`}>×</button>
            </span>
          ))}
          <input
            className="ep-tags__field"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={tags.length === 0 ? placeholder : 'Add more…'}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          />
        </div>
      </div>
      <button type="button" className="ep-tags__add" onClick={add} disabled={!input.trim()}>Add</button>
    </div>
  );
}
