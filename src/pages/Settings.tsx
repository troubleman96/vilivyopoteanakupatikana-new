import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Settings as SettingsIcon,
  Bell,
  Shield,
  Mail,
  Globe,
  Database,
  Save,
} from 'lucide-react';

export default function Settings() {
  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    newItems: true,
    matchAlerts: true,
    weeklyReports: false,
  });

  const [security, setSecurity] = useState({
    twoFactor: false,
    sessionTimeout: '30',
    ipRestriction: false,
  });

  const handleSave = () => {
    toast.success('Settings saved successfully');
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-3">
          <SettingsIcon className="h-7 w-7 text-primary" />
          System Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure system-wide settings and preferences
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general" className="gap-2">
            <Globe className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" />
            Email
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-6">
          <div className="stat-card">
            <h3 className="font-semibold mb-4">System Information</h3>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="system-name">System Name</Label>
                  <Input
                    id="system-name"
                    defaultValue="TZ UniFind"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="version">Version</Label>
                  <Input
                    id="version"
                    defaultValue="1.0.0"
                    disabled
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="description">System Description</Label>
                <Input
                  id="description"
                  defaultValue="Tanzania University Lost & Found Control System"
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <div className="stat-card">
            <h3 className="font-semibold mb-4">Regional Settings</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  defaultValue="Africa/Dar_es_Salaam (EAT)"
                  disabled
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="language">Default Language</Label>
                <Input
                  id="language"
                  defaultValue="English"
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Notifications Settings */}
        <TabsContent value="notifications" className="space-y-6">
          <div className="stat-card">
            <h3 className="font-semibold mb-4">Email Notifications</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Email Alerts</p>
                  <p className="text-sm text-muted-foreground">
                    Receive email notifications for important events
                  </p>
                </div>
                <Switch
                  checked={notifications.emailAlerts}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, emailAlerts: checked })
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">New Item Reports</p>
                  <p className="text-sm text-muted-foreground">
                    Get notified when new items are reported
                  </p>
                </div>
                <Switch
                  checked={notifications.newItems}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, newItems: checked })
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Match Alerts</p>
                  <p className="text-sm text-muted-foreground">
                    Get notified when potential matches are found
                  </p>
                </div>
                <Switch
                  checked={notifications.matchAlerts}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, matchAlerts: checked })
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Weekly Reports</p>
                  <p className="text-sm text-muted-foreground">
                    Receive weekly summary reports
                  </p>
                </div>
                <Switch
                  checked={notifications.weeklyReports}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, weeklyReports: checked })
                  }
                />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security" className="space-y-6">
          <div className="stat-card">
            <h3 className="font-semibold mb-4">Authentication</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Two-Factor Authentication</p>
                  <p className="text-sm text-muted-foreground">
                    Require 2FA for all admin accounts
                  </p>
                </div>
                <Switch
                  checked={security.twoFactor}
                  onCheckedChange={(checked) =>
                    setSecurity({ ...security, twoFactor: checked })
                  }
                />
              </div>
              <Separator />
              <div>
                <Label htmlFor="timeout">Session Timeout (minutes)</Label>
                <Input
                  id="timeout"
                  type="number"
                  value={security.sessionTimeout}
                  onChange={(e) =>
                    setSecurity({ ...security, sessionTimeout: e.target.value })
                  }
                  className="mt-1 max-w-[200px]"
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">IP Restriction</p>
                  <p className="text-sm text-muted-foreground">
                    Limit access to specific IP addresses
                  </p>
                </div>
                <Switch
                  checked={security.ipRestriction}
                  onCheckedChange={(checked) =>
                    setSecurity({ ...security, ipRestriction: checked })
                  }
                />
              </div>
            </div>
          </div>

          <div className="stat-card">
            <h3 className="font-semibold mb-4">Email Domain Restrictions</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Only emails ending with these domains can access the system
            </p>
            <div className="flex flex-wrap gap-2">
              {['*.ac.tz'].map((domain) => (
                <span
                  key={domain}
                  className="px-3 py-1.5 rounded-lg bg-secondary/10 text-secondary font-mono text-sm"
                >
                  {domain}
                </span>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Email Settings */}
        <TabsContent value="email" className="space-y-6">
          <div className="stat-card">
            <h3 className="font-semibold mb-4">SMTP Configuration</h3>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="smtp-host">SMTP Host</Label>
                  <Input
                    id="smtp-host"
                    placeholder="smtp.example.com"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="smtp-port">SMTP Port</Label>
                  <Input
                    id="smtp-port"
                    type="number"
                    placeholder="587"
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="smtp-user">Username</Label>
                  <Input
                    id="smtp-user"
                    placeholder="noreply@unifind.ac.tz"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="smtp-pass">Password</Label>
                  <Input
                    id="smtp-pass"
                    type="password"
                    placeholder="••••••••"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <h3 className="font-semibold mb-4">Email Templates</h3>
            <p className="text-sm text-muted-foreground">
              Customize email templates for different notifications
            </p>
            <div className="mt-4 space-y-2">
              {[
                'Welcome Email',
                'Match Notification',
                'Verification Confirmation',
                'Item Return Confirmation',
              ].map((template) => (
                <div
                  key={template}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <span className="font-medium">{template}</span>
                  <Button variant="outline" size="sm">
                    Edit
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex justify-end pt-4">
        <Button onClick={handleSave} className="gap-2">
          <Save className="h-4 w-4" />
          Save Changes
        </Button>
      </div>
    </div>
  );
}
