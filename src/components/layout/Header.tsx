import { Bell, Search, HelpCircle, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { universities } from '@/data/mockData';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Sidebar } from './Sidebar';
import { useState } from 'react';

export function Header() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const university = user?.universityId
    ? universities.find((u) => u.id === user.universityId)
    : null;

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b border-border bg-background px-6">
      {/* Left Section: Mobile Menu & University Badge */}
      <div className="flex items-center gap-4">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <Sidebar onLinkClick={() => setIsOpen(false)} />
          </SheetContent>
        </Sheet>

        {university && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/10 text-secondary border border-secondary/20">
            <div className="h-2 w-2 rounded-full bg-secondary animate-pulse" />
            <span className="text-sm font-semibold tracking-wide uppercase">{university.shortName}</span>
          </div>
        )}
      </div>

      {/* Center Section: Search Bar */}
      <div className="flex-1 flex justify-center max-w-2xl">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search across the university finding system..."
            className="pl-10 w-full bg-muted/40 border-border/50 focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/20 transition-all duration-200"
          />
        </div>
      </div>

      {/* Right Section: Actions */}
      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-1 border-r border-border pr-3 mr-1">
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
            <HelpCircle className="h-5 w-5" />
          </Button>
        </div>

        <Button variant="ghost" size="icon" className="relative hover:bg-primary/5 hover:text-primary transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground ring-2 ring-background">
            3
          </span>
        </Button>
      </div>
    </header>
  );
}
