import {gdBackendClient} from './gdBackendClient.js';
import {oAuthClient} from './oAuthClient.js';
import {Command} from 'commander';
import {config} from 'dotenv';
import mime from 'mime';
import forge from "node-forge";
import fs from 'fs';
import {Wallet} from "ethers";
import {EntryType} from "./types/Entry.js";
import {gdGatewayClient} from "./gdGatewayClient.js";
import {KeysAccess} from "./KeysAccess.js";
import { clientGD, initClientGD } from './clientGD';
import { loadCreds } from './utils';

// import path = require("path");
import * as path from 'path';

/// @ts-ignore
import { LocalFileStream, getUserRSAKeys } from 'gdgateway-client';

/// @ts-ignore
import prompt_sync from "prompt-sync";

const prompt = prompt_sync({sigint: true});

import * as ethers from "ethers";
/// @ts-ignore
import ProgressBar from "progress";

config();

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


// Setup CLI commands



async function getGDBackendClient(accessToken: string|undefined): Promise<gdBackendClient> {
    const creds = await loadCreds();
    if (!process.env.GD_ENDPOINT) {
        throw new Error('No GD_ENDPOINT');
    }
    return new gdBackendClient(
        process.env.GD_ENDPOINT,
        creds.accessKey,
        creds.accessSecret,
        creds.jwt,
        accessToken
    );
}

// Command to create a workspace
program
    .command('create-workspace <name>')
    .option('--oAuthToken <token>', 'Redefines JWT token')
    .description('Create a new workspace')
    .action(async (name: string, options: any) => {

        if (!options.oAuthToken) {
            console.error('Error: --oAuthToken option is required as this command is only for oAuth usage');
            process.exit(1); // Exit with error code
        }

        try {
            const gdClient = await getGDBackendClient(options.oAuthToken);
            const wsDetails = await gdClient.createWorkspace(name);
            console.log('done', wsDetails);

        } catch (error: any) {
            console.error(`Error creating workspace: ${(error as Error).message}`);
        }
    });

// Command to delete a workspace
program
    .command('delete-workspace <id>')
    .option('--oAuthToken <token>', 'Redefines JWT token')
    .description('Delete a workspace')
    .action(async (name: string, options: any) => {
        try {
            console.error('Not implemented');
        } catch (error) {
            console.error(`Error deleting workspace: ${(error as Error).message}`);
        }
    });


// Command to list all workspaces
program
    .command('list-workspaces')
    .description('List all workspaces')
    .action(async () => {
        await initClientGD()
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
        const configType = prompt('Configure for (1) Own Account or (2) OAuth Client? Enter 1 or 2: ');

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

        let jsonObject: any = {
            configType: configType,
            mnemonic: mnemonic,
            selectedWalletIndex: selectedWalletIndex
        };

        if (configType === '1') {  // Own Account
            const accessKey = prompt('GD Access Key ID: ').trim();
            const accessSecret = prompt('GD Secret Access Key: ').trim();

            jsonObject.accessKey = accessKey;
            jsonObject.accessSecret = accessSecret;
        } else if (configType === '2') {  // OAuth Client
            const clientId = prompt('OAuth Client ID: ');
            const clientSecret = prompt('OAuth Client Secret: ');

            jsonObject.clientId = clientId;
            jsonObject.clientSecret = clientSecret;

            console.log(`Exporting ${wallet.address} public key to GhostDrive servers...`);
            if (!process.env.GD_ENDPOINT) {
                throw new Error('No GD_ENDPOINT');
            }
            const oAuth = new oAuthClient(
                process.env.GD_ENDPOINT,
                jsonObject.clientId,
                jsonObject.clientSecret
            );

            const pair = await getUserRSAKeys({signer: wallet});
            const pubKeyPem = forge.pki.publicKeyToPem(pair.publicKey);
            await oAuth.exportKey(wallet.address, pubKeyPem);

            console.log('Use `--oAuthToken` param to pass authentication token to any command.');
        }

        // Convert jsonObject to a string and write to a file
        let jsonString = JSON.stringify(jsonObject, null, 2);
        try {
            fs.writeFileSync('.data/auth.json', jsonString);
            console.log('.data/auth.json has been written successfully');
        } catch (err) {
            console.log('Error writing file', err);
        }
    });

program
    .command('share-by-link <pathOrSlug>')
    // .option('--includeDecryptionKey', 'if set, decryption key will be included in the link')
    // .option('--oAuthToken <token>', 'Defines oAuth token')
    .action(async (folderPath: string) =>{
        try {
            const { workspaceId, filePath } = parseGDPath(folderPath);
            await initClientGD({ workspaceId: Number(workspaceId) })
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
    .option('--oAuthToken <token>', 'Defines oAuth token')
    .option('--manageKey', 'Stores file decryption key to GD')
    .description('Download or upload the file')
    .action(async (from: string, to: string, options: any) => {

        const gdClient = await getGDBackendClient(options.oAuthToken);
        const prefix = 'gd://';

        const progressBar = new ProgressBar('[:bar] :percent :etas', { total: 100 });

        const abortController = new AbortController();

        process.on('SIGINT', () => {
            abortController.abort();
        });

        if (from.startsWith(prefix) && to.startsWith(prefix)) {
            throw new Error('Both "from" and "to" cannot start with "gd://"');
        } else if (!from.startsWith(prefix) && !to.startsWith(prefix)) {
            throw new Error('Either "from" or "to" should start with "gd://"');
        } else if (from.startsWith(prefix)) {
            let { workspaceId, filePath } = parseGDPath(from);
            await download(workspaceId, filePath, to, progressBar.tick.bind(progressBar), abortController.signal, gdClient);
            console.log('Successfully downloaded');

        } else if (to.startsWith(prefix)) {
            let { workspaceId, filePath } = parseGDPath(to);
            await upload(
                from, workspaceId, filePath, progressBar.tick.bind(progressBar),
                abortController.signal, gdClient, options.manageKey
            );
            console.log('Successfully uploaded');
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

async function download(
    workspaceId: string,
    filePath: string,
    localPath:string,
    progressTick: () => void, signal: AbortSignal,
    gdClient: gdBackendClient
) {

    // Check if the path exists
    const pathName = path.dirname(localPath);

    if (!fs.existsSync(pathName)) {
        // Path does not exist, create directory
        fs.mkdirSync(pathName, { recursive: true });
    }

    let entry = await gdClient.getEntryDetails(workspaceId, filePath);
    if (entry === undefined) {
        throw new Error('Unable to fetch file details');
    }
    if (fs.existsSync(localPath)) {
        const stats = fs.lstatSync(localPath);

        if (stats.isFile()) {
            console.error('The file already exists');
            process.exit(1);
        }

        if(stats.isDirectory()) {
            localPath = localPath.replace(/\/+$/, '') + `/${entry.name}`;
        }
    }


    if(entry.type !== EntryType.FILE) {
        throw new Error('Only single file can be downloaded in this version');
    }

    const encryptionDetails = entry.isClientsideEncrypted ?
        await gdClient.entryEncryptedDetails(entry) :
        [];


    if (entry.isClientsideEncrypted && encryptionDetails.length === 0) {
        throw new Error('No encrypted keys for this file stored on server');
    }


    let fileKey: any = null;

    const creds = await loadCreds();
    if (entry.isClientsideEncrypted) {
        // decode file key
        const keys = await KeysAccess.create(creds.mnemonic, 100);

        let pair, detail;
        for (let i= 0; i < encryptionDetails.length; i++) {
            detail = encryptionDetails[i];
            let wallet = keys.getWalletByAddress(detail.userAddress);
            if (wallet !== undefined) {
                // get private key
                pair = await getUserRSAKeys({signer: wallet});
                break;
            }
        }

        if (!pair) {
            throw new Error('Your seed phrase does not have proper wallet to decode this file');
        }


        /// @ts-ignore
        const encryptedKey = detail.encryptedKey;

        fileKey = {
            key: await pair.privateKey.decrypt(encryptedKey),
            iv: entry.iv,
            clientsideKeySha3Hash: entry.sha3Hash
        };
    }

    //
    const ott = await gdClient.getDownloadOtt(workspaceId, entry);

    if (!ott) {
        throw new Error('Unable to get download OTT');
    }
    let cidData;
    if (ott.isOnStorageProvider[entry.slug]) {
        cidData = await gdClient.getFileCids(entry.slug);
    }

    const gdGateway = new gdGatewayClient();

    const tickBytesRange = Number(entry.size) / 100;
    const ticksPerTick = 104857600 / Number(entry.size);
    let tickedAtByte = 0;

    const readable = await gdGateway.downloadFile(
        entry,
        ott,
        /// @ts-ignore
        function (progress) {
        if ( (progress.progress - tickedAtByte) >= tickBytesRange) {
            tickedAtByte = progress.progress;

            for (let i = 0; i < ticksPerTick; i++ ) {
                progressTick();
            }
        }
    },
        signal,
        fileKey,
        cidData
    );

    const writable = fs.createWriteStream(localPath);

    readable.pipe(writable);

    writable.on('finish', () => {
        console.log('File has been written');
    });

    writable.on('error', (error) => {
        console.error('Error writing file:', error);
    });
}

async function upload(
    localPath:string,
    workspaceId: string,
    destinationPath: string,
    progressTick: () => void,
    signal: AbortSignal,
    gdClient: gdBackendClient,
    manageKey: boolean
)  {
    let stats;
    if (fs.existsSync(localPath)) {
        stats = fs.lstatSync(localPath);

        if(stats.isDirectory()) {
            console.error('We can\'t upload a directory');
            process.exit(1);
        }

        if (!stats.isFile()) {
            console.error('Upload should be a file');
            process.exit(1);
        }
    } else {
        console.error('File not found');
        process.exit(1);
    }

    const ott = await gdClient.getUploadOTT(workspaceId, {
        size: stats.size,
        name: path.basename(localPath)
    });
    if (!ott) {
        throw new Error('Unable to fetch OTT');
    }

    // get folder id

    let folderSlug = '';
    if (destinationPath !== '.' && destinationPath !== '/') {
        folderSlug = await gdClient.getFolderSlug(workspaceId, destinationPath);
    }

    let localFile: LocalFileStream = new LocalFileStream(
        stats.size,
        localPath,
        /// @ts-ignore
        mime.getType(localPath),
        folderSlug,
        ott.token // @todo is it ok for uploadId?
    );
    const gdGateway = new gdGatewayClient();

    const tickBytesRange = stats.size / 100;
    const ticksPerTick = 104857600 / stats.size;
    let tickedAtByte = 0;

    let uploadedEntry = await gdGateway.uploadFile(
        localFile,
        ott,
        /// @ts-ignore
        function (progress) {
            if ( (progress.progress - tickedAtByte) >= tickBytesRange) {
                tickedAtByte = progress.progress;

                for (let i = 0; i < ticksPerTick; i++ ) {
                    progressTick();
                }
            }
        },
        signal
    );

    let processes = [];
    // if (false) {
    //     processes.push(gdGateway.saveThumb(
    //         localFile,
    //         ott,
    //         uploadedEntry.slug
    //     ));
    // }

    if (uploadedEntry.clientsideKey) {
        processes.push(gdClient.saveEncryptedKeyForWorkspaceUsers(uploadedEntry.slug, uploadedEntry.clientsideKey));
    }

    if (manageKey && uploadedEntry.clientsideKey) {
        processes.push(gdClient.manageKey(uploadedEntry.slug, uploadedEntry.clientsideKey));
    }

    await Promise.all(processes);

}

program
    .command('wallet')
    .description('Wallets')
    .action(async (workspace: string) => {
        try {
            let creds = await loadCreds();
            let keys = await KeysAccess.create(creds.mnemonic, 100);
            console.log(keys.getAddresses());
        } catch (error) {
            console.error(`Error listing files: ${(error as Error).message}`);
        }
    });

// Command to list all files in a workspace

program
    .command('ls <folderPath>')
    .description('List all files in a workspace')
    // .option('--oAuthToken <token>', 'defines oAuthToken token')
    .action(async (folderPath: string) => {

        try {
            const { workspaceId, filePath: dir } = parseGDPath(folderPath);

            await initClientGD({ workspaceId: Number(workspaceId) })

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

            let currentPageSize = 0;
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

                currentPageSize = files.length; 
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
    // .option('--oAuthToken <token>', 'defines oAuthToken token')
    .description('Delete a file from a workspace')
    .action(async (folderPath: string) => {
        try {
            const { workspaceId, filePath } = parseGDPath(folderPath);
            await initClientGD({ workspaceId: Number(workspaceId) })
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

/*

//
// program
//     .command('s3server')
//     .option('-p, --port <number>', 'port number')
//     .option('-b, --bind <string>', 'ip address')
//     .description('runs s3-alike server locally')
//     .action(async () => {
//         // check if seed phrase and wallet index all set
//         // init get authMiddleware
//
//         const storeInstance = new GDStore(
//             'key', 'key'
//         ); // todo these values should come from request headers from authMiddleware (in worst case from config)
//
//         // @ts-ignore
//         const serverInst = new S3rver({
//             port: 8080,
//             address: '0.0.0.0',
//             silent: false,
//             store: storeInstance
//         });
//
//         // await serverInst.run();
//         // console.log(serverInst.run);
//
//         serverInst.run((err: any) => {
//             if (err) {
//                 console.error(err);
//             } else {
//                 console.log('now listening at address %s and port %d', serverInst);
//             }
//         });
//
//     });

*/

program.parse(process.argv);