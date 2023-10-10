import { ethers } from "ethers";

export class KeysAccess {

    private readonly walletByAddress: { [address: string]: ethers.HDNodeWallet } = {};

    private constructor(private mnemonic: string, private count: number) {}

    public static async create(mnemonic: string, count: number): Promise<KeysAccess> {
        const instance = new KeysAccess(mnemonic, count);
        await instance.constructWallets();
        return instance;
    }

    private async constructWallets(): Promise<void> {
        // Metamask's default derivation path is "m/44'/60'/0'/0/x"
        const basePath = "m/44'/60'/0'/0/";

        for (let i = 0; i < this.count; i++) {
            const fullPath = basePath + i;

            // Assuming ethers.HDNodeWallet.fromMnemonic has the same signature as ethers.Wallet.fromMnemonic
            const wallet = await ethers.HDNodeWallet.fromMnemonic(
                ethers.Mnemonic.fromPhrase(this.mnemonic), fullPath
            );
            const address = (await wallet.getAddress()).toLowerCase();

            this.walletByAddress[address] = wallet;
        }
    }

    public getWalletByAddress(address: string): ethers.HDNodeWallet | undefined {
        return this.walletByAddress[address.toLowerCase()];
    }
}
