import { Bell, ChevronDown, CircleDollarSign, ClipboardList, Command, Boxes, LayoutDashboard, LifeBuoy, Menu, PackageCheck, PanelLeftClose, Truck, UsersRound, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';

const navItems = [
  { href: '/', label: 'Control tower', icon: LayoutDashboard },
  { href: '/orders', label: 'Orders', icon: ClipboardList },
  { href: '/inventory', label: 'Inventory', icon: Boxes },
  { href: '/fulfillment', label: 'Fulfillment', icon: Truck, count: 7 },
  { href: '/vendors', label: 'Vendors', icon: UsersRound },
  { href: '/settlements', label: 'Settlements', icon: CircleDollarSign },
];

export function CommerceShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[246px] flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200 md:translate-x-0 ${collapsed ? 'md:w-[76px]' : ''} ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-[76px] items-center border-b border-sidebar-border px-5">
          <Link href="/" data-testid="link-brand" className="flex min-w-0 items-center gap-3" onClick={() => setMobileOpen(false)}>
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
              <Command size={19} strokeWidth={2.5} />
            </div>
            {!collapsed && <div className="min-w-0"><div className="truncate text-[15px] font-extrabold tracking-tight">meridian</div><div className="font-mono text-[9px] uppercase tracking-[0.18em] text-sidebar-foreground/50">commerce os</div></div>}
          </Link>
          <button type="button" onClick={() => setMobileOpen(false)} className="ml-auto rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent md:hidden" data-testid="button-close-mobile-nav"><X size={17} /></button>
        </div>
        <div className="px-4 pt-7">
          {!collapsed && <p className="mb-3 px-2 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-sidebar-foreground/40">Command center</p>}
          <nav className="space-y-1">
            {navItems.map(({ href, label, icon: Icon, count }) => {
              const active = href === '/' ? location === '/' : location.startsWith(href);
              return (
                <Link href={href} key={href} onClick={() => setMobileOpen(false)} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`} className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition-colors ${active ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'} ${collapsed ? 'justify-center px-2' : ''}`}>
                  <Icon size={17} strokeWidth={active ? 2.4 : 1.8} className={active ? 'text-sidebar-primary' : 'text-sidebar-foreground/45 group-hover:text-sidebar-foreground/80'} />
                  {!collapsed && <><span className="flex-1">{label}</span>{count && <span className="rounded-full bg-sidebar-primary/15 px-1.5 py-0.5 font-mono text-[10px] text-sidebar-primary">{count}</span>}</>}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="mt-auto p-4">
          {!collapsed && (
            <div className="mb-4 rounded-xl border border-sidebar-border bg-sidebar-accent/50 p-3.5">
              <div className="mb-2 flex items-center justify-between"><span className="font-mono text-[9px] uppercase tracking-[0.18em] text-sidebar-foreground/45">System pulse</span><span className="flex items-center gap-1.5 font-mono text-[9px] text-sidebar-primary"><span className="size-1.5 rounded-full bg-sidebar-primary" /> live</span></div>
              <div className="font-mono text-[11px] text-sidebar-foreground/75">All services nominal</div>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-sidebar-border"><div className="h-full w-[94%] rounded-full bg-sidebar-primary" /></div>
              <div className="mt-1.5 flex justify-between font-mono text-[9px] text-sidebar-foreground/40"><span>uptime</span><span>99.98%</span></div>
            </div>
          )}
          <button type="button" onClick={() => setCollapsed((value) => !value)} className="hidden w-full items-center justify-center gap-2 rounded-lg p-2 text-sidebar-foreground/45 hover:bg-sidebar-accent hover:text-sidebar-foreground md:flex" data-testid="button-toggle-sidebar">
            <PanelLeftClose size={16} className={collapsed ? 'rotate-180' : ''} /><span className={collapsed ? 'sr-only' : 'text-[11px]'}>Collapse rail</span>
          </button>
        </div>
      </aside>
      {mobileOpen && <button type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-sm md:hidden" data-testid="button-dismiss-mobile-nav" />}
      <div className={`min-h-[100dvh] transition-[padding] duration-200 ${collapsed ? 'md:pl-[76px]' : 'md:pl-[246px]'}`}>
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-border/80 bg-background/95 px-4 backdrop-blur-md sm:px-7">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setMobileOpen(true)} className="rounded-lg border border-border bg-card p-2 md:hidden" data-testid="button-open-mobile-nav"><Menu size={18} /></button>
            <div className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:flex"><span className="size-1.5 rounded-full bg-primary" /> operations / {location === '/' ? 'overview' : location.split('/')[1]}</div>
          </div>
          <div className="flex items-center gap-2.5">
            <button type="button" className="relative rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" data-testid="button-notifications"><Bell size={18} strokeWidth={1.8} /><span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-accent" /></button>
            <div className="mx-1 hidden h-6 w-px bg-border sm:block" />
            <button type="button" className="flex items-center gap-2 rounded-lg p-1.5 pr-2 hover:bg-muted" data-testid="button-profile-menu">
              <div className="grid size-8 place-items-center rounded-md bg-[#d7e7df] font-mono text-[11px] font-medium text-[#205442]">AM</div>
              <div className="hidden text-left sm:block"><div className="text-xs font-bold">Avery Morgan</div><div className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">Ops lead</div></div><ChevronDown size={14} className="hidden text-muted-foreground sm:block" />
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-[1540px] px-4 py-6 sm:px-7 lg:px-9">{children}</main>
      </div>
    </div>
  );
}

export function PageHeading({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail?: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="mb-2 flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-primary"><span className="size-1.5 rounded-full bg-primary" />{eyebrow}</div><h1 className="text-[26px] font-extrabold tracking-[-0.04em] text-foreground sm:text-[30px]">{title}</h1>{detail && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{detail}</p>}</div>{action}</div>;
}
