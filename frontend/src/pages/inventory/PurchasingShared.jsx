import moduleStyles from '../ModulePage.module.css';
import local from './Purchasing.module.css';
import { titleCase } from './utils';

const GREEN = new Set(['manager_approved', 'approved', 'received', 'qc_completed', 'completed']);
const AMBER = new Set([
  'draft',
  'planned',
  'in_progress',
  'pending_manager',
  'pending_admin',
  'converted_to_po',
  'partially_received',
  'partially_qc',
  'partially_approved',
  'pending',
]);
const RED = new Set(['rejected', 'cancelled']);

export function StatusBadge({ status }) {
  let className = moduleStyles.badgeGray;
  if (GREEN.has(status)) className = moduleStyles.badgeGreen;
  else if (AMBER.has(status)) className = local.badgeAmber;
  else if (RED.has(status)) className = moduleStyles.badgeRed;
  return <span className={className}>{titleCase(status)}</span>;
}

export function DetailField({ label, children }) {
  return (
    <div className={local.detailItem}>
      <span className={local.detailLabel}>{label}</span>
      <span className={local.detailValue}>{children ?? '—'}</span>
    </div>
  );
}
