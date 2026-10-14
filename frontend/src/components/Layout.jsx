import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import logo from '@/assets/logo.png';
import Icon from './Icon';
import styles from './Layout.module.css';

const NAV_SECTIONS = [
  {
    title: 'Overview',
    items: [{ to: '/dashboard', label: 'Dashboard', icon: 'dashboard' }],
  },
  {
    title: 'HRMS',
    items: [
      { to: '/employees', label: 'Employees', icon: 'users' },
      { to: '/departments', label: 'Departments', icon: 'building' },
      { to: '/designations', label: 'Designations', icon: 'award' },
      { to: '/shifts', label: 'Shifts', icon: 'clock' },
      { to: '/attendance', label: 'Attendance', icon: 'calendarCheck' },
      { to: '/my-attendance', label: 'My Attendance', icon: 'userCheck' },
      { to: '/locations', label: 'Locations', icon: 'mapPin' },
      { to: '/leave', label: 'Leave', icon: 'plane' },
      { to: '/payroll', label: 'Payroll', icon: 'banknote' },
    ],
  },
  {
    title: 'Inventory',
    items: [
      { to: '/inventory/raw-materials', label: 'Raw Material', icon: 'package' },
      { to: '/inventory/machines-tools', label: 'Machine & Tools', icon: 'wrench' },
      { to: '/inventory/finished-products', label: 'Finished Products', icon: 'boxes' },
      { to: '/inventory/movements', label: 'Movements', icon: 'arrowsLeftRight' },
      { to: '/purchase-orders', label: 'Purchase Orders', icon: 'cart' },
      { to: '/sales-orders', label: 'Sales Orders', icon: 'receipt' },
    ],
  },
  {
    title: 'Account',
    items: [{ to: '/settings', label: 'Settings', icon: 'settings' }],
  },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const role = user?.roles?.[0]?.name || 'User';
  const initial = (user?.email || 'U').trim().charAt(0).toUpperCase();

  return (
    <div className={styles.layout}>
      <div
        className={`${styles.overlay} ${sidebarOpen ? styles.overlayOpen : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.logo}>
          <img src={logo} alt="" className={styles.logoImg} />
          <div className={styles.brand}>
            <h2 className={styles.brandTitle}>Management</h2>
            <span className={styles.brandSub}>Software</span>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <nav className={styles.nav}>
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className={styles.section}>
              <span className={styles.sectionTitle}>{section.title}</span>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `${styles.navLink} ${isActive ? styles.active : ''}`
                  }
                >
                  <Icon name={item.icon} size={18} className={styles.navIcon} />
                  <span className={styles.navLabel}>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <span className={styles.footerText}>Ronak Fire India Pvt. Ltd.</span>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button
              type="button"
              className={styles.menuBtn}
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Icon name="menu" size={22} />
            </button>
            <span className={styles.greeting}>
              Welcome{user?.email ? <>, <strong>{user.email}</strong></> : ''}
            </span>
          </div>
          <div className={styles.topbarRight}>
            <span className={styles.roleBadge}>{role}</span>
            <span className={styles.avatar} title={user?.email || ''}>{initial}</span>
            <button onClick={handleLogout} className={styles.logoutBtn} title="Sign out">
              <Icon name="logOut" size={16} />
              <span className={styles.logoutLabel}>Logout</span>
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
