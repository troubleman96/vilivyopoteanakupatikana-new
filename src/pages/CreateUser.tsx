
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Save, UserPlus, Shield } from "lucide-react";
import api from "@/lib/api";

export default function CreateUser() {
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        username: "",
        email: "",
        password: "",
        first_name: "",
        last_name: "",
        phone: "",
        role: "",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.username || !formData.email || !formData.password || !formData.role || !formData.first_name || !formData.last_name) {
            toast.error("Please fill in all required fields");
            return;
        }

        if (!formData.email.includes("@")) {
            toast.error("Please enter a valid email address");
            return;
        }

        setIsSubmitting(true);

        try {
            const payload = {
                username: formData.username,
                email: formData.email,
                password: formData.password,
                first_name: formData.first_name,
                last_name: formData.last_name,
                phone: formData.phone || undefined, // Optional
                role: formData.role,
            };


            await api.post("/management/users/", payload);

            toast.success("User created successfully!");
            setTimeout(() => {
                navigate("/users");
            }, 1500);
        } catch (error: any) {

            const errorMsg =
                error.response?.data?.detail ||
                error.response?.data?.message ||
                (typeof error.response?.data === "object" ? JSON.stringify(error.response?.data) : "Failed to create user");
            toast.error(errorMsg);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-fade-in p-4 pb-20">
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate("/users")}
                    className="shrink-0"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-3">
                        <UserPlus className="h-7 w-7 text-primary" />
                        Create New User
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Add a new staff member to the system.
                    </p>
                </div>
            </div>

            <form
                onSubmit={handleSubmit}
                className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-6"
            >
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        Account Details
                    </h2>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="first_name">First Name *</Label>
                            <Input
                                id="first_name"
                                placeholder="e.g. Juma"
                                value={formData.first_name}
                                onChange={(e) =>
                                    setFormData({ ...formData, first_name: e.target.value })
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="last_name">Last Name *</Label>
                            <Input
                                id="last_name"
                                placeholder="e.g. Hamisi"
                                value={formData.last_name}
                                onChange={(e) =>
                                    setFormData({ ...formData, last_name: e.target.value })
                                }
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="username">Username *</Label>
                        <Input
                            id="username"
                            placeholder="e.g. jhamisi"
                            value={formData.username}
                            onChange={(e) =>
                                setFormData({ ...formData, username: e.target.value })
                            }
                        />
                        <p className="text-[10px] text-muted-foreground">Used for login.</p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">Email Address *</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="e.g. staff@udsm.ac.tz"
                            value={formData.email}
                            onChange={(e) =>
                                setFormData({ ...formData, email: e.target.value })
                            }
                        />
                        <p className="text-[10px] text-muted-foreground">
                            Must be an official university email.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">Password *</Label>
                        <Input
                            id="password"
                            type="password"
                            placeholder="Set initial password"
                            value={formData.password}
                            onChange={(e) =>
                                setFormData({ ...formData, password: e.target.value })
                            }
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input
                            id="phone"
                            type="tel"
                            placeholder="e.g. +255..."
                            value={formData.phone}
                            onChange={(e) =>
                                setFormData({ ...formData, phone: e.target.value })
                            }
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="role">Role *</Label>
                        <Select
                            value={formData.role}
                            onValueChange={(value) =>
                                setFormData({ ...formData, role: value })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="university_admin">
                                    University Admin
                                </SelectItem>
                                <SelectItem value="security_officer">
                                    Security Officer
                                </SelectItem>
                                {/* Potentially add 'user' if needed, but usually self-registered */}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="flex justify-end pt-4 border-t">
                    <Button type="button" variant="outline" onClick={() => navigate("/users")} className="mr-2">
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting} className="gap-2">
                        {isSubmitting ? (
                            "Creating..."
                        ) : (
                            <>
                                <Save className="h-4 w-4" />
                                Create User
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </div>
    );
}
