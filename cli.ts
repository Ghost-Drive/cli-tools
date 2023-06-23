#!/usr/bin/env ts-node
import authMiddleware from './authMiddleware';
import { gdBackendClient } from './gdBackendClient';
import { Command } from 'commander';
import { config } from 'dotenv';
import { GDStorage } from "./types/GDStorage";
import { GDStore } from "./GDStore";

import S3rver from 's3rver';


config();

if (!process.env.BACKEND_ENDPOINT) {
    throw new Error('Missing environment variable: BACKEND_ENDPOINT');
}


// Initialize CLI
const program = new Command();

const gdBackend: gdBackendClient = new gdBackendClient(process.env.BACKEND_ENDPOINT);

// Setup CLI commands

// Command to create a workspace
program
    .command('create-workspace <name> <storage>')
    .description('Create a new workspace')
    .action(async (name: string, gdStorage:GDStorage) => {
        try {
            const response = await gdBackend.createWorkspace(name, gdStorage);
            console.log(response);
        } catch (error: any) {
            console.error(`Error creating workspace: ${(error as Error).message}`);
        }
    });

// Command to delete a workspace
program
    .command('delete-workspace <name>')
    .description('Delete a workspace')
    .action(async (name: string) => {
        try {
            const response = await gdBackend.deleteWorkspace(name);
            console.log(response);
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
            const response = await gdBackend.listWorkspaces();
            console.log(response);
        } catch (error) {
            console.error(`Error listing workspaces: ${(error as Error).message}`);
        }
    });

// Command to upload a file to a workspace
program
    .command('cp <filePath> gd://<workspace>')
    .description('Upload a file to a workspace')
    .action(async (workspace: string, filePath: string) => {
        try {
            const response = await gdBackend.getUploadOtt(workspace, {filePath});
            console.log(response);
        } catch (error) {
            console.error(`Error uploading file: ${(error as Error).message}`);
        }
    });

// Command to download a file from a workspace
program
    .command('cp gd://<workspace>/<filePath> <localPath>')
    .description('Download a file from a workspace')
    .action(async (workspace: string, filePath: string) => {
        try {
            const response = await gdBackend.getDownloadOtt(filePath);
            // todo: include storage node address to response
            // fs.write(fetch())
        } catch (error) {
            console.error(`Error downloading file: ${(error as Error).message}`);
        }
    });

// Command to list all files in a workspace
program
    .command('ls gd://<workspace>')
    .description('List all files in a workspace')
    .action(async (workspace: string) => {
        try {
            const response = await gdBackend.listFiles(workspace);
            console.log(response);
        } catch (error) {
            console.error(`Error listing files: ${(error as Error).message}`);
        }
    });

// Command to delete a file from a workspace
program
    .command('rm gd://<workspace>/<file>')
    .description('Delete a file from a workspace')
    .action(async (workspace: string, file: string) => {
        try {
            const response = await gdBackend.getDeleteOtt(workspace, file);
            console.log(response);
        } catch (error) {
            console.error(`Error deleting file: ${(error as Error).message}`);
        }
    });

program
    .command('init')
    .description('initializes GhostDrive tools')
    .action(async() => {
        // @todo save auth keys and mnemonic and wallet index. Show address. Save pub and priv keys for this address, to .data dir
    });

program
    .command('s3server')
    .option('-p, --port <number>', 'port number')
    .option('-b, --bind <string>', 'ip address')
    .description('runs s3-alike server locally')
    .action(async () => {
        // check if seed phrase and wallet index all set
        // init get authMiddleware

        const storeInstance = new GDStore('key', 'key'); // todo these values should come from request headers from authMiddleware (in worst case from config)

        // @ts-ignore
        const serverInst = new S3rver({
            port: 80,
            address: '0.0.0.0',
            silent: false,
            tore: storeInstance
        }).run((err: any) => {
            if (err) {
                console.error(err);
            } else {
                console.log('now listening at address %s and port %d');
            }
        });

        serverInst.app.use(authMiddleware()); // @todo check if this would work.

    });

program.parse(process.argv);
