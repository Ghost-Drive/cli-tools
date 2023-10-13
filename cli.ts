#!/usr/bin/env ts-node
import {gdBackendClient} from './gdBackendClient';
import {Command} from 'commander';
import {config} from 'dotenv';
import {AuthConfig} from "./types/AuthConfig";
import * as mime from 'mime';

import * as fs from 'fs';
import {Wallet} from "ethers";
import {Entry, EntryType} from "./types/Entry";
import {gdGatewayClient} from "./gdGatewayClient";
import {KeysAccess} from "./KeysAccess";

import {getUserRSAKeys} from "gdgateway-client/lib/es5";

import path = require("path");

config();

import {
    LocalFileStream
} from "gdgateway-client/lib/es5";

const prompt = require('prompt-sync')({sigint: true});
const ethers = require("ethers");
const ProgressBar = require('progress');


import { pipeline } from 'stream';
import { promisify } from 'util';

config();

if (!process.env.BACKEND_ENDPOINT) {
    throw new Error('Missing environment variable: BACKEND_ENDPOINT');
}


async function loadAuth(): Promise<AuthConfig> {
    let rawData = fs.readFileSync('.data/auth.json', 'utf-8');
    let config: AuthConfig = JSON.parse(rawData);
    return config;
}


// Initialize CLI
const program = new Command();


// Setup CLI commands

// Command to create a workspace
program
    .command('create-workspace <name> <storage>')
    .description('Create a new workspace')
    .action(async (name: string, storage: string) => {
        try {
            console.error('Not implemented');
        } catch (error: any) {
            console.error(`Error creating workspace: ${(error as Error).message}`);
        }
    });

// Command to delete a workspace
program
    .command('delete-workspace <id>')
    .description('Delete a workspace')
    .action(async (name: string) => {
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
        try {
            let creds = await loadAuth();
            const gdClient = new gdBackendClient(
                process.env.BACKEND_ENDPOINT,
                creds.accessKey,
                creds.accessSecret
            );

            let workspaces = await gdClient.listWorkspaces();
            console.table(workspaces);

        } catch (error) {
            console.error(`Error listing workspaces: ${(error as Error).message}`);
        }
    });

program
    .command('configure')
    .action(async() => {
        const accessKey = prompt('GD Access Key ID: ');
        const accessSecret = prompt('GD Secret Access Key: ');

        const gdClient = new gdBackendClient(
            process.env.BACKEND_ENDPOINT,
            accessKey,
            accessSecret
        );

        // await gdClient.authTest();

        let mnemonic = '';
        while(!ethers.Mnemonic.isValidMnemonic(mnemonic)) {
            mnemonic = prompt('BIP-39 mnemonic (for local file encryption): ');
        }

        let wallets: Wallet[] = [];

        for (let i = 0; i < 10; i++) {
            let path = `m/44'/60'/0'/0/${i}`;
            let wallet = ethers.HDNodeWallet.fromMnemonic(ethers.Mnemonic.fromPhrase(mnemonic, path));
            wallets.push(wallet);
        }

        wallets.forEach((wallet, i) => {
            console.log(`${i}: ${wallet.address}`);
        });

        let validSelection = false;
        let wallet;

        while (!validSelection) {
            let selectedWalletIndex = prompt('Select a wallet by entering its number: ');

            // Check if the user's input is a number and is within the range
            if (!isNaN(selectedWalletIndex) && selectedWalletIndex >= 0) {
                let path = `m/44'/60'/0'/0/${selectedWalletIndex}`;
                wallet = ethers.HDNodeWallet.fromMnemonic(ethers.Mnemonic.fromPhrase(mnemonic, path));
                console.log(`You selected the wallet at address ${wallet.address}`);
                validSelection = true;
            } else {
                console.log('Invalid selection');
            }
        }

        let jsonObject = {
            accessKey: accessKey,
            accessSecret: accessSecret,
            mnemonic: mnemonic
        };
        let jsonString = JSON.stringify(jsonObject, null, 2);
        try {
            fs.writeFileSync('.data/auth.json', jsonString);
            console.log('.data/auth.json has been written successfully');
        } catch (err) {
            console.log('Error writing file', err);
        }
    });

program
    .command('cp <from> <to>')
    .description('Download or upload the file')
    .action(async (from: string, to: string) => {
        console.log({from, to});
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
            return download(workspaceId, filePath, to, progressBar.tick.bind(progressBar), abortController.signal);

        } else if (to.startsWith(prefix)) {
            let { workspaceId, filePath } = parseGDPath(to);
            return upload(from, workspaceId, filePath, progressBar.tick.bind(progressBar), abortController.signal);
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

async function download(workspaceId: string, filePath: string, localPath:string, progressTick: () => void, signal: AbortSignal) {

    // Check if the path exists
    const pathName = path.dirname(localPath);

    if (!fs.existsSync(pathName)) {
        // Path does not exist, create directory
        fs.mkdirSync(pathName, { recursive: true });
    }

    let creds = await loadAuth();
    const gdBackend = new gdBackendClient(
        process.env.BACKEND_ENDPOINT,
        creds.accessKey,
        creds.accessSecret
    );
    let entry = await gdBackend.entryDetails(workspaceId, filePath);

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
        await gdBackend.entryEncryptedDetails(entry) :
        [];


    if (entry.isClientsideEncrypted && encryptionDetails.length === 0) {
        throw new Error('No encrypted keys for this file stored on server');
    }


    let fileKey: {key,iv,clientsideKeySha3Hash};

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


        const encryptedKey = detail.encryptedKey;

        fileKey = {
            key: await pair.privateKey.decrypt(encryptedKey),
            iv: entry.iv,
            clientsideKeySha3Hash: entry.sha3Hash
        };
    }

    //
    const ott = await gdBackend.getDownloadOtt(workspaceId, entry);
    const gdGateway = new gdGatewayClient();

    const tickBytesRange = Number(entry.size) / 100;
    const ticksPerTick = 104857600 / Number(entry.size);
    let tickedAtByte = 0;

    const readable = await gdGateway.downloadFile(entry, ott, function (progress) {
        if ( (progress.progress - tickedAtByte) >= tickBytesRange) {
            tickedAtByte = progress.progress;

            for (let i = 0; i < ticksPerTick; i++ ) {
                progressTick();
            }
        }
    }, signal, fileKey);

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
    localPath:string, workspaceId: string, destinationPath: string, progressTick: () => void, signal: AbortSignal
) {

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

    let creds = await loadAuth();
    const gdBackend = new gdBackendClient(
        process.env.BACKEND_ENDPOINT,
        creds.accessKey,
        creds.accessSecret
    );

    // let entry = await gdBackend.entryDetails(workspaceId, filePath);

    const ott = await gdBackend.getUploadOTT(workspaceId, {
        size: stats.size,
        name: path.basename(localPath)
    });

    // get folder id

    let folderSlug = '';
    if (destinationPath !== '.' && destinationPath !== '/') {
        folderSlug = await gdBackend.getFolderSlug(workspaceId, destinationPath);
    }

    let localFile: LocalFileStream = new LocalFileStream(
        stats.size,
        localPath,
        mime.getType(localPath),
        folderSlug
    );
    const gdGateway = new gdGatewayClient();

    const tickBytesRange = stats.size / 100;
    const ticksPerTick = 104857600 / stats.size;
    let tickedAtByte = 0;

    let uploadedEntry = await gdGateway.uploadFile(
        localFile,
        ott,
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

    await Promise.all([
        gdBackend.saveEncryptedKeyForWorkspaceUsers(uploadedEntry.slug, uploadedEntry.clientsideKey),
        gdGateway.saveThumb(
            localFile,
            await gdBackend.getThumbOtt(
                workspaceId, {
                    size: stats.size,
                    name: path.basename(localPath)
                }),
            uploadedEntry.slug
        )
    ]);

}

program
    .command('wallet')
    .description('Wallets')
    .action(async (workspace: string) => {
        try {
            let creds = await loadAuth();
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
    .action(async (folderPath: string) => {

        const {workspaceId, filePath} = parseGDPath(folderPath);
        function displayTable(entries: Entry[]): void {
            const nameWidth = Math.max(...entries.map(e => e.name.length), "File Name".length);
            const sizeWidth = Math.max(...entries.map(e => e.size.length), "Size".length);

            // Header
            console.log(
                `${"File Name".padEnd(nameWidth)} | ${"Size".padEnd(sizeWidth)}`
            );
            console.log("-".repeat(nameWidth + sizeWidth + 3));  // 3 is for " | " divider

            // Rows
            for (const entry of entries) {
                console.log(
                    `${entry.name.padEnd(nameWidth)} | ${entry.size.padEnd(sizeWidth)}`
                );
            }
        }

        try {
            let creds = await loadAuth();

            const gdBackend = new gdBackendClient(
                process.env.BACKEND_ENDPOINT,
                creds.accessKey,
                creds.accessSecret
            );

            const generator = await gdBackend.listFiles(workspaceId, filePath);
            let keepGoing = true;

            while (keepGoing) {
                const chunk: any[] = [];

                for (let i = 0; i < 10; i++) {
                    const result = await generator.next();
                    // console.log(result);
                    if (result.done) {
                        keepGoing = false;
                        break;
                    }
                    chunk.push(result.value);
                }

                if (chunk.length === 0) {
                    break;
                }

                console.clear();
                console.log(folderPath);
                displayTable(chunk);

                if (chunk.length === 15) {
                    const answer = prompt('Next page? (y/n) ');
                    keepGoing = answer.toLowerCase() === 'y';
                } else {
                    keepGoing = false;
                }

            }

        } catch (error) {
            console.error(`Error listing files: ${(error as Error).message}`);
        }
    });



// Command to delete a file from a workspace

program
    .command('rm <folderPath>')
    .description('Delete a file from a workspace')
    .action(async (folderPath: string) => {
        try {
            const {workspaceId, filePath} = parseGDPath(folderPath);

            let creds = await loadAuth();

            const gdBackend = new gdBackendClient(
                process.env.BACKEND_ENDPOINT,
                creds.accessKey,
                creds.accessSecret
            );

            await gdBackend.rm(workspaceId, filePath);

            console.log(`${filePath} successfully deleted from ${workspaceId}`);

        } catch (error) {
            console.error(`Error deleting file: ${(error as Error).message}`);
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
