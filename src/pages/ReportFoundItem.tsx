
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
    Package,
    ArrowRight,
    MapPin,
    Lock,
    ShieldCheck,
    AlertCircle,
    Save,
    ArrowLeft
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

const categories = [
    { value: "simu", label: "Simu" },
    { value: "mkoba", label: "Mkoba" },
    { value: "wallet", label: "Wallet / Pochi" },
    { value: "nyaraka", label: "Nyaraka" },
    { value: "funguo", label: "Funguo" },
    { value: "nguo", label: "Nguo" },
    { value: "vifaa", label: "Vifaa vya Elektroniki" },
    { value: "mengine", label: "Mengine" },
];

const universityLocations = [
    { value: "classroom", label: "Darasa / Classroom" },
    { value: "library", label: "Maktaba / Library" },
    { value: "hostel", label: "Hostel" },
    { value: "cafeteria", label: "Cafeteria / Mkahawa" },
    { value: "lab", label: "Lab" },
    { value: "field", label: "Uwanja / Sports Ground" },
    { value: "parking", label: "Parking" },
    { value: "gate", label: "Gate / Mlango" },
    { value: "admin", label: "Admin Block / Ofisi" },
    { value: "other-loc", label: "Mahali Pengine" },
];

export default function ReportFoundItem() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [step, setStep] = useState<1 | 2>(1);

    // Form data
    const [formData, setFormData] = useState({
        title: "",
        category: "",
        university_location: "",
        specific_location: "",
        description: "",
        verification_details: "", // Hidden question/answer
        date_found: new Date().toISOString().split("T")[0],
    });

    const handleNext = () => {
        // Validation for Step 1
        if (!formData.category) {
            toast.error("Please select a category");
            return;
        }
        if (!formData.description) {
            toast.error("Please provide a description");
            return;
        }
        if (!formData.date_found) {
            toast.error("Please select the date found");
            return;
        }
        setStep(2);
        window.scrollTo(0, 0);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.verification_details) {
            toast.error("Please provide verification details to secure the item");
            return;
        }

        setIsSubmitting(true);

        try {
            const reportData = {
                title: formData.title,
                venue: "university", // Hardcoded as per instructions
                category: formData.category,
                university_location: formData.university_location,
                specific_location: formData.specific_location,
                description: formData.description,
                verification_details: formData.verification_details,
                date_found: formData.date_found,
                university: user?.university || user?.universityId,
            };

            console.log("Submitting Found Item:", reportData);

            await api.post('/items/report-found/', reportData);

            toast.success("Item reported successfully!");
            setTimeout(() => {
                navigate("/found-items");
            }, 1500);

        } catch (error: any) {
            console.error("Submission error:", error);
            const errorMsg = error.response?.data?.detail || error.response?.data?.message || "Failed to submit report";
            toast.error(errorMsg);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6 animate-fade-in p-4 pb-20">
            {/* Top Navigation */}
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate('/found-items')}
                    className="shrink-0"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-3">
                        <Package className="h-7 w-7 text-secondary" />
                        Report Found Item
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Step {step} of 2: {step === 1 ? 'Item Details' : 'Security Verification'}
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="bg-card p-6 rounded-xl border border-border shadow-sm">

                {step === 1 && (
                    <div className="space-y-8 animate-in slide-in-from-right-4 fade-in duration-300">
                        {/* Basic Info Section */}
                        <div className="space-y-6">
                            <h2 className="text-lg font-semibold border-b pb-2">Basic Information</h2>

                            <div className="grid gap-6 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="title">Item Name (Optional)</Label>
                                    <Input
                                        id="title"
                                        placeholder="e.g. Blue Backpack, iPhone 13"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="category">Category *</Label>
                                    <Select
                                        value={formData.category}
                                        onValueChange={(value) => setFormData({ ...formData, category: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {categories.map((cat) => (
                                                <SelectItem key={cat.value} value={cat.value}>
                                                    {cat.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        {/* Location Section */}
                        <div className="space-y-6">
                            <h2 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
                                <MapPin className="h-5 w-5" />
                                Location Details
                            </h2>

                            <div className="grid gap-6 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>University Location</Label>
                                    <Select
                                        value={formData.university_location}
                                        onValueChange={(value) => setFormData({ ...formData, university_location: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select location" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {universityLocations.map((loc) => (
                                                <SelectItem key={loc.value} value={loc.value}>
                                                    {loc.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="specific_location">Specific Place</Label>
                                    <Input
                                        id="specific_location"
                                        placeholder="e.g. Room 101, Near Main Gate"
                                        value={formData.specific_location}
                                        onChange={(e) => setFormData({ ...formData, specific_location: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Description & Date Section */}
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="description">Description *</Label>
                                <Textarea
                                    id="description"
                                    placeholder="Describe the item (color, brand, distinguishing marks)..."
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="min-h-[100px]"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="date">Date Found *</Label>
                                <Input
                                    type="date"
                                    id="date"
                                    value={formData.date_found}
                                    onChange={(e) => setFormData({ ...formData, date_found: e.target.value })}
                                    max={new Date().toISOString().split("T")[0]}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button type="button" onClick={handleNext} className="gap-2">
                                Next Step
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-8 animate-in slide-in-from-right-4 fade-in duration-300">
                        {/* Verification / Security Section */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 text-primary border-b pb-2">
                                <ShieldCheck className="h-6 w-6" />
                                <h2 className="text-xl font-semibold">Verification Details (Private)</h2>
                            </div>

                            <div className="bg-muted/30 p-6 rounded-xl border border-border/50 space-y-4">
                                <div className="flex items-start gap-3 text-sm text-muted-foreground p-3 bg-background rounded-lg border">
                                    <Lock className="h-5 w-5 mt-0.5 shrink-0 text-primary" />
                                    <p>
                                        These details are <strong>hidden from public view</strong>. They are used to verify the owner when they come to claim the item.
                                        Only you and the owner (upon successful verification) will know this.
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    <Label htmlFor="verification_details" className="text-base font-medium">
                                        Hidden Question / Secret Detail *
                                    </Label>
                                    <Textarea
                                        id="verification_details"
                                        placeholder="e.g. What is the wallpaper image? (Answer: A cat), or What is inside the side pocket? (Answer: A red pen)"
                                        value={formData.verification_details}
                                        onChange={(e) => setFormData({ ...formData, verification_details: e.target.value })}
                                        className="min-h-[150px] text-base border-primary/20 focus-visible:ring-primary/20"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Ask a question that only the owner would know, or describe a hidden feature.
                                    </p>
                                </div>

                                <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm font-medium">
                                    <AlertCircle className="h-4 w-4" />
                                    <span>Do not include sensitive info like PINs or passwords.</span>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-4 pt-4 border-t">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setStep(1)}
                                className="flex-1 gap-2"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back to Details
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex-1 gap-2"
                            >
                                {isSubmitting ? (
                                    <>Saving...</>
                                ) : (
                                    <>
                                        <Save className="h-4 w-4" />
                                        Submit Report
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </form>
        </div>
    );
}
