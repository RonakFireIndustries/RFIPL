import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import logo from '@/assets/logo.png';
import styles from './Layout.module.css';

const NAV_SECTIONS = [
  {
    title: 'Overview',
    items: [{ to: '/dashboard', label: 'Dashboard' }],
  },
  {
    title: 'HRMS',
    items: [
      { to: '/employees', label: 'Employees' },
      { to: '/departments', label: 'Departments' },
      { to: '/designations', label: 'Designations' },
      { to: '/shifts', label: 'Shifts' },
      { to: '/attendance', label: 'Attendance' },
      { to: '/my-attendance', label: 'My Attendance' },
      { to: '/locations', label: 'Locations' },
      { to: '/leave', label: 'Leave' },
      { to: '/payroll', label: 'Payroll' },
    ],
  },
  {
    title: 'Inventory',
    items: [
      { to: '/inventory/raw-materials', label: 'Raw Material' },
      { to: '/inventory/machines-tools', label: 'Machine & Tools' },
      { to: '/inventory/finished-products', label: 'Finished Products' },
      { to: '/inventory/movements', label: 'Movements' },
      { to: '/purchase-orders', label: 'Purchase Orders' },
      { to: '/sales-orders', label: 'Sales Orders' },
    ],
  },
  {
    title: 'Account',
    items: [{ to: '/settings', label: 'Settings' }],
  },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <img src={logo} alt="Management Software" className={styles.logoImg} />
          <div>
            <h2>Management Software</h2>
          </div>
        </div>
        <nav className={styles.nav}>
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className={styles.section}>
              <span className={styles.sectionTitle}>{section.title}</span>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `${styles.navLink} ${isActive ? styles.active : ''}`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <div className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <span className={styles.greeting}>Welcome, {user?.email}</span>
          </div>
          <div className={styles.topbarRight}>
            <span className={styles.roleBadge}>
              {user?.roles?.[0]?.name || 'User'}
            </span>
            <button onClick={handleLogout} className={styles.logoutBtn}>
              Logout
            </button>
          </div>
        </header>
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}