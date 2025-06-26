import { SettingsForm } from "@/components/SettingsForm";
import { Toaster } from "@/components/ui/sonner";

function App() {
  return (
    <div className="min-h-screen bg-background p-4 flex flex-col items-center justify-center h-full">
      <div className="max-w-md mx-auto w-full h-full">
        <SettingsForm />
      </div>
      <Toaster />
    </div>
  );
}

export default App;
