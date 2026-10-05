import { LandingLayout } from "@/components/layout/LandingLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle2, 
  Upload, 
  User, 
  FileText, 
  Camera,
  Shield,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const verificationSteps = [
  { 
    id: 1, 
    title: "Personal Information", 
    description: "Basic details about you",
    icon: User,
    status: "completed" as const
  },
  { 
    id: 2, 
    title: "Identity Document", 
    description: "Upload government-issued ID",
    icon: FileText,
    status: "current" as const
  },
  { 
    id: 3, 
    title: "Face Verification", 
    description: "Take a selfie for verification",
    icon: Camera,
    status: "pending" as const
  },
];

const KYC = () => {
  const [dragActive, setDragActive] = useState(false);
  const completedSteps = verificationSteps.filter(s => s.status === "completed").length;
  const progress = (completedSteps / verificationSteps.length) * 100;

  return (
    <LandingLayout>
      <div className="container mx-auto px-4 py-8 md:py-16 animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-3">
            Identity <span className="text-primary">Verification</span>
          </h1>
          <p className="text-muted-foreground">
            Complete KYC to unlock full features
          </p>
        </div>

        <div className="max-w-4xl mx-auto space-y-8">
          {/* Progress Overview */}
          <Card className="border border-border card-shadow overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-nyati-green/5" />
            <CardContent className="p-6 relative">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-display font-bold text-xl">Verification Progress</h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    {completedSteps} of {verificationSteps.length} steps completed
                  </p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-nyati-green-light rounded-full">
                  <Shield className="w-5 h-5 text-nyati-green" />
                  <span className="text-nyati-green font-medium">Tier 1 Verified</span>
                </div>
              </div>
              <Progress value={progress} className="h-2 bg-muted" />
            </CardContent>
          </Card>

          {/* Steps */}
          <div className="grid gap-6">
            {verificationSteps.map((step) => {
              const Icon = step.icon;
              const isCompleted = step.status === "completed";
              const isCurrent = step.status === "current";
              
              return (
                <Card 
                  key={step.id} 
                  className={cn(
                    "border border-border card-shadow transition-all duration-300",
                    isCurrent && "border-primary/50",
                    isCompleted && "opacity-80"
                  )}
                >
                  <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center",
                      isCompleted ? "bg-nyati-green-light" : isCurrent ? "bg-nyati-amber-light" : "bg-muted"
                    )}>
                      {isCompleted ? (
                        <CheckCircle2 className="w-6 h-6 text-nyati-green" />
                      ) : (
                        <Icon className={cn(
                          "w-6 h-6",
                          isCurrent ? "text-primary" : "text-muted-foreground"
                        )} />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <CardTitle className="font-display text-lg">{step.title}</CardTitle>
                        {isCompleted && (
                          <span className="text-xs font-medium text-nyati-green bg-nyati-green-light px-2 py-1 rounded-full">
                            Completed
                          </span>
                        )}
                        {isCurrent && (
                          <span className="text-xs font-medium text-primary bg-nyati-amber-light px-2 py-1 rounded-full">
                            In Progress
                          </span>
                        )}
                      </div>
                      <CardDescription className="mt-1">{step.description}</CardDescription>
                    </div>
                  </CardHeader>
                  
                  {isCurrent && (
                    <CardContent className="pt-0">
                      <div className="border-t border-border pt-6 space-y-6">
                        {/* Document Type Selection */}
                        <div className="grid grid-cols-3 gap-4">
                          {["Passport", "Driver's License", "National ID"].map((doc) => (
                            <Button
                              key={doc}
                              variant="outline"
                              className="h-auto py-4 flex flex-col gap-2 hover:border-primary hover:bg-primary/5"
                            >
                              <FileText className="w-6 h-6" />
                              <span className="text-sm">{doc}</span>
                            </Button>
                          ))}
                        </div>

                        {/* Upload Area */}
                        <div
                          className={cn(
                            "border-2 border-dashed rounded-xl p-8 text-center transition-colors",
                            dragActive 
                              ? "border-primary bg-primary/5" 
                              : "border-border hover:border-muted-foreground"
                          )}
                          onDragEnter={() => setDragActive(true)}
                          onDragLeave={() => setDragActive(false)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => setDragActive(false)}
                        >
                          <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-4" />
                          <p className="font-medium mb-2">
                            Drag & drop your document here
                          </p>
                          <p className="text-muted-foreground text-sm mb-4">
                            or click to browse from your device
                          </p>
                          <Button variant="outline">
                            Choose File
                          </Button>
                          <p className="text-xs text-muted-foreground mt-4">
                            Supported formats: JPG, PNG, PDF (max 10MB)
                          </p>
                        </div>

                        {/* Info Box */}
                        <div className="flex items-start gap-3 p-4 bg-nyati-blue-light rounded-xl">
                          <AlertCircle className="w-5 h-5 text-nyati-blue shrink-0 mt-0.5" />
                          <div className="text-sm">
                            <p className="font-medium">Tips for a successful verification:</p>
                            <ul className="text-muted-foreground mt-2 space-y-1">
                              <li>• Ensure all corners of the document are visible</li>
                              <li>• Make sure the text is clearly readable</li>
                              <li>• Avoid glare and shadows on the document</li>
                            </ul>
                          </div>
                        </div>

                        <Button className="w-full glow-primary" size="lg">
                          Continue to Next Step
                        </Button>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Benefits */}
          <Card className="border border-border card-shadow">
            <CardHeader>
              <CardTitle className="font-display">Verification Benefits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                {[
                  { title: "Higher Limits", description: "Up to $100,000 daily transactions" },
                  { title: "All Features", description: "Access to advanced trading options" },
                  { title: "Priority Support", description: "24/7 dedicated customer service" },
                ].map((benefit) => (
                  <div key={benefit.title} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-nyati-green shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">{benefit.title}</p>
                      <p className="text-sm text-muted-foreground">{benefit.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </LandingLayout>
  );
};

export default KYC;
