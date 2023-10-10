export enum OTTAction {
    Delete,
    Upload,
    Download,
}

export interface OTT {
    filename: string;
    filesize: string;
    action: OTTAction;
    endpoint: Endpoint;
    token: string;
}

interface Endpoint {
    url: string;
    sameIpUpload: boolean
}