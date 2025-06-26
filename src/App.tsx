import { SettingsForm } from "@/components/SettingsForm";
import { Toaster } from "@/components/ui/sonner";

function App() {
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-md mx-auto">
        <SettingsForm />
      </div>
      <Toaster />
    </div>
  );
}

export default App;
