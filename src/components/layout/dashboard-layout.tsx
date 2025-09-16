'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3,
  Bell,
  ChevronDown,
  Euro,
  FileText,
  Home,
  LogOut,
  Menu,
  Package,
  Search,
  Settings,
  Shirt,
  User,
  Users,
  X,
  Moon,
  Sun,
  Monitor
} from 'lucide-react';
import { useTheme } from 'next-themes';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth, useAuthActions, useUserPermissions } from '@/store/auth';
import { useOfflineSync } from '@/components/offline/offline-sync-provider';
import { usePWAInstall } from '@/components/pwa/pwa-install-provider';
import { cn } from '@/lib/utils';

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  badge?: number;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const { signOut } = useAuthActions();
  const permissions = useUserPermissions();
  const { isOnline, pendingActions } = useOfflineSync();
  const { canInstall, showPrompt } = usePWAInstall();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Navigation principale
  const navigation: NavigationItem[] = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: Home,
    },
    {
      name: 'Factures',
      href: '/invoices',
      icon: FileText,
    },
    {
      name: 'Revenus',
      href: '/revenue',
      icon: Euro,
      permission: 'view_revenue',
    },
    {
      name: 'Statistiques',
      href: '/reports',
      icon: BarChart3,
      permission: 'view_revenue',
    },
    {
      name: 'Articles',
      href: '/articles',
      icon: Package,
      permission: 'modify_prices',
    },
    {
      name: 'Équipe',
      href: '/users',
      icon: Users,
      permission: 'manage_users',
    },
    {
      name: 'Paramètres',
      href: '/settings',
      icon: Settings,
    },
  ];

  // Filtrer la navigation selon les permissions
  const visibleNavigation = navigation.filter(item => {
    if (!item.permission) return true;
    return permissions.isOwner || permissions[item.permission as keyof typeof permissions];
  });

  // Fermer la sidebar sur mobile lors du changement de route
  useEffect(() => {
    setSidebarOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  // Écouter les raccourcis clavier
  useEffect(() => {
    const handleShortcuts = (event: Event) => {
      const customEvent = event as CustomEvent;
      
      switch (customEvent.type) {
        case 'shortcut-new-invoice':
          router.push('/invoices/new');
          break;
        case 'shortcut-search':
          document.getElementById('global-search')?.focus();
          break;
        case 'shortcut-escape':
          setSidebarOpen(false);
          setUserMenuOpen(false);
          break;
      }
    };

    window.addEventListener('shortcut-new-invoice', handleShortcuts);
    window.addEventListener('shortcut-search', handleShortcuts);
    window.addEventListener('shortcut-escape', handleShortcuts);

    return () => {
      window.removeEventListener('shortcut-new-invoice', handleShortcuts);
      window.removeEventListener('shortcut-search', handleShortcuts);
      window.removeEventListener('shortcut-escape', handleShortcuts);
    };
  }, [router]);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/invoices?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 transform bg-card border-r transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-6 border-b">
            <Link href="/dashboard" className="flex items-center space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
                <Shirt className="h-4 w-4" />
              </div>
              <span className="text-lg font-semibold">ZUA Pressing</span>
            </Link>
            
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-3 py-4">
            {visibleNavigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <item.icon className="mr-3 h-4 w-4 flex-shrink-0" />
                  {item.name}
                  {item.badge && (
                    <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Status indicators */}
          <div className="border-t p-4 space-y-2">
            {/* Status de connexion */}
            <div className={cn(
              'flex items-center space-x-2 text-xs',
              isOnline ? 'text-success' : 'text-warning'
            )}>
              <div className={cn(
                'h-2 w-2 rounded-full',
                isOnline ? 'bg-success' : 'bg-warning'
              )} />
              <span>{isOnline ? 'En ligne' : 'Hors ligne'}</span>
              {pendingActions > 0 && (
                <span className="text-muted-foreground">
                  ({pendingActions} en attente)
                </span>
              )}
            </div>

            {/* Installation PWA */}
            {canInstall && (
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start text-xs"
                onClick={showPrompt}
              >
                Installer l'application
              </Button>
            )}
          </div>
        </div>
      </aside>

      {/* Contenu principal */}
      <div className="lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6">
            <div className="flex items-center space-x-4">
              {/* Menu burger mobile */}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-4 w-4" />
              </Button>

              {/* Recherche globale */}
              <form onSubmit={handleSearch} className="hidden sm:flex">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="global-search"
                    type="search"
                    placeholder="Rechercher une facture..."
                    className="w-64 pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </form>
            </div>

            {/* Actions header */}
            <div className="flex items-center space-x-2">
              {/* Notifications */}
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-4 w-4" />
                {pendingActions > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground">
                    {pendingActions > 9 ? '9+' : pendingActions}
                  </span>
                )}
              </Button>

              {/* Toggle theme */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (theme === 'dark') {
                    setTheme('light');
                  } else if (theme === 'light') {
                    setTheme('system');
                  } else {
                    setTheme('dark');
                  }
                }}
              >
                {theme === 'dark' ? (
                  <Sun className="h-4 w-4" />
                ) : theme === 'light' ? (
                  <Monitor className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>

              {/* Menu utilisateur */}
              <div className="relative">
                <Button
                  variant="ghost"
                  className="flex items-center space-x-2 px-3"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                    {user.fullName.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden sm:block text-sm font-medium">
                    {user.fullName.split(' ')[0]}
                  </span>
                  <ChevronDown className="h-3 w-3" />
                </Button>

                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      className="absolute right-0 top-full mt-2 w-56 rounded-md border bg-popover p-2 shadow-lg"
                    >
                      <div className="px-2 py-1.5">
                        <p className="text-sm font-medium">{user.fullName}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                        <span className={cn(
                          'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium mt-1',
                          user.role === 'owner'
                            ? 'bg-primary/10 text-primary'
                            : 'bg-secondary/50 text-secondary-foreground'
                        )}>
                          {user.role === 'owner' ? 'Propriétaire' : 'Employé'}
                        </span>
                      </div>
                      
                      <div className="border-t my-2" />
                      
                      <Link
                        href="/profile"
                        className="flex items-center rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <User className="mr-2 h-4 w-4" />
                        Mon profil
                      </Link>
                      
                      <Link
                        href="/settings"
                        className="flex items-center rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <Settings className="mr-2 h-4 w-4" />
                        Paramètres
                      </Link>
                      
                      <div className="border-t my-2" />
                      
                      <button
                        onClick={handleSignOut}
                        className="flex w-full items-center rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Se déconnecter
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>

        {/* Contenu principal */}
        <main className="flex-1">
          <div className="container py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};