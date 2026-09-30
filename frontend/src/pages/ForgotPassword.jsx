import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '@/api/auth';
import styles from './Auth.module.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setResetToken('');
    setSubmitting(true);
    try {
      const data = await forgotPassword(email);
      setSuccess(data.message);
      setResetToken(data.resetToken);
    } catch (err) {
      if (err.status === 404) setError('No account found with this email');
      else setError(err.message || 'Failed to generate reset token');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.authPage}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>RFIPL</h1>
          <p className={styles.subtitle}>Reset your password</p>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          {success && (
            <div className={styles.success}>
              <p>{success}</p>
              {resetToken && (
                <p className={styles.tokenHint}>
                  Your reset token: <code>{resetToken}</code>
                  <br />
                  <Link to={`/reset-password?token=${resetToken}`} className={styles.tokenLink}>
                    Click here to reset password
                  </Link>
                </p>
              )}
            </div>
          )}
          <div className={styles.field}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>
          <button type="submit" className={styles.btn} disabled={submitting}>
            {submitting ? 'Sending...' : 'Send Reset Token'}
          </button>
        </form>
        <div className={styles.footer}>
          <Link to="/login">Back to Sign In</Link>
        </div>
      </div>
    </div>
  );
}