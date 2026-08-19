export default function SectionActions({ visible, canSave, saving, onSave, onCancel }) {
  if (!visible) return null;
  return (
    <div className="ep-section-actions">
      <button type="button" className="mac-btn mac-btn--ghost" onClick={onCancel} disabled={saving}>
        Cancel
      </button>
      <button type="button" className="mac-btn mac-btn--filled" onClick={onSave} disabled={!canSave || saving}>
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  );
}
