import styles from './FormField.module.css';

export default function FormField({ label, type = 'text', value, onChange, placeholder, required, error, children, options, disabled }) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>
        {label} {required && <span className={styles.required}>*</span>}
      </label>
      {children || (
        type === 'select' ? (
          <select className={`${styles.input} ${error ? styles.errorInput : ''}`} value={value} onChange={onChange} required={required} disabled={disabled}>
            <option value="">{placeholder || 'Select...'}</option>
            {options?.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ) : type === 'textarea' ? (
          <textarea className={`${styles.input} ${styles.textarea} ${error ? styles.errorInput : ''}`} value={value} onChange={onChange} placeholder={placeholder} required={required} disabled={disabled} rows={3} />
        ) : (
          <input className={`${styles.input} ${error ? styles.errorInput : ''}`} type={type} value={value} onChange={onChange} placeholder={placeholder} required={required} disabled={disabled} />
        )
      )}
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  );
}