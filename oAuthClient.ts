import {GDStorage} from './types/GDStorage';
import {Workspace} from './types/Workspace';
import {Entry, EntryType} from "./types/Entry";
import {EntryEncryptedDetails} from "./types/EntryEncryptedDetails";
import {OTT, OTTAction} from "./types/OTT";
import * as forge from "node-forge";


// @ts-ignore
import axios, {AxiosInstance} from 'axios';


class oAuthClient {

    private readonly backendUrl: string;
    private readonly clientId: string;
    private readonly clientSecret: string;

    constructor(backendUrl: string, clientId: string, clientSecret: string) {
        this.backendUrl = backendUrl;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }

    async exportKey(address: string, pubKey: string): Promise<boolean> {
        let data = {
            publicAddress: address, publicKey: pubKey
        };
        try {
            const response = await axios.post(
                this.backendUrl + 'apiv2/save/public/key',
                data,
                {
                    headers: {
                        'content-type': 'application/json',
                        "client-id": this.clientId,
                        "client-secret": this.clientSecret
                    }
                });

            return true;

        } catch (error) {
            this.logAxiosError(error);
            return false;
        }
    }

    private logAxiosError(error) {
        // const errors = error?.response?.data?.errors ?? [error.message];
        const errors = error?.response?.data ?? [error.message];
        console.error(errors);
        throw error;
    }
}

export { oAuthClient };
