'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Target,
  Settings,
  Award,
  ChevronDown,
  ChevronRight,
  LifeBuoy,
  ClipboardCheck,
} from 'lucide-react';
import { useState } from 'react';

interface MenuChild {
  href: string;
  label: string;
  children?: MenuChild[];
  hidden?: boolean;
}

interface MenuItem {
  href: string;
  label: string;
  icon: typeof Home;
  children?: MenuChild[];
}

const menuItems: MenuItem[] = [
  { href: '/', label: 'Trang chủ', icon: Home },

  {
    href: '/target',
    label: 'Mục tiêu chiến lược',
    icon: Target,
    children: [
      {
        href: '/target/objectives',
        label: 'Mục tiêu',
        children: [
          { href: '/admin/bsc', label: 'Quản lý phối cảnh' },
          { href: '/kpi/strategic-objectives', label: 'Mục tiêu chiến lược' },
        ],
      },
      { href: '/admin/kpi-catalogs', label: 'Chỉ tiêu KPI' },
      { href: '/admin/ke-hoach-cong-tac', label: 'Kế hoạch công tác' },
      { href: '/kpi/domain/training-program', label: 'Kế hoạch đào tạo' },
    ],
  },

  {
    href: '/deploy',
    label: 'Triển khai thực hiện',
    icon: ClipboardCheck,
    children: [
      { href: '/kpi/unit-work-plan', label: 'Kế hoạch đơn vị' },
      { href: '/kpi/my-work-plan', label: 'Kế hoạch cá nhân' },
    ],
  },

  {
    href: '/quality',
    label: 'Đánh giá chất lượng',
    icon: Award,
    children: [
      { href: '/kpi/evaluation', label: 'Đánh giá KPI' },
      { href: '/kpi/scoring', label: 'Xếp loại chất lượng' },
    ],
  },

  {
    href: '/admin',
    label: 'Quản trị',
    icon: Settings,
    children: [
      { href: '/admin/settings', label: 'Cấu hình hệ thống' },
      {
        href: '/admin/danh-muc',
        label: 'Danh mục',
        children: [
          { href: '/admin/danh-muc/don-vi-tinh', label: 'Danh mục đơn vị tính' },
          { href: '/kpi/cycles', label: 'Danh mục chu kỳ' },
          { href: '/admin/danh-muc/dieu-kien-danh-gia', label: 'Danh mục điều kiện đánh giá' },
          { href: '/admin/danh-muc/linh-vuc-kpi', label: 'Danh mục Lĩnh vực KPI' },
          { href: '/admin/danh-muc/linh-vuc-cong-tac', label: 'Danh mục Lĩnh vực công tác' },
          { href: '/admin/danh-muc/don-vi', label: 'Danh mục đơn vị' },
          { href: '/admin/danh-muc/nguon-du-lieu', label: 'Danh mục nguồn dữ liệu' },
        ],
      },
    ],
  },

  {
    href: '/support',
    label: 'Hỗ trợ',
    icon: LifeBuoy,
    children: [
      { href: '/kpi/roles-guide', label: 'Hướng dẫn vai trò' },
      { href: '/kpi/architecture', label: 'Kiến trúc hệ thống' },
    ],
  },
];

function flattenLeaves(child: MenuChild): string[] {
  if (child.children && child.children.length > 0) {
    return child.children.flatMap(flattenLeaves);
  }
  return [child.href];
}

function activeInGroup(item: MenuItem, pathname: string): boolean {
  if (!item.children) return false;
  const leaves = item.children.flatMap(flattenLeaves);
  return leaves.some(h => pathname === h || pathname.startsWith(h + '/'));
}

export default function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const [expandedGroups, setExpandedGroups] = useState<string[]>(() => {
    if (pathname === '/') return ['/target', '/quality'];
    return menuItems.filter(i => activeInGroup(i, pathname)).map(i => i.href);
  });
  const [expandedSub, setExpandedSub] = useState<string[]>(() => {
    const subs: string[] = [];
    menuItems.forEach(item => {
      item.children?.forEach(child => {
        if (child.children && flattenLeaves(child).some(h => pathname === h || pathname.startsWith(h + '/'))) {
          subs.push(child.href);
        }
      });
    });
    return subs;
  });

  const toggleGroup = (href: string) => {
    setExpandedGroups(prev => prev.includes(href) ? prev.filter(h => h !== href) : [...prev, href]);
  };

  const toggleSub = (href: string) => {
    setExpandedSub(prev => prev.includes(href) ? prev.filter(h => h !== href) : [...prev, href]);
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const renderChild = (child: MenuChild, depth: number) => {
    if (child.children && child.children.length > 0) {
      const isExpanded = expandedSub.includes(child.href);
      return (
        <div key={child.href}>
          <button
            onClick={() => toggleSub(child.href)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              activeInGroup({ href: child.href, label: child.label, icon: Target, children: child.children }, pathname)
                ? 'text-primary font-medium'
                : 'text-text-dark hover:bg-bg-cream'
            }`}
          >
            <span className="flex-1 text-left" style={{ paddingLeft: depth * 12 }}>{child.label}</span>
            {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
          {isExpanded && (
            <div className="ml-6 mt-0.5 space-y-0.5 border-l-2 border-primary-light pl-2">
              {child.children.map(c => renderChild(c, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        key={child.href}
        href={child.href}
        onClick={onClose}
        className={`block px-3 py-1.5 rounded-lg text-sm transition-colors ${
          isActive(child.href)
            ? 'bg-primary text-white font-medium'
            : 'text-text-light hover:bg-bg-cream hover:text-text-dark'
        }`}
      >
        <span style={{ paddingLeft: depth * 12 }} className="inline-block">{child.label}</span>
      </Link>
    );
  };

  const renderChildren = (children: MenuChild[]) => (
    <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-primary-light pl-3">
      {children.map(child => renderChild(child, 0))}
    </div>
  );

  return (
    <aside className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-64 flex-col bg-white border-r border-border transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
      isOpen ? 'translate-x-0' : '-translate-x-full'
    }`}>
      <div className="shrink-0 p-4 border-b border-border flex items-center justify-between bg-white">
        <Link href="/" className="flex items-center gap-3">
          <img src="/logo-hpu2.png" alt="Đại học Sư phạm Hà Nội 2" className="w-10 h-10 object-contain" />
          <div>
            <div className="font-heading font-bold text-primary text-sm">HỆ THỐNG KPI</div>
            <div className="text-xs text-text-light">Đại học Sư phạm Hà Nội 2</div>
          </div>
        </Link>
        <button onClick={onClose} className="p-1 text-text-light hover:text-text-dark lg:hidden" aria-label="Đóng menu">
          ✕
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const hasChildren = item.children && item.children.length > 0;
          const isExpanded = expandedGroups.includes(item.href);
          const active = isActive(item.href);
          const childActive = hasChildren ? activeInGroup(item, pathname) : false;

          if (hasChildren) {
            return (
              <div key={item.href} className="mb-1">
                <button
                  onClick={() => toggleGroup(item.href)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    childActive
                      ? 'bg-primary-light text-primary font-medium'
                      : 'text-text-dark hover:bg-bg-cream'
                  }`}
                >
                  <Icon size={18} />
                  <span className="text-sm flex-1 text-left">{item.label}</span>
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                {isExpanded && renderChildren(item.children!)}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${
                active
                  ? 'bg-primary-light text-primary font-medium'
                  : 'text-text-dark hover:bg-bg-cream'
              }`}
            >
              <Icon size={18} />
              <span className="text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}