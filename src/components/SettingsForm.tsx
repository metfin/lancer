import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
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
import {
  Settings,
  Zap,
  Save,
  RotateCcw,
  AlertTriangle,
  Database,
  Copy,
  Trash2,
  Wallet,
} from "lucide-react";

export function SettingsForm() {
  const [settings, setSettings] = useState<ExtensionSettings>({
    rpcUrl: "",
    dammPoolAddresses: [],
    walletAddress: "",
  });
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isClearPoolsDrawerOpen, setIsClearPoolsDrawerOpen] = useState(false);

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
      setSettings({ rpcUrl: "", dammPoolAddresses: [], walletAddress: "" });
      toast.success("Settings reset successfully");
      setIsDrawerOpen(false);
    } catch (error) {
      toast.error("Failed to reset settings");
    }
  };

  const handleClearPools = async () => {
    try {
      await ExtensionStorage.clearPoolAddresses();
      setSettings((prev) => ({ ...prev, dammPoolAddresses: [] }));
      toast.success("Pool addresses cleared successfully");
      setIsClearPoolsDrawerOpen(false);
    } catch (error) {
      toast.error("Failed to clear pool addresses");
    }
  };

  const copyPoolAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      toast.success("Address copied to clipboard");
    } catch (error) {
      toast.error("Failed to copy address");
    }
  };

  const copyWalletAddress = async () => {
    if (settings.walletAddress.trim()) {
      try {
        await navigator.clipboard.writeText(settings.walletAddress);
        toast.success("Wallet address copied to clipboard");
      } catch (error) {
        toast.error("Failed to copy wallet address");
      }
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

  const isValidSolanaAddress = (address: string) => {
    if (!address) return true;
    // Solana addresses are base58 encoded and 32-44 characters long
    // They use the base58 alphabet: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    return base58Regex.test(address);
  };

  const canSave =
    settings.rpcUrl.trim() !== "" &&
    isValidUrl(settings.rpcUrl) &&
    settings.walletAddress.trim() !== "" &&
    isValidSolanaAddress(settings.walletAddress);

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

        <div className="space-y-2">
          <Label
            htmlFor="walletAddress"
            className="flex items-center space-x-2"
          >
            <Wallet className="h-4 w-4 text-primary" />
            <span>Wallet Address</span>
            <span className="text-destructive">*</span>
          </Label>
          <div className="flex space-x-2">
            <Input
              id="walletAddress"
              type="text"
              placeholder="Your Solana wallet address (e.g., 11111111111111111111111111111112)"
              value={settings.walletAddress}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  walletAddress: e.target.value,
                }))
              }
              className={
                !isValidSolanaAddress(settings.walletAddress)
                  ? "border-destructive"
                  : ""
              }
            />
            <Button
              variant="outline"
              size="sm"
              onClick={copyWalletAddress}
              disabled={!settings.walletAddress.trim()}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          {!isValidSolanaAddress(settings.walletAddress) &&
            settings.walletAddress.trim() !== "" && (
              <p className="text-sm text-destructive">
                Please enter a valid Solana address (32-44 base58 characters)
              </p>
            )}
          <p className="text-xs text-muted-foreground">
            Your Solana wallet address to track DAMM positions for.
          </p>
        </div>

        {/* Tracked Pool Addresses Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center space-x-2">
              <Database className="h-4 w-4 text-primary" />
              <span>Tracked DAMM Pools</span>
              <Badge variant="secondary" className="ml-2">
                {settings.dammPoolAddresses.length}
              </Badge>
            </Label>
            {settings.dammPoolAddresses.length > 0 && (
              <Drawer
                open={isClearPoolsDrawerOpen}
                onOpenChange={setIsClearPoolsDrawerOpen}
              >
                <DrawerTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Trash2 className="h-3 w-3 mr-1" />
                    Clear All
                  </Button>
                </DrawerTrigger>
                <DrawerContent>
                  <DrawerHeader>
                    <DrawerTitle className="flex items-center gap-2 justify-center w-full">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      <span className="text-xl">Clear Pool Addresses</span>
                    </DrawerTitle>
                    <DrawerDescription>
                      Are you sure you want to clear all tracked DAMM pool
                      addresses? This will remove{" "}
                      {settings.dammPoolAddresses.length} pool
                      {settings.dammPoolAddresses.length !== 1 ? "s" : ""} from
                      tracking.
                    </DrawerDescription>
                  </DrawerHeader>
                  <DrawerFooter className="flex justify-between gap-4">
                    <Button
                      variant="destructive"
                      onClick={handleClearPools}
                      disabled={loading}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear All Pools
                    </Button>
                    <DrawerClose asChild>
                      <Button variant="outline">Cancel</Button>
                    </DrawerClose>
                  </DrawerFooter>
                </DrawerContent>
              </Drawer>
            )}
          </div>

          {settings.dammPoolAddresses.length === 0 ? (
            <div className="text-sm text-muted-foreground p-4 border rounded-lg text-center">
              No DAMM pools tracked yet. Visit the DAMM V2 tab on Meteora's
              portfolio page to automatically detect your positions.
            </div>
          ) : (
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {settings.dammPoolAddresses.map((address, index) => (
                <div
                  key={address}
                  className="flex items-center justify-between p-2 border rounded-lg bg-muted/50"
                >
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      #{index + 1}
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground truncate max-w-[200px]">
                      {address}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyPoolAddress(address)}
                    className="h-6 w-6 p-0"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Pool addresses are automatically detected when you visit the DAMM V2
            positions page.
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
                  your RPC URL, wallet address, and all tracked pool addresses.
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
            className="text-primary underline"
          >
            here
          </a>
          .
        </div>
      </CardContent>
    </Card>
  );
}
