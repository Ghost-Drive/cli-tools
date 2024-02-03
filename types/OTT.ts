import { GatewayType} from "gdgateway-client";

export enum OTTAction {
    Delete,
    Upload,
    Download,
}

export interface OTT {
    filename: string;
    filesize: string;
    action: OTTAction;
    gateway: GatewayType;
    storageProviders: StorageProviders;
    isOnStorageProvider: IsOnStorageProvider;
    token: string;
    uploadChunkSize: UploadChunkSize;
}

interface Gateway {
    id: number;
    url: string;
    uploadChunkSize: number;
    type: string;
    sameIpUpload: false;
    interimChunkSize: number;
}

interface StorageProviders {
    [key: string]: null | undefined;
}

interface IsOnStorageProvider {
    [key: string]: boolean;
}

interface UploadChunkSize {
    [key: string]: null | number | undefined;
}
