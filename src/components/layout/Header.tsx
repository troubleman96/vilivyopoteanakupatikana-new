import { Bell, Search, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { universities } from '@/data/mockData';

export function Header() {
  const { user } = useAuth();

  const university = user?.universityId
    ? universities.find((u) => u.id === user.universityId)
    : null;

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-border bg-background px-6">
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search items, users, universities..."
          className="pl-10 bg-muted/50 border-0 focus-visible:bg-background focus-visible:ring-1"
        />
      </div>

      {/* University Badge */}
      {university && (
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/10 text-secondary">
          <span className="text-sm font-medium">{university.shortName}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
            3
          </span>
        </Button>
        <Button variant="ghost" size="icon">
          <HelpCircle className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
