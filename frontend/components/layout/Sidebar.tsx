'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  LayoutDashboard, Map, Search, Eye, Settings,
  LogOut, Cpu, Globe, Plus, FolderGit2
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard',           label: 'Dashboard',              desc: 'Overview & active cases',          icon: LayoutDashboard },
  { href: '/projects',            label: 'Investigation Dossiers', desc: 'Concessions & FER records',        icon: FolderGit2,      anchor: 'projects-list' },
  { href: '/global-intelligence', label: 'Global Intelligence',    desc: 'Macro planetary screening',        icon: Globe,           anchor: 'global-intelligence' },
  { href: '/projects/new',        label: 'New Project',            desc: 'AOI intake & setup',               icon: Plus,            anchor: 'project-intake' },
  { href: '/map',                 label: 'Environmental Map',      desc: 'Temporal split-view GIS',          icon: Map,             anchor: 'environmental-map' },
  { href: '/shadow-footprint',    label: 'Shadow Footprint',       desc: 'Concession & radial buffer audit', icon: Search,          anchor: 'shadow-footprint' },
  { href: '/watchtower',          label: 'Watchtower',             desc: 'STAC automated surveillance',      icon: Eye,             anchor: 'watchtower' },
  { href: '/deployment',          label: 'Architecture',           desc: 'System infrastructure',            icon: Cpu },
  { href: '/settings',            label: 'Settings',               desc: 'Configuration & keys',             icon: Settings },
];

const NAV_SECTION_1 = NAV_ITEMS.slice(0, 4);
const NAV_SECTION_2 = NAV_ITEMS.slice(4, 7);
const NAV_SECTION_3 = NAV_ITEMS.slice(7);

interface SidebarProps {
  onReplayTour?: () => void;
}

export function Sidebar({ onReplayTour }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname.startsWith(href + '/');
  }

  function NavLink({ href, label, desc, icon: Icon, anchor }: typeof NAV_ITEMS[0]) {
    const active = isActive(href);
    return (
      <Link
        href={href}
        data-tour={anchor}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.625rem',
          padding: '0.45rem 0.65rem',
          borderRadius: '6px',
          textDecoration: 'none',
          transition: 'all 150ms ease',
          background: active ? '#78917C' : 'transparent',
          color: active ? '#FFFFFF' : '#D2DCD4',
        }}
        onMouseEnter={(e) => {
          if (!active) {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.color = '#FFFFFF';
          }
        }}
        onMouseLeave={(e) => {
          if (!active) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#D2DCD4';
          }
        }}
      >
        <Icon
          size={16}
          style={{ flexShrink: 0, color: active ? '#FFFFFF' : '#A4B8AB' }}
        />
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{
            display: 'block',
            fontSize: '0.8125rem',
            fontWeight: active ? 600 : 500,
            lineHeight: 1.25,
            color: active ? '#FFFFFF' : '#E6EDE8',
          }}>
            {label}
          </span>
          <span style={{
            display: 'block',
            fontSize: '0.6875rem',
            color: active ? 'rgba(255, 255, 255, 0.75)' : '#8FA897',
            lineHeight: 1.2,
            marginTop: 1,
          }}>
            {desc}
          </span>
        </span>
      </Link>
    );
  }

  return (
    <aside
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        height: '100vh',
        width: 256,
        backgroundColor: '#19382D', /* Deep Forest */
        color: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 40,
        overflowY: 'auto',
        borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '2px 0 12px rgba(25, 56, 45, 0.15)',
      }}
    >
      {/* Brand Logo Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '1rem 1.25rem 0.875rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        flexShrink: 0,
      }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          backgroundColor: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          overflow: 'hidden',
          padding: 2,
          boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
        }}>
          <Image
            src="/logo.png"
            alt="EcoSentinel Logo"
            width={36}
            height={36}
            style={{ objectFit: 'contain' }}
          />
        </div>
        <div>
          <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
            EcoSentinel
          </div>
          <div style={{ fontSize: '0.625rem', fontWeight: 600, color: '#A3B8A8', letterSpacing: '0.06em', textTransform: 'uppercase', lineHeight: 1, marginTop: 2 }}>
            Environmental Intelligence
          </div>
        </div>
      </div>

      {/* Navigation Sections */}
      <nav style={{ flex: 1, padding: '0.75rem 0.75rem 0.5rem', overflowY: 'auto' }}>
        {/* Workspace */}
        <div style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8FA897', padding: '0.5rem 0.625rem 0.35rem' }}>
          Workspace
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_SECTION_1.map(item => <NavLink key={item.href} {...item} />)}
        </div>

        {/* Investigation */}
        <div style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8FA897', padding: '0.85rem 0.625rem 0.35rem' }}>
          Investigation
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_SECTION_2.map(item => <NavLink key={item.href} {...item} />)}
        </div>

        {/* System */}
        <div style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8FA897', padding: '0.85rem 0.625rem 0.35rem' }}>
          System
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_SECTION_3.map(item => <NavLink key={item.href} {...item} />)}
        </div>
      </nav>

      {/* User & Platform Footer */}
      <div style={{
        padding: '0.875rem 1rem',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        backgroundColor: 'rgba(0, 0, 0, 0.12)',
        flexShrink: 0,
      }}>
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.full_name || user.email.split('@')[0]}
              </div>
              <div style={{ fontSize: '0.6875rem', color: '#A3B8A8', textTransform: 'capitalize' }}>
                {user.role} {user.organization ? `· ${user.organization}` : ''}
              </div>
            </div>
            <button
              onClick={() => logout()}
              title="Sign out"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#A3B8A8',
                cursor: 'pointer',
                padding: 4,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#FFFFFF'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#A3B8A8'; }}
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <div style={{ fontSize: '0.75rem', color: '#A3B8A8' }}>
            Observational GIS Mode
          </div>
        )}
      </div>
    </aside>
  );
}
