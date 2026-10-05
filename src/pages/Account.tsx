import { LandingLayout } from "@/components/layout/LandingLayout";
import { AccountPreferences } from "@/components/account/AccountPreferences";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  User, 
  Shield, 
  Bell, 
  Smartphone, 
  Key, 
  Globe, 
  CreditCard,
  Camera,
  CheckCircle2,
  Mail,
  Lock
} from "lucide-react";

const Account = () => {
  return (
    <LandingLayout>
      <div className="container mx-auto px-4 py-8 md:py-16 animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-3">
            Account <span className="text-primary">Settings</span>
          </h1>
          <p className="text-muted-foreground">
            Manage your profile and preferences
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <AccountPreferences />
          <Tabs defaultValue="profile" className="space-y-8">
            <TabsList className="bg-muted p-1 rounded-xl">
              <TabsTrigger value="profile" className="gap-2 data-[state=active]:bg-card rounded-lg">
                <User className="w-4 h-4" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="security" className="gap-2 data-[state=active]:bg-card rounded-lg">
                <Shield className="w-4 h-4" />
                Security
              </TabsTrigger>
              <TabsTrigger value="notifications" className="gap-2 data-[state=active]:bg-card rounded-lg">
                <Bell className="w-4 h-4" />
                Notifications
              </TabsTrigger>
              <TabsTrigger value="payment" className="gap-2 data-[state=active]:bg-card rounded-lg">
                <CreditCard className="w-4 h-4" />
                Payment
              </TabsTrigger>
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile" className="space-y-6">
              <Card className="border border-border card-shadow">
                <CardHeader>
                  <CardTitle className="font-display">Profile Information</CardTitle>
                  <CardDescription>Update your personal details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Avatar Section */}
                  <div className="flex items-center gap-6">
                    <div className="relative">
                      <Avatar className="w-24 h-24 border-4 border-primary/30">
                        <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=crypto" />
                        <AvatarFallback className="text-2xl">JD</AvatarFallback>
                      </Avatar>
                      <Button 
                        size="icon" 
                        className="absolute -bottom-2 -right-2 rounded-full w-8 h-8"
                      >
                        <Camera className="w-4 h-4" />
                      </Button>
                    </div>
                    <div>
                      <h3 className="font-semibold">John Doe</h3>
                      <p className="text-sm text-muted-foreground">john.doe@email.com</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="bg-nyati-green-light text-nyati-green border-0">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Verified
                        </Badge>
                        <Badge variant="secondary" className="bg-nyati-purple-light text-nyati-purple border-0">
                          Premium
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Form Fields */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input id="firstName" defaultValue="John" className="bg-muted/50" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input id="lastName" defaultValue="Doe" className="bg-muted/50" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                          id="email" 
                          defaultValue="john.doe@email.com" 
                          className="bg-muted/50 pl-10" 
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <div className="relative">
                        <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                          id="phone" 
                          defaultValue="+254 7XX XXX XXX" 
                          className="bg-muted/50 pl-10" 
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input 
                        id="country" 
                        defaultValue="Kenya" 
                        className="bg-muted/50 pl-10" 
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button className="glow-primary">Save Changes</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security" className="space-y-6">
              <Card className="border border-border card-shadow">
                <CardHeader>
                  <CardTitle className="font-display">Password</CardTitle>
                  <CardDescription>Change your password regularly to keep your account secure</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input 
                        id="currentPassword" 
                        type="password" 
                        className="bg-muted/50 pl-10" 
                      />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input id="newPassword" type="password" className="bg-muted/50" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm Password</Label>
                      <Input id="confirmPassword" type="password" className="bg-muted/50" />
                    </div>
                  </div>
                  <Button variant="outline">Update Password</Button>
                </CardContent>
              </Card>

              <Card className="border border-border card-shadow">
                <CardHeader>
                  <CardTitle className="font-display">Two-Factor Authentication</CardTitle>
                  <CardDescription>Add an extra layer of security to your account</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-nyati-green-light flex items-center justify-center">
                        <Smartphone className="w-6 h-6 text-nyati-green" />
                      </div>
                      <div>
                        <p className="font-medium">Authenticator App</p>
                        <p className="text-sm text-muted-foreground">Google Authenticator or similar</p>
                      </div>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-nyati-blue-light flex items-center justify-center">
                        <Mail className="w-6 h-6 text-nyati-blue" />
                      </div>
                      <div>
                        <p className="font-medium">Email Verification</p>
                        <p className="text-sm text-muted-foreground">Receive codes via email</p>
                      </div>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-nyati-purple-light flex items-center justify-center">
                        <Key className="w-6 h-6 text-nyati-purple" />
                      </div>
                      <div>
                        <p className="font-medium">Security Keys</p>
                        <p className="text-sm text-muted-foreground">Hardware security keys (YubiKey)</p>
                      </div>
                    </div>
                    <Switch />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notifications Tab */}
            <TabsContent value="notifications" className="space-y-6">
              <Card className="border border-border card-shadow">
                <CardHeader>
                  <CardTitle className="font-display">Notification Preferences</CardTitle>
                  <CardDescription>Choose what updates you want to receive</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {[
                    { title: "Transaction Alerts", description: "Get notified for deposits and withdrawals", defaultChecked: true },
                    { title: "Price Alerts", description: "Receive alerts when prices hit your targets", defaultChecked: true },
                    { title: "Security Alerts", description: "Important security-related notifications", defaultChecked: true },
                    { title: "Marketing Updates", description: "News about features and promotions", defaultChecked: false },
                    { title: "Weekly Reports", description: "Weekly summary of your portfolio", defaultChecked: true },
                  ].map((item) => (
                    <div key={item.title} className="flex items-center justify-between py-2">
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                      <Switch defaultChecked={item.defaultChecked} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Payment Tab */}
            <TabsContent value="payment" className="space-y-6">
              <Card className="border border-border card-shadow">
                <CardHeader>
                  <CardTitle className="font-display">Payment Methods</CardTitle>
                  <CardDescription>Manage your linked payment methods</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-primary/30">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-nyati-green-light flex items-center justify-center">
                        <Smartphone className="w-6 h-6 text-nyati-green" />
                      </div>
                      <div>
                        <p className="font-medium">M-Pesa</p>
                        <p className="text-sm text-muted-foreground">+254 7XX XXX XXX</p>
                      </div>
                    </div>
                    <Badge className="bg-nyati-green-light text-nyati-green border-0">Default</Badge>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                        <CreditCard className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">•••• •••• •••• 4532</p>
                        <p className="text-sm text-muted-foreground">Visa • Expires 12/26</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">Remove</Button>
                  </div>

                  <Button variant="outline" className="w-full mt-4">
                    <CreditCard className="w-4 h-4 mr-2" />
                    Add New Payment Method
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </LandingLayout>
  );
};

export default Account;
