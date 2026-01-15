
import { SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Bell, Check, Info, AlertTriangle, Package, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

// Mock types for now
type NotificationType = 'info' | 'success' | 'warning' | 'match';

interface Notification {
    id: string;
    title: string;
    message: string;
    timestamp: string;
    read: boolean;
    type: NotificationType;
}

const MOCK_NOTIFICATIONS: Notification[] = [
    {
        id: '1',
        title: 'Potential Match Found',
        message: 'We found an item that matches your "Blue Backpack" report.',
        timestamp: '2 mins ago',
        read: false,
        type: 'match',
    },
    {
        id: '2',
        title: 'Item Verified',
        message: 'Your lost iPhone 13 has been verified by security.',
        timestamp: '1 hour ago',
        read: false,
        type: 'success',
    },
    {
        id: '3',
        title: 'System Update',
        message: 'The platform will undergo maintenance at 2 AM.',
        timestamp: '5 hours ago',
        read: true,
        type: 'info',
    },
    {
        id: '4',
        title: 'New Found Item Near You',
        message: 'A set of keys was found near the Library.',
        timestamp: '1 day ago',
        read: true,
        type: 'info',
    },
];

export function NotificationsPanel() {
    const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);

    const markAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const getIcon = (type: NotificationType) => {
        switch (type) {
            case 'match':
                return <CheckCircle2 className="h-4 w-4 text-primary" />;
            case 'success':
                return <Check className="h-4 w-4 text-green-500" />;
            case 'warning':
                return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
            case 'info':
            default:
                return <Info className="h-4 w-4 text-blue-500" />;
        }
    };

    const getBackground = (type: NotificationType) => {
        switch (type) {
            case 'match':
                return 'bg-primary/10';
            case 'success':
                return 'bg-green-500/10';
            case 'warning':
                return 'bg-yellow-500/10';
            case 'info':
            default:
                return 'bg-blue-500/10';
        }
    };

    return (
        <SheetContent side="right" className="w-full sm:w-96 flex flex-col p-0">
            <SheetHeader className="px-6 py-4 border-b border-border">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Bell className="h-5 w-5 text-primary" />
                        <SheetTitle>Notifications</SheetTitle>
                    </div>
                    {notifications.some(n => !n.read) && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-8 text-muted-foreground hover:text-primary"
                            onClick={markAllAsRead}
                        >
                            Mark all read
                        </Button>
                    )}
                </div>
                <SheetDescription>
                    Stay updated with your lost and found items.
                </SheetDescription>
            </SheetHeader>

            <ScrollArea className="flex-1">
                <div className="flex flex-col">
                    {notifications.length > 0 ? (
                        notifications.map((notification) => (
                            <div
                                key={notification.id}
                                className={cn(
                                    "flex items-start gap-4 px-6 py-4 border-b border-border/50 hover:bg-muted/50 transition-colors cursor-pointer",
                                    !notification.read && "bg-muted/30"
                                )}
                            >
                                <div className={cn("mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", getBackground(notification.type))}>
                                    {getIcon(notification.type)}
                                </div>
                                <div className="flex-1 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <p className={cn("text-sm font-medium leading-none", !notification.read && "text-foreground")}>
                                            {notification.title}
                                        </p>
                                        <span className="text-xs text-muted-foreground">{notification.timestamp}</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                        {notification.message}
                                    </p>
                                    {!notification.read && (
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="h-2 w-2 rounded-full bg-primary" />
                                            <span className="text-[10px] font-medium text-primary uppercase tracking-wider">Unread</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                                <Bell className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <p className="text-muted-foreground">No notifications yet</p>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </SheetContent>
    );
}
