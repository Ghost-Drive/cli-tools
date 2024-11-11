import * as clientNeyra from 'client-neyra';
import * as clientGD from 'client-gd';
import { ethers } from 'ethers';
import { loadCreds } from './utils';

export { clientGD };


type InitClientGDOptions = {
    workspaceId?: number;
    accessToken?: string;
}

export const initClientGD = async ({ workspaceId, accessToken }: InitClientGDOptions = {}) => {

    if (!accessToken) {

        clientNeyra.initializeApiClient({
            baseURL: `${process.env.NEYRA_ENDPOINT}/api`,
            frontend: 'web',
            frontendVersion: '1.0.0',
        })
      
        const creds = await loadCreds();
        const wallet = ethers.Wallet.fromPhrase(creds.mnemonic);
        const message = 'Welcome to Neyra Network. Your ID for this signature request is';
        const signature = await wallet.signMessage(message);
        const { data: { access_token } } = await clientNeyra.connectUser({ body: { 
            signature,
            provider: clientNeyra.AuthProvider.WalletConnect,
            publicAddress: wallet.address as `0x${string}`
        }});
        accessToken = access_token;
    }

    clientGD.initializeApiClient({
        frontend: 'web',
        frontendVersion: '1.0.0',
        baseURL: `${process.env.GD_ENDPOINT}/api`,
        headers: {
            'X-Token': `Bearer ${accessToken}`
        }
    })

    if (workspaceId) {
        await clientGD.switchWorkspace({ 
            params: { workspaceId: Number(workspaceId) }
        })
    }
}