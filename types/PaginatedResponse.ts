interface UserPublicAddress {
    public_address: string;
    public_key: string;
    active: boolean;
    is_unstoppable: boolean;
    is_coinbase: boolean;
}

interface User {
    ghost_pass_exist: boolean;
    ghost_time_enable: boolean;
    trusted_wired_network_status: boolean;
    trusted_wifi_network_status: boolean;
    new_comment_notification_status: true;
    new_comment_sound_status: true;
    message_verification_status: boolean;
    user_secure_locations: any[];  // You may want to provide a more specific type if known.
    password_access: null | string;
    gps_location: boolean;
    id: number;
    username: string;
    displayed_name: null | string;
    email: string;
    color: string;
    logo: string;
    logo_type: null | string;
    platform: number;
    sharing_notification: boolean;
    workspace_notification: boolean;
    sharing_notification_sound: boolean;
    workspace_notification_sound: boolean;
    referral: string;
    referral_from: string;
    user_public_addresses: UserPublicAddress[];
    created_at: null | number;
    updated_at: number;
}

interface EntryMeta {
    value: number;
    time: number;
    energy: null | string;
    network: null | string;
    nft: null | string;
    trade: boolean;
}

interface FileRecord {
    id: number;
    type: number;
    user: User;
    name: string;
    ghostMode: boolean;
    securities: any[];  // You may want to provide a more specific type if known.
    geo_securities: any[];  // You may want to provide a more specific type if known.
    shares: any[];  // You may want to provide a more specific type if known.
    color: any[];  // You may want to provide a more specific type if known.
    schedules: any[];  // You may want to provide a more specific type if known.
    tags: any[];  // You may want to provide a more specific type if known.
    isPublic: boolean;
    isDenied: boolean;
    isPrinted: boolean;
    is_delegated: boolean;
    is_hidden: boolean;
    isDownloaded: boolean;
    isFavorite: boolean;
    isAiGenerated: boolean;
    canDelete: boolean;
    entry_meta: EntryMeta;
    ipfs_hash: null | string;
    fileicon_hash: null | string;
    trusted_members: any[];  // You may want to provide a more specific type if known.
    entry_groups: any[];  // You may want to provide a more specific type if known.
    isClientsideEncrypted: boolean;
    entry_clientside_key: null | string;
    text: null | string;
    created_at: number;
    updated_at: number;
    slug: string;
    preview_small: null | string;
    preview_large: null | string;
    convert_video: null | string;
    key: string;
    service: string;
    size: number;
    mime: string;
    extension: string;
}
