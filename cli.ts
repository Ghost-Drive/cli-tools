#!/usr/bin/env ts-node
import authMiddleware from './authMiddleware';
import { gdBackendClient } from './gdBackendClient';
import { Command } from 'commander';
import { config } from 'dotenv';
import { GDStorage } from "./types/GDStorage";
import { AuthConfig } from "./types/AuthConfig";
import { GDStore } from "./GDStore";
const prompt = require('prompt-sync')({sigint: true});
const ethers = require("ethers")
import * as path from 'path';

import * as fs from 'fs';
import {Wallet} from "ethers";
import {gdGatewayClient} from "./gdGatewayClient";

// import S3rver from 's3rver/lib/s3rver';

const S3rver = require('s3rver');

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
            console.log('Not implemented');
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
            console.log('Not implemented');
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
                creds.accessKeyId,
                creds.gdAccessKey
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
        const accessKeyId = prompt('GD Access Key ID: ');
        const gdAccessKey = prompt('GD Secret Access Key: ');

        const gdClient = new gdBackendClient(
            process.env.BACKEND_ENDPOINT,
            accessKeyId,
            gdAccessKey
        );

        await gdClient.authTest();

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
            accessKeyId: accessKeyId,
            gdAccessKey: gdAccessKey,
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

// Command to upload a file to a workspace

program
    .command('cp <filePath> gd://<workspaceId>[/uploadPath]')
    .description('Upload a file to a workspace')
    .action(async (filePath: string, workspaceId: string, uploadPath:string|undefined) => {
        try {
            let creds = await loadAuth();
            const gdClient = new gdBackendClient(
                process.env.BACKEND_ENDPOINT,
                creds.accessKeyId,
                creds.gdAccessKey
            );


            let fileDetails: FileDetails;
            fileDetails.filename = path.basename(filePath);
            fileDetails.filesize = fs.statSync(filePath).size;

            const ott = await gdClient.getUploadOtt(workspaceId, fileDetails);

            const gatewayClient = gdGatewayClient();
            console.log(response);
        } catch (error) {
            console.error(`Error uploading file: ${(error as Error).message}`);
        }
    });
// Command to download a file from a workspace

/*
// program
//     .command('cp gd://<workspace>/<filePath> <localPath>')
//     .description('Download a file from a workspace')
//     .action(async (workspace: string, filePath: string) => {
//         try {
//             const response = await gdBackend.getDownloadOtt(filePath);
//             // todo: include storage node address to response
//             // fs.write(fetch())
//         } catch (error) {
//             console.error(`Error downloading file: ${(error as Error).message}`);
//         }
//     });
// // Command to list all files in a workspace
//
// program
//     .command('ls gd://<workspace>')
//     .description('List all files in a workspace')
//     .action(async (workspace: string) => {
//         try {
//             const response = await gdBackend.listFiles(workspace);
//             console.log(response);
//         } catch (error) {
//             console.error(`Error listing files: ${(error as Error).message}`);
//         }
//     });
// // Command to delete a file from a workspace
//
// program
//     .command('rm gd://<workspace>/<file>')
//     .description('Delete a file from a workspace')
//     .action(async (workspace: string, file: string) => {
//         try {
//             const response = await gdBackend.getDeleteOtt(workspace, file);
//             console.log(response);
//         } catch (error) {
//             console.error(`Error deleting file: ${(error as Error).message}`);
//         }
//     });
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
