import {AuthConfig} from "./types/AuthConfig.js";
import fs from 'fs';
import { CarReader } from '@ipld/car/reader';
import * as path from 'path';
import { LocalFileStream, getUserRSAKeys, downloadFile, uploadFile, getCrypto } from 'client-gateway';
import { clientGD } from './clientGD';
import forge from "node-forge";
import {KeysAccess} from "./KeysAccess";
import {EntryType} from "./types/Entry";
import mime from 'mime';
import * as Base64 from 'base64-js';

export async function getAuthConfig(): Promise<AuthConfig> {
    let rawData = fs.readFileSync('.data/auth.json', 'utf-8');
    let config: AuthConfig = JSON.parse(rawData);
    return config;
}

export async function download(
    filePath: string,
    localPath:string,
    decryptionKey: string = ''
) {

    // Check if the path exists
    const pathName = path.dirname(localPath);

    if (!fs.existsSync(pathName)) {
        // Path does not exist, create directory
        fs.mkdirSync(pathName, { recursive: true });
    }

    const entry = await clientGD.getFileInfo({ path: filePath })

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

    const ott = await clientGD.getDownloadOTT({
        slugs: [entry.slug],
        action: 5
    });

    if (!ott) {
        throw new Error('Unable to get download OTT');
    }

    if (!ott.is_on_storage_provider[entry.slug]) {
        throw new Error('File is not on storage provider');   
    }


    const cidData = await clientGD.getFileCids({
        slug: entry.slug,
        level: 'interim'
    });

    if (entry.isClientsideEncrypted && !decryptionKey) {
        const encryptedFileDetails = await clientGD.getEncryptedFileDetails({ slug: entry.slug });
        const { mnemonic } = await getAuthConfig();
        if (!mnemonic) {
            throw new Error('Seed phrase is required to decode this file');
        }
        const keys = await KeysAccess.create(mnemonic, 100);
        for (const details of encryptedFileDetails.data) {
            let wallet = keys.getWalletByAddress(details.user_public_address.public_address);
            if (wallet !== undefined) {
                const pair = await getUserRSAKeys({signer: wallet});
                decryptionKey = await pair.privateKey.decrypt(
                    forge.util.hexToBytes(details.encrypted_key)
                )
                break;
            }
        }
        if (!decryptionKey) {
            throw new Error('Your seed phrase does not have proper wallet to decode this file');
        }
    }

    const currentFile = {
        slug: entry.slug,
        entry_clientside_key: {
        key: decryptionKey,
        iv: entry.iv,
        clientsideKeySha3Hash: entry.sha3Hash
        },
        is_on_storage_provider: ott.is_on_storage_provider[entry.slug],
        size: entry.size,
        storage_provider: ott.storage_providers[entry.slug],
    }

    const readable = await downloadFile({
        jwtOneTimeToken: ott.jwt_ott,
        file: currentFile,
        oneTimeToken: ott.jwt_ott,
        signal: new AbortController(),
        endpoint: ott.storage_providers[entry.slug]?.url as string,
        isEncrypted: entry.isClientsideEncrypted,
        key: decryptionKey || undefined,
        carReader: CarReader,
        uploadChunkSize: ott.upload_chunk_size[entry.slug] || ott.gateway.upload_chunk_size,
        cidData: cidData as any
    });

    const writable = fs.createWriteStream(localPath);

    readable.pipe(writable);

    writable.on('finish', () => {
        console.log('File has been written');
    });

    writable.on('error', (error) => {
        console.error('Error writing file:', error);
    });
}

const convertArrayBufferToBase64 = (buffer: any) => {
    const bytes = new Uint8Array(buffer);
    return  Base64.fromByteArray(bytes);
};

export async function upload(
    localPath:string,
    destinationPath: string
)  {
    
    if (!fs.existsSync(localPath)) {
        console.error('File not found');
        process.exit(1);
    }

    const stats = fs.lstatSync(localPath);

    if(stats.isDirectory()) {
        console.error('We can\'t upload a directory');
        process.exit(1);
    }

    if (!stats.isFile()) {
        console.error('Upload should be a file');
        process.exit(1);
    }
    
    const ott = await clientGD.getUploadOTT({
        body: [{
            filesize: stats.size.toString(),
            filename: path.basename(localPath),
            isPublic: true
        }]
    })

    if (!ott) {
        throw new Error('Unable to fetch OTT');
    }

    let folderSlug = '';
    if (destinationPath !== '.' && destinationPath !== '/') {
        const { slug } = await clientGD.getFileInfo({
            path: path.dirname(destinationPath)
        });
        folderSlug = slug;
    }
    
    const localFile: LocalFileStream = new LocalFileStream(
        stats.size,
        localPath,
        /// @ts-ignore
        mime.getType(localPath),
        folderSlug,
        ott.jwt_ott[0] // @todo is it ok for uploadId?
    );

    const crypto = getCrypto();
    const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
    console.log('Uploading...');
    let details = await uploadFile({
        file: localFile,
        oneTimeToken: ott.user_token[0].token,
        gateway: ott.gateway,
        callback: () => {},
        handlers: [],
        key,
        jwtOneTimeToken: ott.jwt_ott[0],
    });
    const bufferKey = await crypto.subtle.exportKey('raw', key);
    const clientsideKey = convertArrayBufferToBase64(bufferKey);
    const slug = details.fileInfo.slug;

    const { keys: workspaceKeys } = await clientGD.getWorkspaceKeys();

    const encryptedKeys = await Promise.all(workspaceKeys.map(async (workspaceKey: any) => {
        const publicKey = forge.pki.publicKeyFromPem(workspaceKey);
        const encryptedKey = publicKey.encrypt(clientsideKey);
        const encryptedHexKey = forge.util.bytesToHex(encryptedKey);
        return { publicKey: workspaceKey, encryptedFileKey: encryptedHexKey };
    }))


    await clientGD.saveEncryptedFileKeys({
        slug,
        encryptedKeys
    })


    await clientGD.manageKey({
        slug,
        encryptionKey: clientsideKey
    })

    return {
        clientsideKey
    }
}

export function parseGDPath(url: string) {
    const regex = /^gd:\/\/([^\/]+)\/(.*)$/;
    const match = url.match(regex);

    if (match === null || match.length !== 3) {
        throw new Error('Invalid URL format');
    }

    const workspaceId = match[1];
    const filePath = match[2];

    return { workspaceId, filePath };
}