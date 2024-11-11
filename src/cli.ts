import {Command} from 'commander';
import {config} from 'dotenv';
import forge from "node-forge";
import fs from 'fs';
import {Wallet} from "ethers";
import {EntryType} from "./types/Entry.js";
import {KeysAccess} from "./KeysAccess.js";
import { clientGD, initClientGD, defaultConfig as clientGDDefaultConfig } from './clientGD';
import { download, getAuthConfig, upload } from './utils';
import { getUserRSAKeys } from 'client-gateway';
import prompt_sync from "prompt-sync";
import * as ethers from "ethers";

config();

const prompt = prompt_sync({sigint: true});

if (!process.env.GD_ENDPOINT) {
    throw new Error('Missing environment variable: GD_ENDPOINT');
}

if (!process.env.NEYRA_ENDPOINT) {
    throw new Error('Missing environment variable: NEYRA_ENDPOINT');
}

if (!process.env.SHARE_ENDPOINT) {
    throw new Error('Missing environment variable: SHARE_ENDPOINT');
}


// Initialize CLI
const program = new Command();

// Command to create a workspace
program
    .command('create-workspace <name>')
    .option('--access-token <token>', 'access token')
    .description('Create a new workspace')
    .action(async (name: string, { accessToken }: { accessToken?: string }) => {
        await initClientGD({ accessToken })
        const { id } = await clientGD.createWorkspace({ name })
        console.log('Workspace created successfully, id:', id);
    });

// Command to list all workspaces
program
    .command('list-workspaces')
    .option('--access-token <token>', 'access token')
    .description('List all workspaces')
    .action(async ({ accessToken }: { accessToken?: string }) => {
        await initClientGD({ accessToken })
        const { data } = await clientGD.getUserWorkspaces()
        console.table(
            data.map((row: any) => {
                return {
                    id: row.workspace.id,
                    name: row.workspace.name,
                    slug: row.workspace.slug,
                    role: row.role
                };
            })
        );
    });

program
    .command('configure')
    .action(async() => {
        const authType = prompt('Configure: (1) Own Account, (2) OAuth Client or (3) Mnemonic only? Enter 1, 2 or 3: ');

        let mnemonic = '';
        while (!ethers.Mnemonic.isValidMnemonic(mnemonic)) {
            mnemonic = prompt('BIP-39 mnemonic (for local file encryption): ');
        }

        let wallets: any[] = [];
        for (let i = 0; i < 10; i++) {
            let path = `m/44'/60'/0'/0/${i}`;
            let wallet = ethers.HDNodeWallet.fromMnemonic(ethers.Mnemonic.fromPhrase(mnemonic, path));
            wallets.push(wallet);
        }

        wallets.forEach((wallet, i) => {
            console.log(`${i}: ${wallet.address}`);
        });

        let validSelection = false;
        let selectedWalletIndex, wallet: Wallet;
        wallet = wallets[0];
        while (!validSelection) {
            selectedWalletIndex = prompt('Select a wallet by entering its number: ');

            // Check if the user's input is a number and is within the range
            if (!isNaN(+selectedWalletIndex) && +selectedWalletIndex >= 0 && +selectedWalletIndex < wallets.length) {
                wallet = wallets[+selectedWalletIndex];
                console.log(`You selected the wallet at address ${wallet.address}`);
                validSelection = true;
            } else {
                console.log('Invalid selection, please try again.');
            }
        }

        let authConfig: any = {
            authType: authType,
            mnemonic: mnemonic,
            selectedWalletIndex: selectedWalletIndex
        };

        if (authType === '1') {  // Own Account
            const accessKey = prompt('GD Access Key ID: ').trim();
            const accessSecret = prompt('GD Secret Access Key: ').trim();

            authConfig.accessKey = accessKey;
            authConfig.accessSecret = accessSecret;
        } else if (authType === '2') {  // OAuth Client
            const clientId = prompt('OAuth Client ID: ');
            const clientSecret = prompt('OAuth Client Secret: ');

            authConfig.clientId = clientId;
            authConfig.clientSecret = clientSecret;

            console.log(`Exporting ${wallet.address} public key to GhostDrive servers...`);
            if (!process.env.GD_ENDPOINT) {
                throw new Error('No GD_ENDPOINT');
            }

            const pair = await getUserRSAKeys({signer: wallet});
            const publicKey = forge.pki.publicKeyToPem(pair.publicKey);

            clientGD.initializeApiClient(clientGDDefaultConfig)
            await clientGD.saveGoogle2faKey({
                publicAddress: wallet.address,
                publicKey,
                clientId: clientId,
                clientSecret: clientSecret
            })

            console.log('Use `--access-token` param to pass authentication token to any command.');
        }

        // Convert authConfig to a string and write to a file
        const authConfigRaw = JSON.stringify(authConfig, null, 2);
        try {
            fs.writeFileSync('.data/auth.json', authConfigRaw);
            console.log('.data/auth.json has been written successfully');
        } catch (err) {
            console.log('Error writing file', err);
        }
    });

program
    .command('share-by-link <pathOrSlug>')
    // .option('--includeDecryptionKey', 'if set, decryption key will be included in the link')
    .option('--access-token <token>', 'access token')
    .action(async (folderPath: string, { accessToken }: { accessToken?: string }) => {
        try {
            const { workspaceId, filePath } = parseGDPath(folderPath);
            await initClientGD({ 
                workspaceId: Number(workspaceId),
                accessToken
            })
            const fileInfo = await clientGD.getFileInfo({
                path: filePath
            })
            const slug = fileInfo.slug
            await clientGD.shareFile({ slug, shareType: 1 })
            console.log('File shared successfully');
            console.log(
                'Link: ',
                `${process.env.SHARE_ENDPOINT}/${slug}`,
            );
            
        } catch (error) {
            console.error(`Error share file: ${(error as any).response.errors}`);
        }
    });

program
    .command('cp <from> <to>')
    .option('--access-token <token>', 'access token')
    .option('--decryption-key <key>', 'Decryption key')
    .description('Download or upload the file')
    .action(async (from: string, to: string, { accessToken, decryptionKey }: { accessToken?: string, decryptionKey?: string }) => {

        const prefix = 'gd://';

        const isDownload = from.startsWith(prefix);
        const isUpload = to.startsWith(prefix);

        if (isDownload && isUpload) {
            throw new Error('Both "from" and "to" should not start with "gd://"');
        } else if (!isDownload && !isUpload) {
            throw new Error('Either "from" or "to" should start with "gd://"');
        } else if (isDownload) {
            const { workspaceId, filePath } = parseGDPath(from);
            await initClientGD({ 
                workspaceId: Number(workspaceId),
                accessToken
            })
            await download(
                filePath,
                to,
                decryptionKey
            );
            console.log('Successfully downloaded');

        } else if (isUpload) {
            let { workspaceId, filePath } = parseGDPath(to);
            await initClientGD({ 
                workspaceId: Number(workspaceId),
                accessToken
            })
            const { clientsideKey } = await upload(
                from,
                filePath
            );
            console.log(`Successfully uploaded, decryption key: ${clientsideKey}`);
        }

    });


function parseGDPath(url: string) {
    const regex = /^gd:\/\/([^\/]+)\/(.*)$/;
    const match = url.match(regex);

    if (match === null || match.length !== 3) {
        throw new Error('Invalid URL format');
    }

    const workspaceId = match[1];
    const filePath = match[2];

    return { workspaceId, filePath };
}


program
    .command('wallet')
    .description('Wallets')
    .action(async () => {
        try {
            let authConfig = await getAuthConfig();
            let keys = await KeysAccess.create(authConfig.mnemonic, 100);
            console.log(keys.getAddresses());
        } catch (error) {
            console.error(`Error listing files: ${(error as Error).message}`);
        }
    });

// Command to list all files in a workspace

program
    .command('ls <folderPath>')
    .description('List all files in a workspace')
    .option('--access-token <token>', 'access token')
    .action(async (folderPath: string, { accessToken }: { accessToken?: string }) => {

        try {
            const { workspaceId, filePath: dir } = parseGDPath(folderPath);

            await initClientGD({ 
                workspaceId: Number(workspaceId),
                accessToken
            })

            let dirSlug;
            if (dir.length === 0 || dir === '.' || dir === '/') {
                dirSlug = '';
            } else {
                const entry = await clientGD.getFileInfo({ path: dir })
                if (entry.type !== EntryType.FOLDER) {
                    throw new Error(`${dir} is not a folder`);
                }
                dirSlug = entry.slug;
            }

            let currentPage = 1;
            let keepGoing = true;

            while (keepGoing) { 
                const { data: files } = await clientGD.getFiles({
                    page: currentPage,
                    folderSlug: dirSlug
                })

                const nameWidth = Math.max(...files.map(e => e.name.length), "File Name".length);
                const sizeWidth = Math.max(...files.map(e => e.size.toString().length), "Size".length);
                
                // Header
                console.log(
                    `${"File Name".padEnd(nameWidth)} | ${"Size".padEnd(sizeWidth)}`
                );
                console.log("-".repeat(nameWidth + sizeWidth + 3));  // 3 is for " | " divider

                // Rows
                for (const file of files) {
                    console.log(
                        `${file.name.padEnd(nameWidth)} | ${file.size.toString().padEnd(sizeWidth)}`
                    );
                }

                if (files.length === 15) {
                    const answer = prompt('Next page? (y/n) ');
                    keepGoing = answer.toLowerCase() === 'y';
                    currentPage++;
                } else {
                    keepGoing = false;
                }
            }
        } catch (error) {
            console.error(`Error listing files: ${(error as any)}`);
        }
    });



// Command to delete a file from a workspace

program
    .command('rm <folderPath>')
    .option('--access-token <token>', 'access token')
    .description('Delete a file from a workspace')
    .action(async (folderPath: string, { accessToken }: { accessToken?: string }) => {
        try {
            const { workspaceId, filePath } = parseGDPath(folderPath);
            await initClientGD({ 
                workspaceId: Number(workspaceId),
                accessToken
            })
            const fileInfo = await clientGD.getFileInfo({
                path: filePath
            })
            const slug = fileInfo.slug
            const deleteFile = await clientGD.deleteMultipleFiles({ slugs: [slug] })
            console.log(deleteFile.message)
        } catch (error) {
            console.error(`Error deleting file: ${(error as any).response.errors}`);
        }
    });

program.parse(process.argv);