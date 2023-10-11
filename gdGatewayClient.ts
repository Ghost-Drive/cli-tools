import axios from 'axios';
import { GDStorage } from './types/GDStorage';
import { Workspace } from './types/Workspace';
import {Entry, EntryType} from "./types/Entry";
import * as fs from 'fs';
import {OTT, OTTAction} from "./types/OTT";
import { downloadFile, uploadFile, LocalFileStream, getThumbnailImage} from 'gdgateway-client/lib/es5';
import * as Base64 from 'base64-js';

import {getCrypto} from "gdgateway-client/lib/es5/utils/getCrypto";

const crypto = getCrypto();


const convertArrayBufferToBase64 = (buffer: any) => {
    const bytes = new Uint8Array(buffer);
    return  Base64.fromByteArray(bytes);
};
class gdGatewayClient {

    async uploadFile(localFile: LocalFileStream, ott: OTT, updateProgressCallback: any, signal: AbortSignal): Promise<Entry> {
        // arrayBuffer
        const encodeFileData = {
            callbacks: {
                onProgress: updateProgressCallback,
            },
            handlers: ['onProgress'],
        };

        const { handlers, callbacks } = encodeFileData; // use 'handlers' as parameter

        const callback = ({ type, params }) => {
            if (handlers.includes(type)) {
                callbacks[type]({ ...params });
            } else {
                console.error(`Handler "${type}" isn't provided`);
            }
        };

        const key = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );

        let details = await uploadFile(
            {
                file: localFile,
                oneTimeToken: ott.token,
                endpoint: ott.endpoint.url,
                callback,
                handlers,
                key
            },
            signal
        );


        const bufferKey = await crypto.subtle.exportKey('raw', key);
        const base64Key = convertArrayBufferToBase64(bufferKey);

        return {
            name: details.data.data.name,
            slug: details.data.data.slug,
            path: details.data.data.path,
            size: details.data.data.size,
            workspaceId: details.data.data.workspaceId,
            isClientsideEncrypted: details.data.data.isClientsideEncrypted,
            iv: details.data.data.iv,
            sha3Hash: details.data.data.sha3Hash,
            type: details.data.data.type,
            clientsideKey: base64Key
        }

    }

    async saveThumb(
        file: LocalFileStream,
        ott: OTT,
        fileSlug: string
    )  {
        return true;
        // const base64Image = await getThumbnailImage({
        //     path: file.name,
        //     file: file,
        //     quality: 10
        // });
        //
        // if (base64Image) {
        //     const instance = axios.create({
        //         headers: {
        //             "x-file-name": file.name,
        //             "Content-Type": "application/octet-stream",
        //             "one-time-token": ott.token,
        //         },
        //     });
        //
        //     await instance.post(`${ott.endpoint}/chunked/thumb/${fileSlug}`, base64Image);
        // }
        // return true;
    };

    async downloadFile(file:Entry, ott:OTT, callback: any, signal, decryptionKey: {iv, clientsideKeySha3Hash, key} | null)
    {
        let currentFile = {
            slug: file.slug,
            entry_clientside_key: decryptionKey,
        }

        const encodeFileData = {
            callbacks: {
                onProgress: (f) => { callback(f) ; },
            },
            handlers: ['onProgress'],
        };

        const { handlers, callbacks } = encodeFileData; // use 'handlers' as parameter

        return downloadFile({
            file: currentFile,
            oneTimeToken: ott.token,
            signal: signal,
            endpoint: ott.endpoint.url,
            isEncrypted: file.isClientsideEncrypted,
            key: decryptionKey.key,
            callback:  ({ type, params }) => { // use 'callback' as parameter
                if (handlers.includes(type)) {
                    callbacks[type]({ ...params });
                } else {
                    console.error(`Handler "${type}" isn't provided`);
                }
            },
            handlers: encodeFileData.handlers
        });

    }

}

export { gdGatewayClient };
