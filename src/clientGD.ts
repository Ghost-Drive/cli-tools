import * as clientNeyra from 'client-neyra';
import * as clientGD from 'client-gd';
import { ethers } from 'ethers';
import { getAuthConfig } from './utils';
import {config} from 'dotenv';

export { clientGD };

config();


type InitClientGDOptions = {
    workspaceId?: number;
    accessToken?: string;
}

export const defaultConfig: clientGD.AxiosInstanceConfig = {
    frontend: 'web',
    frontendVersion: '1.0.0',
    baseURL: `${process.env.GD_ENDPOINT}/api`,
}

export const initClientGD = async ({ workspaceId, accessToken }: InitClientGDOptions = {}) => {
    
    if (accessToken) {
        clientGD.initializeApiClient({
            ...defaultConfig,
            headers: {
                'X-Token': `Bearer ${accessToken}`
            }
        })
    } else {
        const authConfig = await getAuthConfig();

        if (authConfig.authType === '2') {
            throw new Error('Access token is required for OAuth authentication');
        }

        if (authConfig.authType === '1') {
            clientGD.initializeApiClient(defaultConfig)
            await clientGD.authorizeUser({
                accessKey: authConfig.accessKey,
                accessSecret: authConfig.accessSecret
            });
            return;
        }

        if (authConfig.authType === '3') {
            clientNeyra.initializeApiClient({
                baseURL: `${process.env.NEYRA_ENDPOINT}/api`,
                frontend: 'web',
                frontendVersion: '1.0.0',
            })
        
            const wallet = ethers.Wallet.fromPhrase(authConfig.mnemonic);
            const message = 'Welcome to Neyra Network. Your ID for this signature request is';
            const signature = await wallet.signMessage(message);
            const { data: { access_token } } = await clientNeyra.connectUser({ body: { 
                signature,
                provider: clientNeyra.AuthProvider.WalletConnect,
                publicAddress: wallet.address as `0x${string}`
            }});
        
            clientGD.initializeApiClient({
                ...defaultConfig,
                headers: {
                    'X-Token': `Bearer ${access_token}`
                }
            })
        }
    }

    if (workspaceId) {
        await clientGD.switchWorkspace({ 
            params: { workspaceId: Number(workspaceId) }
        })
    }
}