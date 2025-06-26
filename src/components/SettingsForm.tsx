import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { ExtensionStorage, type ExtensionSettings } from "@/lib/storage";
import { toast } from "sonner";
import { Settings, Zap, Save, RotateCcw, AlertTriangle } from "lucide-react";

export function SettingsForm() {
  const [settings, setSettings] = useState<ExtensionSettings>({
    rpcUrl: "",
  });
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const loadedSettings = await ExtensionStorage.getSettings();
      setSettings(loadedSettings);
    } catch (error) {
      toast.error("Failed to load settings");
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await ExtensionStorage.saveSettings(settings);
      toast.success("Settings saved successfully");
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    try {
      await ExtensionStorage.clearSettings();
      setSettings({ rpcUrl: "" });
      toast.success("Settings reset successfully");
      setIsDrawerOpen(false);
    } catch (error) {
      toast.error("Failed to reset settings");
    }
  };

  const isValidUrl = (url: string) => {
    if (!url) return true;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const canSave = settings.rpcUrl.trim() !== "" && isValidUrl(settings.rpcUrl);

  if (initialLoading) {
    return (
      <Card className="w-full h-full">
        <CardContent className="flex items-center justify-center py-8">
          <div className="flex items-center space-x-2 text-muted-foreground">
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
            <span>Loading settings...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full h-full">
      <CardHeader className="space-y-2">
        <div className="flex items-center space-x-2">
          <Settings className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">LANCER Settings</CardTitle>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="rpcUrl" className="flex items-center space-x-2">
            <Zap className="h-4 w-4 text-primary" />
            <span>RPC URL</span>
            <span className="text-destructive">*</span>
          </Label>
          <Input
            id="rpcUrl"
            type="url"
            placeholder="https://api.mainnet-beta.solana.com"
            value={settings.rpcUrl}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, rpcUrl: e.target.value }))
            }
            className={!isValidUrl(settings.rpcUrl) ? "border-destructive" : ""}
          />
          {!isValidUrl(settings.rpcUrl) && (
            <p className="text-sm text-destructive">Please enter a valid URL</p>
          )}
          <p className="text-xs text-muted-foreground">
            Solana RPC endpoint for fetching position data.
          </p>
        </div>
        <Separator />

        <div className="flex space-x-2">
          <Button
            onClick={handleSave}
            disabled={!canSave || loading}
            className="flex-1"
          >
            <Save className="h-4 w-4 mr-2" />
            {loading ? "Saving..." : "Save Settings"}
          </Button>

          <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <DrawerTrigger asChild>
              <Button variant="outline" disabled={loading}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle className="flex items-center gap-2 justify-center w-full">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <span className="text-xl">Reset Settings</span>
                </DrawerTitle>
                <DrawerDescription>
                  Are you sure you want to reset all settings? This will clear
                  your RPC URL and you'll need to configure it again.
                </DrawerDescription>
              </DrawerHeader>
              <DrawerFooter className="flex justify-between gap-4">
                <Button
                  variant="destructive"
                  onClick={handleReset}
                  disabled={loading}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset Settings
                </Button>
                <DrawerClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        </div>

        <div className="text-xs text-muted-foreground text-center">
          <br />
          Lancer will only use read-only RPC endpoints. We do not share/upload
          any data to our servers. Everything Lancer sees stays on your device.
          <br />
          You can read more about Lancer{" "}
          <a
            href="https://metf.in/lancer"
            target="_blank"
            rel="noopener noreferrer"
          >
            here
          </a>
          .
        </div>
      </CardContent>
    </Card>
  );
}
