import { Connection, PublicKey } from "@solana/web3.js";
import { CpAmm, type PositionState } from "@meteora-ag/cp-amm-sdk";
import { ExtensionStorage } from "./lib/storage";
import { BN } from "@coral-xyz/anchor";

// Data structures for PnL tracking
interface TokenInfo {
  mint: string;
  symbol: string;
  decimals: number;
}

interface PositionPnLData {
  poolAddress: string;
  positionAddress?: string;
  tokenA: TokenInfo;
  tokenB: TokenInfo;

  // Current position data
  currentTokenAAmount: number;
  currentTokenBAmount: number;
  currentFeeAAmount: number;
  currentFeeBAmount: number;
  currentTokenAPrice: number;
  currentTokenBPrice: number;
  currentTotalValueUSD: number;

  // Initial position data (cached to avoid re-fetching)
  initialTokenAAmount: number;
  initialTokenBAmount: number;
  initialTokenAPrice: number;
  initialTokenBPrice: number;
  initialTotalValueUSD: number;
  createdAt: Date;

  // Calculated PnL
  pnlUSD: number;
  pnlPercentage: number;
  feesEarnedUSD: number;

  // Metadata
  lastUpdated: Date;
  isStale: boolean;
}

interface OverallPnLData {
  totalCurrentValueUSD: number;
  totalInitialValueUSD: number;
  totalPnLUSD: number;
  totalPnLPercentage: number;
  totalFeesEarnedUSD: number;
  lastUpdated: Date;
  positions: PositionPnLData[];
}

export class LancerBackend {
  private static instance: LancerBackend;
  private cpAmm: CpAmm | null = null;
  private connection: Connection | null = null;
  private rpcUrl: string | null = null;
  private userPositions: Map<string, PositionState> = new Map();

  // PnL tracking
  private positionPnLData: Map<string, PositionPnLData> = new Map();
  private overallPnL: OverallPnLData | null = null;
  private updateInterval: NodeJS.Timeout | null = null;
  private isUpdating: boolean = false;

  // Update frequency (in milliseconds)
  private static readonly UPDATE_INTERVAL = 30000; // 30 seconds
  private static readonly STALE_THRESHOLD = 300000; // 5 minutes

  private constructor() {}

  static getInstance(): LancerBackend {
    if (!LancerBackend.instance) {
      LancerBackend.instance = new LancerBackend();
    }
    return LancerBackend.instance;
  }

  /**
   * Initialize the CP AMM SDK with the user's configured RPC
   * This should be called when the user visits v2.meteora.ag
   */
  async initialize(): Promise<boolean> {
    try {
      // Get the user's configured RPC URL from storage
      const settings = await ExtensionStorage.getSettings();

      if (!settings.rpcUrl || settings.rpcUrl.trim() === "") {
        console.log(
          "Lancer Backend: No RPC URL provided - bot won't work. Please configure an RPC URL in the extension settings."
        );
        return false;
      }

      // Validate RPC URL format
      try {
        new URL(settings.rpcUrl);
      } catch (urlError) {
        console.error(
          "Lancer Backend: Invalid RPC URL format:",
          settings.rpcUrl
        );
        return false;
      }

      // Don't use mainnet RPC - this should be a custom RPC
      if (settings.rpcUrl.includes("api.mainnet-beta.solana.com")) {
        console.warn(
          "Lancer Backend: Mainnet RPC detected. Please use a custom RPC endpoint for better performance."
        );
        return false;
      }

      this.rpcUrl = settings.rpcUrl;

      // Create connection with the user's RPC
      this.connection = new Connection(this.rpcUrl, {
        commitment: "confirmed",
        wsEndpoint: this.rpcUrl
          .replace("https://", "wss://")
          .replace("http://", "ws://"),
      });

      // Test the connection
      await this.testConnection();

      // Initialize CP AMM SDK
      this.cpAmm = new CpAmm(this.connection);

      console.log(
        "Lancer Backend: CP AMM SDK initialized successfully with RPC:",
        this.rpcUrl
      );
      return true;
    } catch (error) {
      console.error("Lancer Backend: Failed to initialize CP AMM SDK:", error);
      this.cpAmm = null;
      this.connection = null;
      this.rpcUrl = null;
      return false;
    }
  }

  /**
   * Test the RPC connection to ensure it's working
   */
  private async testConnection(): Promise<void> {
    if (!this.connection) {
      throw new Error("No connection available");
    }

    try {
      // Test with a simple getSlot call
      const slot = await this.connection.getSlot();
      console.log(
        "Lancer Backend: RPC connection test successful. Current slot:",
        slot
      );
    } catch (error) {
      throw new Error(`RPC connection test failed: ${error}`);
    }
  }

  /**
   * Get the initialized CP AMM instance
   */
  getCpAmm(): CpAmm | null {
    return this.cpAmm;
  }

  /**
   * Get the connection instance
   */
  getConnection(): Connection | null {
    return this.connection;
  }

  /**
   * Get the current RPC URL
   */
  getRpcUrl(): string | null {
    return this.rpcUrl;
  }

  /**
   * Check if the backend is properly initialized
   */
  isInitialized(): boolean {
    return this.cpAmm !== null && this.connection !== null;
  }

  /**
   * Reinitialize the backend when RPC settings change
   */
  async reinitialize(): Promise<boolean> {
    // Clean up existing instances
    this.cpAmm = null;
    this.connection = null;
    this.rpcUrl = null;
    this.clearPnLCache();
    this.stopPnLUpdates();

    // Initialize again
    const success = await this.initialize();

    if (success) {
      // Start PnL updates after successful initialization
      this.startPnLUpdates();
    }

    return success;
  }

  async getPositionInfoFromPool(poolAddress: string): Promise<PositionState> {
    //find the key of the position in the userPositions map that has its pool as the poolAddress
    const positionAddr = Array.from(this.userPositions.keys()).find((key) =>
      this.userPositions.get(key)?.pool.toString().includes(poolAddress)
    );

    if (!positionAddr) {
      throw new Error("Position not found");
    }

    const position = this.userPositions.get(positionAddr);

    if (!position) {
      throw new Error("Position not found");
    }

    const pool = await this.cpAmm?.fetchPoolState(position.pool);
    if (!pool) {
      throw new Error("Pool not found");
    }

    const positionInfo = await this.cpAmm?.fetchPositionState(position.pool);

    if (!positionInfo) {
      throw new Error("Position info not found");
    }
    return positionInfo;
  }

  /**
   * Fetch historical price from Mobula API for a specific token at a given date
   * @param tokenAddress - Token mint address
   * @param date - Date to get price for
   * @returns Price in USD or 0 if not found
   */
  private async getMobulaHistoricalPrice(
    tokenAddress: string,
    date: Date
  ): Promise<number> {
    try {
      // Convert date to timestamp (Mobula expects timestamps in milliseconds)
      const timestamp = date.getTime();

      // Add some buffer around the target time to get price data
      const fromTimestamp = timestamp - 60 * 60 * 1000; // 1 hour before
      const toTimestamp = timestamp + 60 * 60 * 1000; // 1 hour after

      const url = new URL("https://api.mobula.io/api/1/market/history");
      url.searchParams.append("blockchain", "solana");
      url.searchParams.append("asset", tokenAddress);
      url.searchParams.append("from", fromTimestamp.toString());
      url.searchParams.append("to", toTimestamp.toString());

      const response = await fetch(url.toString());

      if (!response.ok) {
        console.warn(
          `Mobula API failed for token ${tokenAddress}:`,
          response.status
        );
        return 0;
      }

      const data = await response.json();

      if (!data.data?.price_history || data.data.price_history.length === 0) {
        console.warn(`No price history found for token ${tokenAddress}`);
        return 0;
      }

      // Find the price closest to our target timestamp
      const priceHistory = data.data.price_history as [number, number][];
      let closestPrice = 0;
      let smallestTimeDiff = Infinity;

      for (const [priceTimestamp, price] of priceHistory) {
        const timeDiff = Math.abs(priceTimestamp - timestamp);
        if (timeDiff < smallestTimeDiff) {
          smallestTimeDiff = timeDiff;
          closestPrice = price;
        }
      }

      return closestPrice;
    } catch (error) {
      console.error(
        `Error fetching Mobula price for token ${tokenAddress}:`,
        error
      );
      return 0;
    }
  }

  /**
   * Fetches the creation transaction for a position to get initial deposit amounts
   * @param connection - Solana connection
   * @param positionAddress - Position public key
   * @returns Initial deposit data or null if not found
   */
  async getPositionCreationData(positionAddress: PublicKey): Promise<{
    initialTokenAAmount: number;
    initialTokenBAmount: number;
    initialTokenAPriceUSD: number;
    initialTokenBPriceUSD: number;
    createdAt: Date;
  } | null> {
    try {
      if (!this.connection) {
        throw new Error("No connection available");
      }

      // Get transaction signatures for this position
      const signatures = await this.connection.getSignaturesForAddress(
        positionAddress,
        {
          limit: 50,
        }
      );

      if (signatures.length === 0) return null;

      // The last signature should be the creation transaction
      const creationSignature = signatures[signatures.length - 1];

      // Get the full transaction details
      const transaction = await this.connection.getTransaction(
        creationSignature.signature,
        {
          commitment: "confirmed",
          maxSupportedTransactionVersion: 0,
        }
      );

      if (!transaction || !transaction.meta) return null;

      // Parse the transaction to extract initial deposit amounts
      // We'll analyze the token balance changes to determine deposit amounts
      const preBalances = transaction.meta.preTokenBalances || [];
      const postBalances = transaction.meta.postTokenBalances || [];

      // Find the token account changes to determine deposit amounts
      let initialTokenAAmount = 0;
      let initialTokenBAmount = 0;
      const tokenMints: string[] = [];

      // Collect all unique token mints involved in the transaction
      const uniqueMints = new Set<string>();
      [...preBalances, ...postBalances].forEach((balance) => {
        if (balance.mint) uniqueMints.add(balance.mint);
      });

      // For each token mint, calculate the net change
      for (const mint of uniqueMints) {
        let netChange = 0;

        // Sum all post balances for this mint
        const postSum = postBalances
          .filter((balance) => balance.mint === mint)
          .reduce(
            (sum, balance) => sum + (balance.uiTokenAmount?.uiAmount || 0),
            0
          );

        // Sum all pre balances for this mint
        const preSum = preBalances
          .filter((balance) => balance.mint === mint)
          .reduce(
            (sum, balance) => sum + (balance.uiTokenAmount?.uiAmount || 0),
            0
          );

        netChange = postSum - preSum;

        // If there's a positive net change, this represents a deposit
        if (netChange > 0) {
          if (initialTokenAAmount === 0) {
            initialTokenAAmount = netChange;
            tokenMints.push(mint);
          } else if (initialTokenBAmount === 0) {
            initialTokenBAmount = netChange;
            tokenMints.push(mint);
          }
        }
      }

      // Get historical prices for the creation date
      const createdAt = new Date((transaction.blockTime || 0) * 1000);

      // Fetch historical prices from Mobula API
      let initialTokenAPriceUSD = 0;
      let initialTokenBPriceUSD = 0;

      if (tokenMints.length >= 1) {
        initialTokenAPriceUSD = await this.getMobulaHistoricalPrice(
          tokenMints[0],
          createdAt
        );
      }

      if (tokenMints.length >= 2) {
        initialTokenBPriceUSD = await this.getMobulaHistoricalPrice(
          tokenMints[1],
          createdAt
        );
      }

      return {
        initialTokenAAmount,
        initialTokenBAmount,
        initialTokenAPriceUSD,
        initialTokenBPriceUSD,
        createdAt,
      };
    } catch (error) {
      console.error("Error fetching position creation data:", error);
      return null;
    }
  }

  /**
   * Get health status of the backend
   */
  async getHealthStatus(): Promise<{
    initialized: boolean;
    rpcUrl: string | null;
    connectionHealth: "healthy" | "unhealthy" | "unknown";
    lastSlot?: number;
  }> {
    const status: {
      initialized: boolean;
      rpcUrl: string | null;
      connectionHealth: "healthy" | "unhealthy" | "unknown";
      lastSlot?: number;
    } = {
      initialized: this.isInitialized(),
      rpcUrl: this.rpcUrl,
      connectionHealth: "unknown",
      lastSlot: undefined,
    };

    if (this.connection) {
      try {
        const slot = await this.connection.getSlot();
        status.connectionHealth = "healthy";
        status.lastSlot = slot;
      } catch (error) {
        console.error("Lancer Backend: Health check failed:", error);
        status.connectionHealth = "unhealthy";
      }
    }

    return status;
  }

  /**
   * Start automatic PnL updates
   */
  startPnLUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(async () => {
      await this.updateAllPositionsPnL();
    }, LancerBackend.UPDATE_INTERVAL);

    console.log("Lancer Backend: Started automatic PnL updates");
  }

  /**
   * Stop automatic PnL updates
   */
  stopPnLUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    console.log("Lancer Backend: Stopped automatic PnL updates");
  }

  /**
   * Update PnL data for all tracked positions
   */
  async updateAllPositionsPnL(): Promise<void> {
    if (this.isUpdating || !this.isInitialized()) {
      return;
    }

    this.isUpdating = true;
    console.log("Lancer Backend: Starting PnL update cycle");

    try {
      // Get pool addresses from storage
      const poolAddresses = await ExtensionStorage.getPoolAddresses();

      if (poolAddresses.length === 0) {
        console.log("Lancer Backend: No pool addresses to track");
        return;
      }

      // Update each position
      const updatePromises = poolAddresses.map((poolAddress) =>
        this.updatePositionPnL(poolAddress).catch((error) => {
          console.error(`Failed to update PnL for pool ${poolAddress}:`, error);
          return null;
        })
      );

      await Promise.all(updatePromises);

      // Calculate overall PnL
      this.calculateOverallPnL();

      console.log("Lancer Backend: PnL update cycle completed");
    } catch (error) {
      console.error("Lancer Backend: Error during PnL update cycle:", error);
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Update PnL data for a specific position by pool address
   */
  async updatePositionPnL(
    poolAddress: string
  ): Promise<PositionPnLData | null> {
    try {
      if (!this.cpAmm || !this.connection) {
        throw new Error("Backend not initialized");
      }

      // Fetch pool state
      const poolPublicKey = new PublicKey(poolAddress);
      const poolState = await this.cpAmm.fetchPoolState(poolPublicKey);

      if (!poolState) {
        throw new Error("Pool state not found");
      }

      // Find position in our cache
      let positionPublicKey: PublicKey | null = null;
      let positionState: PositionState | null = null;

      // Try to find the position in our cache first
      for (const [posKey, posState] of this.userPositions.entries()) {
        if (posState.pool.toString() === poolAddress) {
          positionPublicKey = new PublicKey(posKey);
          positionState = posState;
          break;
        }
      }

      if (!positionPublicKey || !positionState) {
        console.warn(`No cached position found for pool ${poolAddress}`);
        return null;
      }

      const positionAddress = positionPublicKey.toString();

      // Get current position value using withdraw quote
      const liquidityToWithdraw = positionState.vestedLiquidity.add(
        positionState.unlockedLiquidity
      );

      const withdrawQuote = await this.cpAmm.getWithdrawQuote({
        liquidityDelta: liquidityToWithdraw,
        sqrtPrice: new BN(poolState.sqrtPrice),
        minSqrtPrice: new BN(poolState.sqrtMinPrice),
        maxSqrtPrice: new BN(poolState.sqrtMaxPrice),
      });

      // Get token info
      const tokenAMint = poolState.tokenAMint.toString();
      const tokenBMint = poolState.tokenBMint.toString();
      const tokenAInfo = await this.getTokenInfo(tokenAMint);
      const tokenBInfo = await this.getTokenInfo(tokenBMint);

      // Calculate current amounts
      const currentTokenAAmount =
        withdrawQuote.outAmountA.toNumber() / Math.pow(10, tokenAInfo.decimals);
      const currentTokenBAmount =
        withdrawQuote.outAmountB.toNumber() / Math.pow(10, tokenBInfo.decimals);

      // Calculate current fee amounts
      const currentFeeAAmount =
        positionState.feeAPending.toNumber() /
        Math.pow(10, tokenAInfo.decimals);
      const currentFeeBAmount =
        positionState.feeBPending.toNumber() /
        Math.pow(10, tokenBInfo.decimals);

      // Get current prices
      const currentTokenAPrice = await this.getCurrentTokenPrice(tokenAMint);
      const currentTokenBPrice = await this.getCurrentTokenPrice(tokenBMint);

      // Calculate current total value
      const currentTotalValueUSD =
        currentTokenAAmount * currentTokenAPrice +
        currentTokenBAmount * currentTokenBPrice;

      const feesEarnedUSD =
        currentFeeAAmount * currentTokenAPrice +
        currentFeeBAmount * currentTokenBPrice;

      // Get or fetch initial position data
      let positionPnL = this.positionPnLData.get(poolAddress);

      if (!positionPnL || this.isPositionDataStale(positionPnL)) {
        // Fetch initial position data
        const creationData = await this.getPositionCreationData(
          positionPublicKey
        );

        if (!creationData) {
          console.warn(
            `Could not fetch creation data for position ${positionAddress}`
          );
          return null;
        }

        const initialTotalValueUSD =
          creationData.initialTokenAAmount *
            creationData.initialTokenAPriceUSD +
          creationData.initialTokenBAmount * creationData.initialTokenBPriceUSD;

        positionPnL = {
          poolAddress,
          positionAddress,
          tokenA: tokenAInfo,
          tokenB: tokenBInfo,

          // Current data (will be updated)
          currentTokenAAmount,
          currentTokenBAmount,
          currentFeeAAmount,
          currentFeeBAmount,
          currentTokenAPrice,
          currentTokenBPrice,
          currentTotalValueUSD,

          // Initial data (cached)
          initialTokenAAmount: creationData.initialTokenAAmount,
          initialTokenBAmount: creationData.initialTokenBAmount,
          initialTokenAPrice: creationData.initialTokenAPriceUSD,
          initialTokenBPrice: creationData.initialTokenBPriceUSD,
          initialTotalValueUSD,
          createdAt: creationData.createdAt,

          // PnL calculations
          pnlUSD: 0,
          pnlPercentage: 0,
          feesEarnedUSD,

          // Metadata
          lastUpdated: new Date(),
          isStale: false,
        };
      } else {
        // Update current data only
        positionPnL.currentTokenAAmount = currentTokenAAmount;
        positionPnL.currentTokenBAmount = currentTokenBAmount;
        positionPnL.currentFeeAAmount = currentFeeAAmount;
        positionPnL.currentFeeBAmount = currentFeeBAmount;
        positionPnL.currentTokenAPrice = currentTokenAPrice;
        positionPnL.currentTokenBPrice = currentTokenBPrice;
        positionPnL.currentTotalValueUSD = currentTotalValueUSD;
        positionPnL.feesEarnedUSD = feesEarnedUSD;
        positionPnL.lastUpdated = new Date();
        positionPnL.isStale = false;
      }

      // Calculate PnL
      positionPnL.pnlUSD =
        positionPnL.currentTotalValueUSD +
        positionPnL.feesEarnedUSD -
        positionPnL.initialTotalValueUSD;
      positionPnL.pnlPercentage =
        positionPnL.initialTotalValueUSD > 0
          ? (positionPnL.pnlUSD / positionPnL.initialTotalValueUSD) * 100
          : 0;

      // Store updated data
      this.positionPnLData.set(poolAddress, positionPnL);

      console.log(
        `Updated PnL for pool ${poolAddress}: ${positionPnL.pnlUSD.toFixed(
          2
        )} USD (${positionPnL.pnlPercentage.toFixed(2)}%)`
      );

      return positionPnL;
    } catch (error) {
      console.error(`Error updating PnL for pool ${poolAddress}:`, error);
      return null;
    }
  }

  /**
   * Calculate overall portfolio PnL from individual positions
   */
  private calculateOverallPnL(): void {
    const positions = Array.from(this.positionPnLData.values());

    if (positions.length === 0) {
      this.overallPnL = null;
      return;
    }

    const totalCurrentValueUSD = positions.reduce(
      (sum, pos) => sum + pos.currentTotalValueUSD,
      0
    );
    const totalInitialValueUSD = positions.reduce(
      (sum, pos) => sum + pos.initialTotalValueUSD,
      0
    );
    const totalFeesEarnedUSD = positions.reduce(
      (sum, pos) => sum + pos.feesEarnedUSD,
      0
    );
    const totalPnLUSD = positions.reduce((sum, pos) => sum + pos.pnlUSD, 0);
    const totalPnLPercentage =
      totalInitialValueUSD > 0 ? (totalPnLUSD / totalInitialValueUSD) * 100 : 0;

    this.overallPnL = {
      totalCurrentValueUSD,
      totalInitialValueUSD,
      totalPnLUSD,
      totalPnLPercentage,
      totalFeesEarnedUSD,
      lastUpdated: new Date(),
      positions: [...positions],
    };

    console.log(
      `Overall PnL updated: ${totalPnLUSD.toFixed(
        2
      )} USD (${totalPnLPercentage.toFixed(2)}%)`
    );

    // Dispatch event to notify frontend about PnL update
    this.notifyPnLUpdate();
  }

  /**
   * Notify frontend about PnL data updates
   */
  private notifyPnLUpdate(): void {
    if (typeof window !== "undefined" && window.document) {
      const event = new CustomEvent("lancerPnLUpdated", {
        detail: {
          overallPnL: this.overallPnL,
          positionCount: this.positionPnLData.size,
          timestamp: new Date(),
        },
      });
      window.document.dispatchEvent(event);
    }
  }

  /**
   * Get token information (symbol, decimals)
   */
  private async getTokenInfo(mintAddress: string): Promise<TokenInfo> {
    try {
      if (!this.connection) {
        throw new Error("No connection available");
      }

      // For now, we'll use basic token info
      // In a real implementation, you might want to fetch from a token registry
      const mint = new PublicKey(mintAddress);
      const mintInfo = await this.connection.getParsedAccountInfo(mint);

      if (
        !mintInfo.value?.data ||
        typeof mintInfo.value.data !== "object" ||
        !("parsed" in mintInfo.value.data)
      ) {
        throw new Error("Invalid mint account data");
      }

      const parsedData = mintInfo.value.data.parsed;
      const decimals = parsedData.info?.decimals || 9;

      return {
        mint: mintAddress,
        symbol: `TOKEN_${mintAddress.slice(0, 4)}`, // Placeholder symbol
        decimals,
      };
    } catch (error) {
      console.error(`Error fetching token info for ${mintAddress}:`, error);
      return {
        mint: mintAddress,
        symbol: `UNKNOWN`,
        decimals: 9, // Default decimals
      };
    }
  }

  /**
   * Get current token price from Jupiter or other price feeds
   */
  private async getCurrentTokenPrice(mintAddress: string): Promise<number> {
    try {
      // Try Jupiter first
      const response = await fetch(
        `https://lite-api.jup.ag/price/v2?ids=${mintAddress}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.data && data.data[mintAddress]) {
          return parseFloat(data.data[mintAddress].price);
        }
      }

      // Fallback to other price sources or return 0
      console.warn(`Could not fetch price for token ${mintAddress}`);
      return 0;
    } catch (error) {
      console.error(`Error fetching price for token ${mintAddress}:`, error);
      return 0;
    }
  }

  /**
   * Check if position data is stale and needs refresh
   */
  private isPositionDataStale(positionData: PositionPnLData): boolean {
    const now = new Date();
    const timeDiff = now.getTime() - positionData.lastUpdated.getTime();
    return timeDiff > LancerBackend.STALE_THRESHOLD;
  }

  /**
   * Get PnL data for a specific pool
   */
  getPositionPnL(poolAddress: string): PositionPnLData | null {
    return this.positionPnLData.get(poolAddress) || null;
  }

  /**
   * Get overall portfolio PnL
   */
  getOverallPnL(): OverallPnLData | null {
    return this.overallPnL;
  }

  /**
   * Get all position PnL data
   */
  getAllPositionsPnL(): Map<string, PositionPnLData> {
    return new Map(this.positionPnLData);
  }

  /**
   * Force refresh of all PnL data
   */
  async refreshAllPnL(): Promise<void> {
    await this.updateAllPositionsPnL();
  }

  /**
   * Force refresh of specific position PnL
   */
  async refreshPositionPnL(
    poolAddress: string
  ): Promise<PositionPnLData | null> {
    return await this.updatePositionPnL(poolAddress);
  }

  /**
   * Clear all cached PnL data
   */
  clearPnLCache(): void {
    this.positionPnLData.clear();
    this.overallPnL = null;
    console.log("Lancer Backend: PnL cache cleared");
  }

  /**
   * Load positions from user's wallet and cache them
   */
  async loadUserPositions(walletAddress: string): Promise<void> {
    try {
      if (!this.cpAmm) {
        throw new Error("Backend not initialized");
      }

      console.log(`Loading positions for wallet: ${walletAddress}`);

      const userPublicKey = new PublicKey(walletAddress);

      // Add more detailed error handling around the SDK call
      let positions;
      try {
        console.log("🔍 Fetching positions from CP-AMM SDK...");
        positions = await this.cpAmm.getPositionsByUser(userPublicKey);
        console.log(
          `✅ Successfully fetched ${positions.length} positions from SDK`
        );
      } catch (sdkError: unknown) {
        console.error("❌ CP-AMM SDK error when fetching positions:", sdkError);

        // If it's a BigInt conversion error, provide more specific guidance
        if (sdkError instanceof Error && sdkError.message.includes("BigInt")) {
          console.error(
            "🔧 BigInt conversion error detected. This usually indicates:"
          );
          console.error("  1. Corrupted account data on-chain");
          console.error(
            "  2. Incompatible SDK version with current on-chain program"
          );
          console.error(
            "  3. Network/RPC issues causing partial data retrieval"
          );
          console.error("💡 Suggested fixes:");
          console.error("  - Try a different RPC endpoint");
          console.error("  - Check if the wallet has any DAMM positions");
          console.error("  - Verify the wallet address is correct");
        }

        // For BigInt errors, don't throw - just return empty positions
        if (sdkError instanceof Error && sdkError.message.includes("BigInt")) {
          console.warn(
            "⚠️ BigInt conversion error - continuing with 0 positions"
          );
          console.warn(
            "This usually means the wallet has no DAMM positions or RPC issues"
          );
          positions = []; // Set empty positions array
        } else {
          // For other errors, still throw
          const errorMessage =
            sdkError instanceof Error ? sdkError.message : String(sdkError);
          throw new Error(
            `Failed to fetch positions from CP-AMM SDK: ${errorMessage}`
          );
        }
      }

      // Clear existing cache
      this.userPositions.clear();

      // Cache the positions
      for (const position of positions) {
        this.userPositions.set(
          position.position.toString(),
          position.positionState
        );
      }

      console.log(
        `✅ Loaded ${positions.length} positions for wallet ${walletAddress}`
      );

      // Update pool addresses in storage to match loaded positions
      const poolAddresses = Array.from(this.userPositions.values()).map((pos) =>
        pos.pool.toString()
      );
      await ExtensionStorage.savePoolAddresses(poolAddresses);

      console.log(
        `📋 Updated tracked pool addresses: ${poolAddresses.length} pools`
      );

      // Trigger immediate PnL calculation for all loaded positions
      if (poolAddresses.length > 0) {
        console.log(
          "🔄 Lancer Backend: Triggering immediate PnL calculation..."
        );
        await this.updateAllPositionsPnL();
        console.log("✅ Lancer Backend: Initial PnL calculation completed");
      }
    } catch (error) {
      console.error("❌ Error loading user positions:", error);
      throw error;
    }
  }

  /**
   * Get cached user positions
   */
  getUserPositions(): Map<string, PositionState> {
    return new Map(this.userPositions);
  }

  /**
   * Check if we have positions loaded
   */
  hasPositionsLoaded(): boolean {
    return this.userPositions.size > 0;
  }
}

// Initialize the backend when the module is loaded
// This will be called when the content script runs on v2.meteora.ag
export const lancerBackend = LancerBackend.getInstance();

// Auto-initialize when visiting meteora
if (
  typeof window !== "undefined" &&
  window.location.hostname.includes("meteora.ag")
) {
  lancerBackend.initialize().then((success) => {
    if (success) {
      console.log("Lancer Backend: Auto-initialization successful");
    } else {
      console.log(
        "Lancer Backend: Auto-initialization failed - check RPC configuration"
      );
    }
  });
}
